import { NextRequest, NextResponse } from "next/server";
import { reconcilePendingOrders } from "@/lib/fulfillment";

export const maxDuration = 60;

/**
 * GET /api/cron/reconcile-orders
 * Automated Cron Job:
 * Sweeps pending orders from the last 2 hours and checks if any were completed
 * while the customer's browser window was closed or cut.
 * If paid, fulfills the order and automatically emails the credentials.
 */
export async function GET(req: NextRequest) {
  // Optional cron authorization token check
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const result = await reconcilePendingOrders();
    console.log(`[CRON] Reconciled pending orders: checked ${result.checked}, fulfilled ${result.fulfilled}`);
    return NextResponse.json({
      status: "success",
      checked: result.checked,
      fulfilled: result.fulfilled,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[CRON] Reconcile error:", err);
    return NextResponse.json(
      { error: "Cron execution failed", message: err?.message },
      { status: 500 }
    );
  }
}
