import { NextRequest, NextResponse } from "next/server";
import { getOrderById, resendOrderEmail, redis } from "@/lib/fulfillment";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = (body.orderId || "").trim();
    const customerEmail = (body.email || "").trim().toLowerCase();

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Security check: If email provided, it must match the order's email
    if (customerEmail && order.email.toLowerCase() !== customerEmail) {
      return NextResponse.json(
        { error: "Email address does not match this order's records." },
        { status: 403 }
      );
    }

    // Rate limiting: Max 1 customer resend per 60 seconds per order ID
    const rateLimitKey = `resend_lock:${orderId}`;
    const isLocked = await redis.get(rateLimitKey);
    if (isLocked) {
      return NextResponse.json(
        { error: "A delivery email was just sent recently. Please check your inbox (including spam folder) or wait 60 seconds before retrying." },
        { status: 429 }
      );
    }

    // Acquire 60-second lock
    await redis.set(rateLimitKey, "1", { ex: 60 });

    const result = await resendOrderEmail(orderId, order.email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to dispatch email. Please reach out on Discord Support." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Credentials have been resent to ${order.email}! Please check your inbox and spam folder.`,
    });
  } catch (err: any) {
    console.error("[RESEND LOOKUP ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to resend credentials. Please try again shortly." },
      { status: 500 }
    );
  }
}
