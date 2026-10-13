import { NextRequest, NextResponse } from "next/server";
import {
  checkAtlosOrderStatus,
  checkFamGatewayOrderStatus,
  fulfillOrder,
  getAllOrders,
  getOrder,
  isAlreadySent,
  getFulfilledCredentials,
  redis,
  ORDERS_HISTORY_KEY,
  StoredOrder,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim().replace(/^["']|["']$/g, "");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "");
  const provided = (
    req.headers.get("x-admin-password") ||
    req.nextUrl.searchParams.get("password") ||
    bearer ||
    ""
  ).trim().replace(/^["']|["']$/g, "");
  return !!adminPassword && provided === adminPassword;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const requestedGateway = typeof body.gateway === "string" ? body.gateway.trim().toLowerCase() : "auto";
    const autoFulfill = Boolean(body.fulfill);
    const emailOverride = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Please enter an Order ID, Blockchain TxID (Hash), or UPI UTR." },
        { status: 400 }
      );
    }

    const cleanQuery = query.replace(/^CRYPTO:/i, "").trim();

    // 1. Check orders history in Redis
    const history = await getAllOrders();
    let matchedOrder = history.find(
      (o) =>
        o.orderId.toLowerCase() === cleanQuery.toLowerCase() ||
        (o.utr && o.utr.toLowerCase() === cleanQuery.toLowerCase()) ||
        (o.utr && o.utr.replace(/^CRYPTO:/i, "").toLowerCase() === cleanQuery.toLowerCase())
    );

    const orderId = matchedOrder?.orderId || cleanQuery;
    const orderData = await getOrder(orderId);

    // Auto-detect gateway if not explicitly requested
    const isCrypto =
      requestedGateway === "crypto" ||
      (requestedGateway !== "upi" &&
        (cleanQuery.startsWith("0x") ||
          cleanQuery.length >= 64 ||
          orderId.startsWith("ORD-CR-") ||
          orderId.startsWith("crypto_") ||
          matchedOrder?.paymentMethod === "crypto" ||
          matchedOrder?.productId === "crypto" ||
          (matchedOrder?.utr && matchedOrder.utr.startsWith("CRYPTO:"))));

    let isPaid = false;
    let paymentStatus: "confirmed" | "pending" | "mempool_detected" | "not_found" = "pending";
    let detectedTxid: string | undefined = undefined;
    let detectedUtr: string | undefined = undefined;
    let detectedAmount: number | undefined = undefined;
    let gatewayDetails: any = null;

    if (isCrypto) {
      // 1. Check Atlos by orderId
      const atlosCheck = await checkAtlosOrderStatus(orderId);
      if (atlosCheck.status === "success") {
        isPaid = true;
        paymentStatus = "confirmed";
        detectedTxid = atlosCheck.txid;
        detectedAmount = atlosCheck.amount;
        gatewayDetails = { checkType: "atlos_order_id", ...atlosCheck };
      } else if (atlosCheck.status === "mempool_detected") {
        paymentStatus = "mempool_detected";
        gatewayDetails = { checkType: "atlos_mempool", ...atlosCheck };
      }

      // 2. If not found by orderId, check Atlos by transaction hash
      const potentialHash =
        cleanQuery.startsWith("0x") || cleanQuery.length >= 64
          ? cleanQuery
          : matchedOrder?.utr?.replace(/^CRYPTO:/i, "");

      if (!isPaid && potentialHash) {
        try {
          const atlosSecret = process.env.ATLOS_API_SECRET || "6UCqzHHDmb5f0NbXOGCmLKFc2PVIMEYB";
          const merchantId = process.env.ATLOS_MERCHANT_ID || "ADK7QABYR0";
          const atlosRes = await fetch("https://api.atlos.io/gateway/rest/Transaction/FindByHash", {
            method: "POST",
            headers: { "Content-Type": "application/json", ApiSecret: atlosSecret },
            body: JSON.stringify({ MerchantId: merchantId, BlockchainHash: potentialHash }),
            cache: "no-store",
            signal: AbortSignal.timeout(7000),
          });

          if (atlosRes.ok) {
            const data = await atlosRes.json();
            const tx = data.Transaction || data;
            if (data.IsFound || tx.Status === 100 || String(tx.Status) === "100" || tx.Txid) {
              isPaid = true;
              paymentStatus = "confirmed";
              detectedTxid = potentialHash;
              detectedAmount = Number(tx.PaidAmount || tx.OrderAmount || tx.amount) || undefined;
              gatewayDetails = { checkType: "atlos_find_by_hash", ...data };
            }
          }
        } catch (e) {
          console.warn("Atlos FindByHash lookup failed:", e);
        }
      }
    } else {
      // Check FamGateway UPI
      const fgCheck = await checkFamGatewayOrderStatus(orderId);
      if (fgCheck.status === "success") {
        isPaid = true;
        paymentStatus = "confirmed";
        detectedUtr = fgCheck.utr;
        detectedAmount = fgCheck.amount;
        gatewayDetails = { checkType: "famgateway", ...fgCheck };
      } else {
        paymentStatus = fgCheck.status === "expired" ? "not_found" : "pending";
        gatewayDetails = { checkType: "famgateway", ...fgCheck };
      }
    }

    // Check if already fulfilled
    const alreadyFulfilled = await isAlreadySent(orderId);
    let existingCredentials = null;
    if (alreadyFulfilled) {
      existingCredentials = await getFulfilledCredentials(orderId);
    }

    // Optional 1-click fulfillment
    let fulfillmentResult = null;
    if (autoFulfill && isPaid && !alreadyFulfilled) {
      const targetEmail =
        emailOverride ||
        matchedOrder?.email ||
        orderData?.email ||
        "customer@trinitymart.com";

      fulfillmentResult = await fulfillOrder({
        orderId,
        email: targetEmail,
        utr: detectedTxid ? `CRYPTO:${detectedTxid}` : detectedUtr || matchedOrder?.utr,
        amount: detectedAmount || matchedOrder?.amount || orderData?.amount || APP_CONFIG.price,
        quantity: matchedOrder?.quantity || orderData?.quantity || 1,
        productId: matchedOrder?.productId || orderData?.productId,
        productName: matchedOrder?.productName || orderData?.productName,
        cartItems: matchedOrder?.cartItems || orderData?.cartItems,
      });
    }

    return NextResponse.json({
      success: true,
      query,
      gateway: isCrypto ? "crypto" : "upi",
      status: paymentStatus,
      isPaid,
      alreadyFulfilled,
      existingCredentials,
      fulfillmentResult,
      detectedTxid,
      detectedUtr,
      detectedAmount,
      matchedOrder: matchedOrder || null,
      orderData: orderData || null,
      gatewayDetails,
    });
  } catch (err: any) {
    console.error("Admin verify-payment error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error during payment verification." },
      { status: 500 }
    );
  }
}
