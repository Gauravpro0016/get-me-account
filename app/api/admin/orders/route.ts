import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, reconcilePendingOrders } from "@/lib/fulfillment";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get("x-admin-password") || req.nextUrl.searchParams.get("password");
  return !!adminPassword && provided === adminPassword;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Non-blocking auto-reconciliation sweep of any orphaned pending orders
  reconcilePendingOrders().catch((err) => {
    console.warn("[ADMIN ORDERS] Reconcile error:", err);
  });

  try {
    const orders = await getAllOrders();
    return NextResponse.json({ orders, count: orders.length });
  } catch (err) {
    console.error("Failed to fetch orders:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
