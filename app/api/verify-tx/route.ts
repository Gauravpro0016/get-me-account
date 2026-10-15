import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getFulfilledCredential,
  getFulfilledCredentials,
  getOrder,
  isAlreadySent,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
  redis,
  ORDERS_HISTORY_KEY,
  StoredOrder,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const queryId =
      typeof body.txHash === "string"
        ? body.txHash.trim()
        : typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    console.log("POST /api/verify-tx received:", { email, queryId });

    if (!email || !queryId) {
      return NextResponse.json(
        { error: "Both email and Order ID / UPI UTR are required" },
        { status: 400 }
      );
    }

    // 1. Check if queryId matches directly as fulfilled orderId
    if (await isAlreadySent(queryId)) {
      const creds = await getFulfilledCredentials(queryId);
      return NextResponse.json({
        status: "confirmed",
        already_sent: true,
        credential: creds[0] || undefined,
        credentials: creds,
      });
    }

    // 2. Check if queryId is a 12-digit UTR in orders history
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const matchedByUtr = history.find(
      (o) => (o.utr && o.utr.trim() === queryId) || o.orderId === queryId
    );

    if (matchedByUtr && matchedByUtr.status === "confirmed") {
      const creds = matchedByUtr.deliveredCredentials || (matchedByUtr.deliveredCredential ? [matchedByUtr.deliveredCredential] : []);
      if (creds.length > 0) {
        return NextResponse.json({
          status: "confirmed",
          already_sent: true,
          credential: creds[0],
          credentials: creds,
          utr: matchedByUtr.utr,
        });
      }
    }

    const targetOrderId = matchedByUtr?.orderId || queryId;
    const isCrypto =
      targetOrderId.startsWith("ORD-CR-") ||
      targetOrderId.startsWith("crypto_") ||
      queryId.startsWith("0x") ||
      queryId.startsWith("CRYPTO:") ||
      matchedByUtr?.paymentMethod === "crypto" ||
      matchedByUtr?.productId === "crypto";

    // 3. Check Crypto Gateway (Atlos) if crypto order or blockchain hash
    if (isCrypto) {
      const cryptoStatus = await checkAtlosOrderStatus(targetOrderId);
      let isCryptoPaid = cryptoStatus.status === "success";
      let cryptoTxid = cryptoStatus.txid;

        try {
          const atlosSecret = process.env.ATLOS_API_SECRET || "";
          const merchantId = process.env.ATLOS_MERCHANT_ID || process.env.NEXT_PUBLIC_ATLOS_MERCHANT_ID || "";
          if (atlosSecret) {
            const cleanHash = queryId.replace(/^CRYPTO:/i, "").trim();
          const atlosRes = await fetch("https://api.atlos.io/gateway/rest/Transaction/FindByHash", {
            method: "POST",
            headers: { "Content-Type": "application/json", ApiSecret: atlosSecret },
            body: JSON.stringify({ MerchantId: merchantId, BlockchainHash: cleanHash }),
            cache: "no-store",
            signal: AbortSignal.timeout(6000),
          });
          if (atlosRes.ok) {
            const atlosData = await atlosRes.json();
            if (atlosData && (atlosData.IsFound || atlosData.Transaction || atlosData.Txid)) {
              isCryptoPaid = true;
              cryptoTxid = cleanHash;
            }
          }
        } catch (e) {
          console.warn("Atlos verify-tx FindByHash error:", e);
        }
      }

      if (isCryptoPaid) {
        const orderData = await getOrder(targetOrderId);
        const finalUtr = cryptoTxid ? `CRYPTO:${cryptoTxid}` : matchedByUtr?.utr || `CRYPTO:${queryId}`;

        const result = await fulfillOrder({
          orderId: targetOrderId,
          email,
          utr: finalUtr,
          senderName: "Crypto Customer",
          amount: orderData?.amount || matchedByUtr?.amount || APP_CONFIG.price,
          quantity: orderData?.quantity || matchedByUtr?.quantity || 1,
          productId: orderData?.productId || matchedByUtr?.productId,
          productName: orderData?.productName || matchedByUtr?.productName,
          cartItems: orderData?.cartItems || matchedByUtr?.cartItems,
        });

        const creds = result.credentials || (result.credential ? [result.credential] : []);

        return NextResponse.json({
          status: "confirmed",
          gateway: "crypto",
          credential: creds[0] || undefined,
          credentials: creds,
          utr: finalUtr,
        });
      }

      return NextResponse.json({
        status: "pending",
        gateway: "crypto",
        message:
          "Cryptocurrency payment not yet confirmed on blockchain/Atlos. Please allow 1-2 minutes for network block confirmation.",
      });
    }

    // 4. Check FamGateway UPI status
    const fgStatus = await checkFamGatewayOrderStatus(targetOrderId);

    if (fgStatus.status === "success") {
      const orderData = await getOrder(targetOrderId);
      const finalUtr = fgStatus.utr || (matchedByUtr?.utr) || (/^\d{12}$/.test(queryId) ? queryId : undefined);

      const result = await fulfillOrder({
        orderId: targetOrderId,
        email,
        utr: finalUtr,
        senderName: fgStatus.senderName || matchedByUtr?.senderName,
        amount: orderData?.amount || matchedByUtr?.amount || fgStatus.amount || APP_CONFIG.price,
        quantity: orderData?.quantity || matchedByUtr?.quantity || 1,
        productId: orderData?.productId || matchedByUtr?.productId,
        productName: orderData?.productName || matchedByUtr?.productName,
        cartItems: orderData?.cartItems || matchedByUtr?.cartItems,
      });

      const creds = result.credentials || (result.credential ? [result.credential] : []);

      return NextResponse.json({
        status: "confirmed",
        gateway: "upi",
        credential: creds[0] || undefined,
        credentials: creds,
        utr: finalUtr,
      });
    }

    return NextResponse.json({
      status: "pending",
      gateway: "upi",
      message:
        "Payment not yet confirmed on FamGateway. Please allow 1-2 minutes for bank receipt detection or check your Order ID.",
    });
  } catch (err) {
    console.error("verify-tx error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

