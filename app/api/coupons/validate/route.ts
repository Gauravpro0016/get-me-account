import { NextRequest, NextResponse } from "next/server";
import { validateCoupon } from "@/lib/coupons";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const amount = Number(body.amount);

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Please enter a coupon code." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { valid: false, error: "Invalid order amount for coupon calculation." },
        { status: 400 }
      );
    }

    const result = await validateCoupon(code, amount);

    if (!result.valid || !result.coupon) {
      return NextResponse.json(
        { valid: false, error: result.error || "Invalid coupon code." },
        { status: 400 }
      );
    }

    const discountSummary =
      result.coupon.discountType === "percentage"
        ? `${result.coupon.discountValue}% OFF`
        : `₹${result.coupon.discountValue} OFF`;

    return NextResponse.json({
      valid: true,
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      message: `Coupon "${result.coupon.code}" applied! You saved ₹${result.discountAmount} (${discountSummary}).`,
    });
  } catch (err: any) {
    console.error("Coupon validation error:", err);
    return NextResponse.json(
      { valid: false, error: "Failed to validate coupon code." },
      { status: 500 }
    );
  }
}
