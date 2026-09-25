import { NextRequest, NextResponse } from "next/server";
import { readPool, recordNewOrder } from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    const rawQty = Number(body.quantity);
    const quantity = Math.max(1, Math.min(100, Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 1));

    // Check stock availability
    const pool = await readPool();
    if (!pool || pool.length === 0) {
      return NextResponse.json(
        { error: "Sorry, we are currently out of stock. Please check back later." },
        { status: 503 }
      );
    }
    if (pool.length < quantity) {
      return NextResponse.json(
        {
          error: `Only ${pool.length} account(s) currently available in stock. Please reduce your quantity.`,
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAMGATEWAY_API_KEY;
    if (!apiKey) {
      console.error("FAMGATEWAY_API_KEY is not configured in environment variables.");
      return NextResponse.json(
        { error: "Payment gateway is not properly configured. Please contact support." },
        { status: 500 }
      );
    }

    // Determine current site base URL for webhook & redirect
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    )?.replace(/\/$/, "");
    const baseUrl = appUrl || (host ? `${proto}://${host}` : req.nextUrl.origin);

    const webhookUrl = `${baseUrl}/api/webhook`;
    const redirectUrl = `${baseUrl}/?payment_success=1`;

    const cleanUsername = email.split("@")[0].slice(0, 30);
    const unitPrice = APP_CONFIG.price;
    const amount = unitPrice * quantity;

    console.log("Creating FamGateway order:", {
      quantity,
      unitPrice,
      amount,
      email,
      webhookUrl,
    });

    const res = await fetch("https://famgateway.in/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        amount: amount,
        customer_email: email,
        customer_name: cleanUsername,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.status !== "success" || !data.data?.order_id) {
      console.error("FamGateway order creation error response:", data);
      return NextResponse.json(
        {
          error:
            data?.message ||
            data?.error ||
            "Failed to generate UPI payment session with FamGateway.",
        },
        { status: 502 }
      );
    }

    const orderDetails = data.data;
    const orderId = orderDetails.order_id;

    // Persist order in Redis and global orders history
    await recordNewOrder({
      orderId,
      email,
      amount,
      quantity,
    });

    return NextResponse.json({
      status: "success",
      data: {
        order_id: orderDetails.order_id,
        amount: orderDetails.amount || amount,
        payable_amount: orderDetails.payable_amount || amount,
        quantity,
        upi_id: orderDetails.upi_id,
        qr_url: orderDetails.qr_url,
        checkout_url: orderDetails.checkout_url,
        upi_intent: orderDetails.upi_intent,
        expires_at_ist: orderDetails.expires_at_ist,
      },
    });
  } catch (err) {
    console.error("famgateway create-order error:", err);
    return NextResponse.json(
      { error: "Internal server error while initializing payment." },
      { status: 500 }
    );
  }
}
