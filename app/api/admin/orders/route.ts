import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, reconcilePendingOrders } from "@/lib/fulfillment";

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
