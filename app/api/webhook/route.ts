import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { fulfillOrder, getOrder } from "@/lib/fulfillment";

export const maxDuration = 60;

/**
 * GET /api/webhook
 * Health check endpoint for testing webhook connectivity
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "FamGateway Webhook listener is online and ready to receive events.",
    endpoint: "/api/webhook",
  });
}

/**
 * POST /api/webhook
 * FamGateway Webhook event listener
 * Triggered automatically by FamGateway when a customer completes a UPI payment.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-famgateway-signature");
    const apiKey = process.env.FAMGATEWAY_API_KEY;

    console.log("POST /api/webhook received from FamGateway. Signature present:", !!signature);

    // Cryptographic HMAC-SHA256 signature verification (FamGateway uses your API Key as secret)
    if (signature && apiKey) {
      const expected = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature, "hex");
      const expBuf = Buffer.from(expected, "hex");

      const isMatch =
        sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

      if (!isMatch) {
        console.warn("Invalid webhook signature from FamGateway:", {
          received: signature,
          expected,
        });
        return NextResponse.json(
          { error: "Invalid cryptographic signature" },
          { status: 401 }
        );
      }
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
    }

    console.log("FamGateway webhook payload:", payload);

    const eventName = (payload.event as string) || "";
    const status = (payload.status as string) || "";
    const orderId = ((payload.order_id || payload.orderId) as string)?.trim();
    const utr = ((payload.utr || payload.bank_utr) as string)?.trim();
    const senderName = (payload.sender_name as string) || undefined;
    const amount = (payload.amount as number) || 25;
    // Check if this is a successful payment event
    if (eventName === "payment.success" || status === "success") {
      if (!orderId) {
        console.warn("Missing order_id in webhook payload:", payload);
        return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
      }

      // Retrieve customer email saved during order generation
      const orderData = await getOrder(orderId);
      const email =
        orderData?.email ||
        (payload.customer_email as string) ||
        (payload.email as string);

      if (!email) {
        console.warn(`No email found for orderId ${orderId} in Redis or payload.`);
        return NextResponse.json(
          { error: "No customer email associated with this order" },
          { status: 404 }
        );
      }

      // Fulfill order: atomic lock, claim credential, send email with account details
      const result = await fulfillOrder({
        orderId,
        email,
        utr,
        senderName,
        amount,
      });

      console.log(`Webhook fulfillment result for ${orderId}:`, result);

      return NextResponse.json({
        status: "success",
        delivered: result.success,
        already_sent: result.alreadySent || false,
      });
    }

    // Acknowledge other events gracefully
    return NextResponse.json({ status: "ignored", reason: "Non-success event" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Internal server error during webhook handling" },
      { status: 500 }
    );
  }
}
