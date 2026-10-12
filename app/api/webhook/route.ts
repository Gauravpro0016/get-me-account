import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  fulfillOrder,
  getOrder,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 60;

/**
 * GET /api/webhook
 * Health check endpoint for testing webhook connectivity
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Trinitymart Payment Webhook listener is online and ready to receive events.",
    endpoint: "/api/webhook",
  });
}

/**
 * POST /api/webhook
 * Unified FamGateway & Atlos Webhook event listener.
 * Handles automatic delivery if the customer completes payment in UPI / Crypto,
 * even if they closed or cut the browser window.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-famgateway-signature") ||
      req.headers.get("x-signature") ||
      req.headers.get("signature");
    const apiKey = process.env.FAMGATEWAY_API_KEY;

    let payload: Record<string, any> = {};
    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        // Fallback for url-encoded form bodies if sent by legacy gateway hooks
        try {
          const params = new URLSearchParams(rawBody);
          payload = Object.fromEntries(params.entries());
        } catch {
          payload = {};
        }
      }
    }

    // Extract order_id from multiple potential fields (root, nested in data, or URL params)
    const urlOrderId =
      req.nextUrl.searchParams.get("order_id") ||
      req.nextUrl.searchParams.get("orderId");

    const orderId = (
      urlOrderId ||
      payload.order_id ||
      payload.orderId ||
      payload.OrderId ||
      payload.data?.order_id ||
      payload.data?.orderId ||
      payload.data?.OrderId
    )?.toString().trim();

    console.log(`[WEBHOOK] Received payment notification. orderId: ${orderId}, signature: ${!!signature}`);

    // Signature verification check (FamGateway HMAC-SHA256)
    let isSignatureValid = false;
    if (signature && apiKey) {
      try {
        const expected = crypto
          .createHmac("sha256", apiKey)
          .update(rawBody)
          .digest("hex");
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          isSignatureValid = true;
        }
      } catch (err) {
        console.warn("[WEBHOOK] Signature comparison error:", err);
      }
    }

    // Extract parameters from payload or payload.data
    const eventName = payload.event || payload.data?.event || "";
    const rawStatus = (payload.status || payload.data?.status || "").toString().toLowerCase();
    const atlosStatus = payload.Status !== undefined ? payload.Status : payload.data?.Status;

    const utr = (
      payload.utr ||
      payload.bank_utr ||
      payload.data?.utr ||
      payload.data?.bank_utr ||
      payload.BlockchainHash ||
      payload.Txid ||
      payload.txid
    )?.toString().trim();

    const senderName = payload.sender_name || payload.senderName || payload.data?.sender_name || payload.data?.senderName;
    const amount =
      Number(payload.amount || payload.data?.amount || payload.PaidAmount || payload.OrderAmount) ||
      undefined;

    let isPaymentConfirmed =
      eventName === "payment.success" ||
      rawStatus === "success" ||
      rawStatus === "completed" ||
      atlosStatus === 100 ||
      String(atlosStatus) === "100";

    // ── CRITICAL FAIL-SAFE ──
    // If signature is missing or status is uncertain, but an orderId is provided,
    // authoritatively verify with the gateway API directly.
    if (!isSignatureValid && orderId) {
      console.log(`[WEBHOOK] Checking gateway authoritatively for order ${orderId}...`);
      if (orderId.startsWith("ORD-CR-") || orderId.startsWith("crypto_")) {
        const cryptoCheck = await checkAtlosOrderStatus(orderId);
        if (cryptoCheck.status === "success") {
          isPaymentConfirmed = true;
        }
      } else {
        const fgCheck = await checkFamGatewayOrderStatus(orderId);
        if (fgCheck.status === "success") {
          isPaymentConfirmed = true;
        }
      }
    }

    if (isPaymentConfirmed && orderId) {
      // Look up customer order data
      const orderData = await getOrder(orderId);
      const email =
        orderData?.email ||
        payload.customer_email ||
        payload.email ||
        payload.data?.customer_email ||
        payload.data?.email;

      if (!email) {
        console.warn(`[WEBHOOK] Order ${orderId} confirmed, but no customer email found in Redis or payload.`);
        return NextResponse.json(
          { error: "Payment confirmed, but no customer email is linked to this order." },
          { status: 404 }
        );
      }

      console.log(`[WEBHOOK] 🚀 Automatically fulfilling order ${orderId} and emailing customer ${email}...`);

      const result = await fulfillOrder({
        orderId,
        email,
        utr,
        senderName,
        amount: amount || orderData?.amount || APP_CONFIG.price,
        quantity: orderData?.quantity || 1,
        productId: orderData?.productId,
        productName: orderData?.productName,
        cartItems: orderData?.cartItems,
      });

      console.log(`[WEBHOOK] Fulfillment completed for ${orderId}:`, {
        delivered: result.success,
        alreadySent: result.alreadySent,
      });

      return NextResponse.json({
        status: "success",
        delivered: result.success,
        already_sent: result.alreadySent || false,
      });
    }

    return NextResponse.json({
      status: "ignored",
      reason: "Payment not confirmed or missing order_id",
    });
  } catch (err: any) {
    console.error("[WEBHOOK] Unexpected error during webhook processing:", err);
    return NextResponse.json(
      { error: "Internal server error during webhook handling", message: err?.message },
      { status: 500 }
    );
  }
}
