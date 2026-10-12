import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getOrder,
  isAlreadySent,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
  startBackgroundOrderWatcher,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

/**
 * POST /api/payment/on-window-cut
 * Beacon / lifecycle handler triggered when customer closes, navigates away,
 * or cuts the payment window/modal.
 *
 * Ensures payment status is immediately checked, and if paid, auto-fulfills
 * and emails the customer. If still pending, ensures background watcher is active.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: Record<string, any> = {};

    if (rawBody.trim().length > 0) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        try {
          const params = new URLSearchParams(rawBody);
          payload = Object.fromEntries(params.entries());
        } catch {
          payload = {};
        }
      }
    }

    const orderId = (
      payload.orderId ||
      payload.order_id ||
      req.nextUrl.searchParams.get("orderId") ||
      req.nextUrl.searchParams.get("order_id")
    )?.toString().trim();

    let email = (
      payload.email ||
      req.nextUrl.searchParams.get("email")
    )?.toString().trim().toLowerCase();

    const method: "upi" | "crypto" =
      payload.method === "crypto" ||
      orderId?.startsWith("ORD-CR-") ||
      orderId?.startsWith("crypto_")
        ? "crypto"
        : "upi";

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    console.log(`[WINDOW-CUT] User closed/cut window for order: ${orderId} (${email || "no-email-in-body"})`);

    // Retrieve order details if email was not supplied in beacon body
    const orderData = await getOrder(orderId);
    if (!email && orderData?.email) {
      email = orderData.email.trim().toLowerCase();
    }

    // 1. Check if order was already fulfilled
    if (await isAlreadySent(orderId)) {
      console.log(`[WINDOW-CUT] Order ${orderId} is already fulfilled. No action needed.`);
      return NextResponse.json({ status: "already_fulfilled", orderId });
    }

    // 2. Perform an immediate check with the payment gateway
    if (method === "crypto") {
      const cryptoCheck = await checkAtlosOrderStatus(orderId);
      if (cryptoCheck.status === "success" && email) {
        console.log(`[WINDOW-CUT] 💰 Crypto order ${orderId} confirmed upon window cut! Fulfilling & sending email...`);
        const result = await fulfillOrder({
          orderId,
          email,
          utr: cryptoCheck.txid ? `CRYPTO:${cryptoCheck.txid}` : undefined,
          amount: cryptoCheck.amount || orderData?.amount || APP_CONFIG.price,
          quantity: orderData?.quantity || 1,
          productId: orderData?.productId,
          productName: orderData?.productName,
          cartItems: orderData?.cartItems,
        });

        return NextResponse.json({
          status: "fulfilled",
          delivered: result.success,
          orderId,
        });
      }
    } else {
      const fgCheck = await checkFamGatewayOrderStatus(orderId);
      if (fgCheck.status === "success" && email) {
        console.log(`[WINDOW-CUT] 💰 UPI order ${orderId} confirmed upon window cut! Fulfilling & sending email...`);
        const result = await fulfillOrder({
          orderId,
          email,
          utr: fgCheck.utr,
          senderName: fgCheck.senderName,
          amount: fgCheck.amount || orderData?.amount || APP_CONFIG.price,
          quantity: orderData?.quantity || 1,
          productId: orderData?.productId,
          productName: orderData?.productName,
          cartItems: orderData?.cartItems,
        });

        return NextResponse.json({
          status: "fulfilled",
          delivered: result.success,
          orderId,
        });
      }
    }

    // 3. If not completed yet, ensure server background watcher is active
    if (email) {
      console.log(`[WINDOW-CUT] Order ${orderId} still pending. Registering server watcher...`);
      startBackgroundOrderWatcher(orderId, email, method);
    }

    return NextResponse.json({
      status: "watcher_active",
      orderId,
      message: "Order watcher is actively monitoring gateway in the background.",
    });
  } catch (err: any) {
    console.error("[WINDOW-CUT] Error handling window-cut event:", err);
    return NextResponse.json(
      { error: "Internal error processing window-cut event", message: err?.message },
      { status: 500 }
    );
  }
}
