import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { fulfillOrder, getOrder } from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 60;

/**
 * GET /api/atlos/webhook
 * Health check endpoint for testing Atlos webhook connectivity
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Atlos Crypto Webhook Postback listener is online and ready to receive events.",
    endpoint: "/api/atlos/webhook",
  });
}

/**
 * POST /api/atlos/webhook
 * Atlos Postback listener
 * Triggered automatically by Atlos when a customer completes a cryptocurrency transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-webhook-signature") ||
      req.headers.get("signature") ||
      req.headers.get("x-atlos-signature");
    const atlosSecret = (process.env.ATLOS_API_SECRET || "").trim();

    console.log("POST /api/atlos/webhook received from Atlos. Signature present:", !!signature);

    // Cryptographic HMAC-SHA256 signature verification
    if (atlosSecret) {
      if (!signature) {
        return NextResponse.json(
          { error: "Missing cryptographic webhook signature" },
          { status: 401 }
        );
      }

      try {
        const expected = crypto.createHmac("sha256", atlosSecret).update(rawBody).digest("hex");
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");

        const isMatch =
          sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

        if (!isMatch) {
          console.warn("Invalid webhook signature from Atlos");
          return NextResponse.json(
            { error: "Invalid cryptographic signature" },
            { status: 401 }
          );
        }
      } catch (sigErr) {
        console.warn("Signature verification failed:", sigErr);
        return NextResponse.json(
          { error: "Cryptographic signature verification error" },
          { status: 401 }
        );
      }
    }

    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    console.log("Atlos webhook payload:", payload);

    const orderId = (payload.OrderId || payload.orderId || payload.order_id) as string;
    const status = payload.Status !== undefined ? payload.Status : payload.status;
    const txHash = (payload.BlockchainHash || payload.Txid || payload.txid || payload.hash) as string;
    const amount = Number(payload.PaidAmount || payload.OrderAmount || payload.amount) || 1;

    // Check if status is 100 (Atlos success code) or "success"
    const isCompleted = status === 100 || String(status) === "100" || status === "success" || status === "COMPLETED";

    if (isCompleted) {
      if (!orderId) {
        console.warn("Missing OrderId in Atlos webhook payload:", payload);
        return NextResponse.json({ error: "Missing OrderId" }, { status: 400 });
      }

      // Retrieve customer email saved during order generation
      const orderData = await getOrder(orderId);
      const email =
        orderData?.email ||
        (payload.CustomerEmail as string) ||
        (payload.UserEmail as string) ||
        (payload.email as string);

      if (!email) {
        console.warn(`No email found for Atlos orderId ${orderId} in Redis or payload.`);
        return NextResponse.json(
          { error: "No customer email associated with this order" },
          { status: 404 }
        );
      }

      // Fulfill order: atomic lock, claim credential, send email with account details
      const resolvedAmount =
        orderData?.amount ||
        (amount > 20 ? amount : Math.round(amount / (APP_CONFIG.inrToUsdRate || 0.0118))) ||
        APP_CONFIG.price;

      const result = await fulfillOrder({
        orderId,
        email,
        utr: txHash ? `CRYPTO:${txHash}` : undefined,
        amount: resolvedAmount,
        quantity: orderData?.quantity || 1,
        productId: orderData?.productId,
        productName: orderData?.productName,
        cartItems: orderData?.cartItems,
      });

      console.log(`Atlos webhook fulfillment result for ${orderId}:`, result);

      return NextResponse.json({
        status: "success",
        delivered: result.success,
        already_sent: result.alreadySent || false,
      });
    }

    return NextResponse.json({ status: "ignored", reason: `Status ${status} not completed` });
  } catch (err) {
    console.error("Atlos webhook processing error:", err);
    return NextResponse.json(
      { error: "Internal server error during Atlos webhook handling" },
      { status: 500 }
    );
  }
}
