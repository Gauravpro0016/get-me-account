import { NextRequest, NextResponse } from "next/server";
import { recordNewOrder, redis, sendOrderInitiatedEmail, calculateAuthoritativeAmount } from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required to receive your crypto order receipt & keys." },
        { status: 400 }
      );
    }

    const rawQty = Number(body.quantity);
    const quantity = Math.max(1, Math.min(100, Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 1));

    const productId = typeof body.productId === "string" ? body.productId.trim() : undefined;
    const productName = typeof body.productName === "string" ? body.productName.trim() : undefined;
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : undefined;
    const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim().toUpperCase() : undefined;

    // Server-side authoritative price calculation (prevents client price tampering)
    const priceCalc = await calculateAuthoritativeAmount({
      productId,
      quantity,
      cartItems,
      couponCode,
      clientAmount: Number(body.amount),
    });
    const amountInr = priceCalc.finalAmount;
    const discountAmount = priceCalc.discountAmount;

    // Convert INR to USD for Atlos widget (Atlos accepts USD or major fiat/crypto)
    const rate = APP_CONFIG.inrToUsdRate || 0.0118;
    const rawUsd = amountInr * rate;
    // Set practical minimum of $0.01 (1 cent) so 1 INR maps to $0.01 instead of being inflated to $0.05 (5 INR)
    const amountUsd = Math.max(0.01, Number(rawUsd.toFixed(2)));

    // Generate unique crypto order identifier
    const orderId = `ORD-CR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Persist order in Redis order records
    await recordNewOrder({
      orderId,
      email,
      amount: amountInr,
      quantity,
      productId,
      productName,
      cartItems,
      couponCode: priceCalc.appliedCouponCode || couponCode,
      discountAmount,
      paymentMethod: "crypto",
    });

    // Send order ID and live tracking link to customer email
    try {
      sendOrderInitiatedEmail({
        orderId,
        email,
        amount: amountInr,
        quantity,
        productName: productName || APP_CONFIG.productName,
        cartItems,
        paymentMethod: "crypto",
      }).catch((e) => console.warn("[CRYPTO INITIATED EMAIL ERROR]:", e));
    } catch (e) {
      console.warn("Could not dispatch crypto initiated order email:", e);
    }

    // Save crypto-specific meta info
    try {
      await redis.hset(`order_meta:${orderId}`, {
        paymentMethod: "crypto_atlos",
        productId: productId || "",
        productName: productName || "Trinitymart Digital Asset",
        cartItems: JSON.stringify(cartItems || []),
        createdAt: new Date().toISOString(),
        quantity: String(quantity),
        amountInr: String(amountInr),
        amountUsd: String(amountUsd),
        status: "pending",
      });
    } catch (e) {
      console.warn("Could not record crypto order_meta:", e);
    }

    const merchantId =
      process.env.ATLOS_MERCHANT_ID ||
      process.env.ATLOS_MERCHANT_ID ||
      APP_CONFIG.atlosMerchantId ||
      "ADK7QABYR0";

    return NextResponse.json({
      status: "success",
      data: {
        order_id: orderId,
        amount_inr: amountInr,
        amount_usd: amountUsd,
        quantity,
        merchant_id: merchantId,
        email,
        productName: productName || APP_CONFIG.productName,
      },
    });
  } catch (err) {
    console.error("Crypto create-order error:", err);
    return NextResponse.json(
      { error: "Internal server error while initializing crypto payment session." },
      { status: 500 }
    );
  }
}
