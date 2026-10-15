import { NextRequest, NextResponse } from "next/server";
import { fulfillOrder } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

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
    const { email, orderId, txId, utr, productId, productName, amount, quantity, cartItems } = body;

    if (!email || !orderId) {
      return NextResponse.json(
        { error: "Missing email or orderId" },
        { status: 400 }
      );
    }

    const result = await fulfillOrder({
      orderId: String(orderId).trim(),
      email: String(email).trim(),
      utr: utr || txId,
      amount,
      quantity,
      productId,
      productName,
      cartItems,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        alreadySent: result.alreadySent,
        credential: result.credential,
        credentials: result.credentials,
      });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to deliver credentials" },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fulfill and send email" }, { status: 500 });
  }
}
