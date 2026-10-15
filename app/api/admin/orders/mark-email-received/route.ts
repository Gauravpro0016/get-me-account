import { NextRequest, NextResponse } from "next/server";
import { manuallySetEmailStatus } from "@/lib/fulfillment";

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
    const { orderId, received = true } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const updated = await manuallySetEmailStatus(orderId, Boolean(received));

    if (!updated) {
      return NextResponse.json(
        { error: "Order not found or update failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updated,
    });
  } catch (err) {
    console.error("Failed to update email received status:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
