import { NextRequest, NextResponse } from "next/server";
import {
  manualFulfillOrder,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
  fulfillOrder,
  getOrder,
  getAllOrders,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim().replace(/^["']|["']$/g, "");
  if (!adminPassword) return false;
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "");
  const provided = (
    req.headers.get("x-admin-password") ||
    bearer ||
    ""
  ).trim().replace(/^["']|["']$/g, "");
  return provided === adminPassword;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, email, customCredentials, utr, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Action 1: Query Gateway Authoritatively (UPI or Crypto) and auto-fulfill if confirmed
    if (action === "check_gateway" || action === "check_crypto" || action === "check_upi") {
      const history = await getAllOrders();
      const order = history.find((o) => o.orderId === orderId);

      const isCryptoRequested =
        action === "check_crypto" ||
        body.method === "crypto" ||
        body.gateway === "crypto";

      const isUpiRequested =
        action === "check_upi" ||
        body.method === "upi" ||
        body.gateway === "upi";

      const isCrypto = isCryptoRequested
        ? true
        : isUpiRequested
        ? false
        : orderId.startsWith("ORD-CR-") ||
          orderId.startsWith("crypto_") ||
          order?.productId === "crypto" ||
          order?.paymentMethod === "crypto" ||
          Boolean(order?.utr && (order.utr.startsWith("CRYPTO:") || order.utr.startsWith("0x")));

      let isPaid = false;
      let finalUtr: string | undefined = undefined;
      let senderName: string | undefined = undefined;
      let amount: number | undefined = undefined;

      if (isCrypto) {
        // 1. Check Atlos by orderId
        const cryptoCheck = await checkAtlosOrderStatus(orderId);
        if (cryptoCheck.status === "success") {
          isPaid = true;
          finalUtr = cryptoCheck.txid ? `CRYPTO:${cryptoCheck.txid}` : undefined;
        }

        // 2. If not found by orderId, but a txHash was provided or present in order.utr
        const passedHash = body.txHash || (order?.utr?.startsWith("CRYPTO:") ? order.utr.replace(/^CRYPTO:/i, "") : order?.utr);
        if (!isPaid && passedHash && typeof passedHash === "string" && passedHash.length >= 20) {
          try {
            const atlosSecret = (process.env.ATLOS_API_SECRET || "").trim();
            const merchantId = (process.env.ATLOS_MERCHANT_ID || "").trim();
            if (!atlosSecret) {
              return;
            }
            const atlosRes = await fetch("https://api.atlos.io/gateway/rest/Transaction/FindByHash", {
              method: "POST",
              headers: { "Content-Type": "application/json", ApiSecret: atlosSecret },
              body: JSON.stringify({ MerchantId: merchantId, BlockchainHash: passedHash.trim() }),
              cache: "no-store",
              signal: AbortSignal.timeout(6000),
            });
            if (atlosRes.ok) {
              const atlosData = await atlosRes.json();
              if (atlosData && (atlosData.IsFound || atlosData.Transaction || atlosData.Txid)) {
                isPaid = true;
                finalUtr = `CRYPTO:${passedHash.trim()}`;
              }
            }
          } catch (e) {
            console.warn("Atlos FindByHash check error:", e);
          }
        }
      } else {
        const fgCheck = await checkFamGatewayOrderStatus(orderId);
        if (fgCheck.status === "success") {
          isPaid = true;
          finalUtr = fgCheck.utr;
          senderName = fgCheck.senderName;
          amount = fgCheck.amount;
        }
      }

      if (!isPaid) {
        const failureMessage = isCrypto
          ? "Crypto gateway (Atlos / Blockchain) reports order is still pending or not yet registered. You can still use 'Fulfill from Stock' if customer confirmed transaction on chain."
          : "UPI gateway (FamGateway) reports order is still pending or awaiting bank settlement. You can still use 'Fulfill from Stock' if UPI money arrived in your bank account.";

        return NextResponse.json({
          success: false,
          verifiedOnGateway: false,
          gateway: isCrypto ? "crypto" : "upi",
          message: failureMessage,
        });
      }

      const targetEmail = email?.trim() || order?.email;
      if (!targetEmail) {
        return NextResponse.json(
          { error: "Payment verified on gateway, but no customer email address is linked." },
          { status: 400 }
        );
      }

      const fulfillRes = await fulfillOrder({
        orderId,
        email: targetEmail,
        utr: finalUtr || utr || order?.utr,
        senderName: senderName || order?.senderName,
        amount: amount || order?.amount || APP_CONFIG.price,
        quantity: order?.quantity || 1,
        productId: order?.productId,
        productName: order?.productName,
        cartItems: order?.cartItems,
      });

      const successMessage = isCrypto
        ? "✅ Payment verified on Crypto Gateway (Atlos / Blockchain)! Order fulfilled & credentials emailed."
        : "✅ Payment verified on UPI Gateway (FamGateway)! Order fulfilled & credentials emailed.";

      return NextResponse.json({
        success: fulfillRes.success,
        verifiedOnGateway: true,
        gateway: isCrypto ? "crypto" : "upi",
        message: fulfillRes.success
          ? successMessage
          : fulfillRes.error || "Payment verified, but stock assignment failed.",
        credentials: fulfillRes.credentials || (fulfillRes.credential ? [fulfillRes.credential] : undefined),
      });
    }

    // Action 2: Manual / Direct Admin Fulfillment
    const result = await manualFulfillOrder({
      orderId,
      overrideEmail: email,
      customCredentials,
      utr,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fulfill order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order fulfilled successfully! Credentials assigned and email dispatched to customer.",
      credentials: result.credentials,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("Admin order fulfill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
