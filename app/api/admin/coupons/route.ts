import { NextRequest, NextResponse } from "next/server";
import {
  getAllCoupons,
  saveAllCoupons,
  Coupon,
} from "@/lib/coupons";

export const dynamic = "force-dynamic";

function checkAdminAuth(req: NextRequest): boolean {
  const adminPass = (process.env.ADMIN_PASSWORD || "").trim().replace(/^["']|["']$/g, "");
  if (!adminPass) return false;

  const headerPwd = req.headers.get("x-admin-password");
  const authHeader = req.headers.get("authorization");

  if (headerPwd && headerPwd === adminPass) return true;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === adminPass) return true;
  }
  return false;
}

// GET: List all coupons
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const coupons = await getAllCoupons();
    return NextResponse.json({ success: true, coupons });
  } catch (err: any) {
    console.error("Admin GET coupons error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve coupons", details: err?.message },
      { status: 500 }
    );
  }
}

// POST: Create a new coupon
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

    if (!rawCode) {
      return NextResponse.json(
        { error: "Coupon code is required" },
        { status: 400 }
      );
    }

    if (!/^[A-Z0-9_-]{3,25}$/.test(rawCode)) {
      return NextResponse.json(
        { error: "Coupon code must be 3-25 alphanumeric characters (A-Z, 0-9, _, -)" },
        { status: 400 }
      );
    }

    const discountType = body.discountType === "flat" ? "flat" : "percentage";
    const discountValue = Number(body.discountValue);

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json(
        { error: "Discount value must be a positive number" },
        { status: 400 }
      );
    }

    if (discountType === "percentage" && discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    const coupons = await getAllCoupons();
    if (coupons.some((c) => c.code.toUpperCase() === rawCode)) {
      return NextResponse.json(
        { error: `Coupon with code "${rawCode}" already exists.` },
        { status: 400 }
      );
    }

    const newCoupon: Coupon = {
      id: `coup_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      code: rawCode,
      discountType,
      discountValue,
      minOrderAmount: Math.max(0, Number(body.minOrderAmount) || 0),
      maxDiscountAmount: body.maxDiscountAmount ? Math.max(0, Number(body.maxDiscountAmount)) : undefined,
      maxUses: body.maxUses ? Math.max(1, Number(body.maxUses)) : undefined,
      usedCount: 0,
      active: body.active !== false,
      expiresAt: body.expiresAt ? new Date(body.expiresAt).toISOString() : undefined,
      createdAt: new Date().toISOString(),
      description: typeof body.description === "string" ? body.description.trim() : "",
    };

    coupons.unshift(newCoupon);
    await saveAllCoupons(coupons);

    return NextResponse.json({ success: true, coupon: newCoupon });
  } catch (err: any) {
    console.error("Admin POST coupon error:", err);
    return NextResponse.json(
      { error: "Failed to create coupon", details: err?.message },
      { status: 500 }
    );
  }
}

// PUT: Update an existing coupon
export async function PUT(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return NextResponse.json({ error: "Coupon ID is required" }, { status: 400 });
    }

    const coupons = await getAllCoupons();
    const idx = coupons.findIndex((c) => c.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const current = coupons[idx];
    const newCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : current.code;

    // Check code duplication if code is changed
    if (newCode !== current.code && coupons.some((c) => c.id !== id && c.code.toUpperCase() === newCode)) {
      return NextResponse.json(
        { error: `Coupon code "${newCode}" is already taken.` },
        { status: 400 }
      );
    }

    const updatedCoupon: Coupon = {
      ...current,
      code: newCode,
      discountType: body.discountType === "flat" ? "flat" : body.discountType === "percentage" ? "percentage" : current.discountType,
      discountValue: Number.isFinite(Number(body.discountValue)) ? Number(body.discountValue) : current.discountValue,
      minOrderAmount: Number.isFinite(Number(body.minOrderAmount)) ? Math.max(0, Number(body.minOrderAmount)) : current.minOrderAmount,
      maxDiscountAmount: body.maxDiscountAmount !== undefined ? (body.maxDiscountAmount ? Number(body.maxDiscountAmount) : undefined) : current.maxDiscountAmount,
      maxUses: body.maxUses !== undefined ? (body.maxUses ? Number(body.maxUses) : undefined) : current.maxUses,
      active: body.active !== undefined ? Boolean(body.active) : current.active,
      expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? new Date(body.expiresAt).toISOString() : undefined) : current.expiresAt,
      description: typeof body.description === "string" ? body.description.trim() : current.description,
    };

    coupons[idx] = updatedCoupon;
    await saveAllCoupons(coupons);

    return NextResponse.json({ success: true, coupon: updatedCoupon });
  } catch (err: any) {
    console.error("Admin PUT coupon error:", err);
    return NextResponse.json(
      { error: "Failed to update coupon", details: err?.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a coupon
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Coupon ID is required" }, { status: 400 });
    }

    let coupons = await getAllCoupons();
    const countBefore = coupons.length;
    coupons = coupons.filter((c) => c.id !== id);

    if (coupons.length === countBefore) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    await saveAllCoupons(coupons);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    console.error("Admin DELETE coupon error:", err);
    return NextResponse.json(
      { error: "Failed to delete coupon", details: err?.message },
      { status: 500 }
    );
  }
}
