import { NextRequest, NextResponse } from "next/server";
import {
  manualFulfillOrder,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
  fulfillOrder,
  getOrder,
  getAllOrders,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get("x-admin-password");
  return !!adminPassword && provided === adminPassword;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, email, customCredentials, utr, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Action 1: Query Gateway Authoritatively and auto-fulfill if confirmed
    if (action === "check_gateway") {
      const history = await getAllOrders();
      const order = history.find((o) => o.orderId === orderId);
      const isCrypto =
        orderId.startsWith("ORD-CR-") ||
        orderId.startsWith("crypto_") ||
        order?.productId === "crypto";

      let isPaid = false;
      let finalUtr: string | undefined = undefined;
      let senderName: string | undefined = undefined;
      let amount: number | undefined = undefined;

      if (isCrypto) {
        const cryptoCheck = await checkAtlosOrderStatus(orderId);
        if (cryptoCheck.status === "success") {
          isPaid = true;
          finalUtr = cryptoCheck.txid ? `CRYPTO:${cryptoCheck.txid}` : undefined;
          amount = cryptoCheck.amount;
        }
      } else {
        const fgCheck = await checkFamGatewayOrderStatus(orderId);
        if (fgCheck.status === "success") {
          isPaid = true;
          finalUtr = fgCheck.utr;
          senderName = fgCheck.senderName;
          amount = fgCheck.amount;
        }
      }

      if (!isPaid) {
        return NextResponse.json({
          success: false,
          verifiedOnGateway: false,
          message:
            "Gateway reports order is still pending or not yet registered. You can still use 'Force Fulfill' if you received the money directly in your UPI account.",
        });
      }

      const targetEmail = email?.trim() || order?.email;
      if (!targetEmail) {
        return NextResponse.json(
          { error: "Payment verified on gateway, but no customer email address is linked." },
          { status: 400 }
        );
      }

      const fulfillRes = await fulfillOrder({
        orderId,
        email: targetEmail,
        utr: finalUtr || utr,
        senderName: senderName || order?.senderName,
        amount: amount || order?.amount || APP_CONFIG.price,
        quantity: order?.quantity || 1,
        productId: order?.productId,
        productName: order?.productName,
        cartItems: order?.cartItems,
      });

      return NextResponse.json({
        success: fulfillRes.success,
        verifiedOnGateway: true,
        message: fulfillRes.success
          ? "Payment verified on UPI gateway! Order fulfilled and credentials emailed."
          : fulfillRes.error || "Payment verified, but stock assignment failed.",
        credentials: fulfillRes.credentials || (fulfillRes.credential ? [fulfillRes.credential] : undefined),
      });
    }

    // Action 2: Manual / Direct Admin Fulfillment
    const result = await manualFulfillOrder({
      orderId,
      overrideEmail: email,
      customCredentials,
      utr,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fulfill order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Order fulfilled successfully! Credentials assigned and email dispatched to customer.",
      credentials: result.credentials,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("Admin order fulfill error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
