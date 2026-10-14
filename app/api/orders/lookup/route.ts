import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getOrdersByEmail } from "@/lib/fulfillment";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || searchParams.get("orderId") || searchParams.get("order_id") || searchParams.get("email") || "").trim();

  if (!query) {
    return NextResponse.json(
      { error: "Please enter an Order ID or Email address to search." },
      { status: 400 }
    );
  }

  try {
    // 1. If query contains "@", search by email
    if (query.includes("@")) {
      const orders = await getOrdersByEmail(query);
      return NextResponse.json({
        type: "email",
        query,
        count: orders.length,
        orders: orders.map(sanitizeOrderForCustomer),
      });
    }

    // 2. Otherwise search by Order ID
    const order = await getOrderById(query);
    if (!order) {
      return NextResponse.json(
        { error: `No order found with ID "${query}". Please check your order ID or try searching by email.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      type: "order",
      query,
      order: sanitizeOrderForCustomer(order),
    });
  } catch (err: any) {
    console.error("[ORDER LOOKUP ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to look up order. Please try again shortly." },
      { status: 500 }
    );
  }
}

/**
 * Sanitizes order object for customer view:
 * Keeps delivery credentials if confirmed, masks sensitive admin telemetry.
 */
function sanitizeOrderForCustomer(order: any) {
  return {
    orderId: order.orderId,
    email: order.email,
    amount: order.amount,
    quantity: order.quantity || 1,
    productId: order.productId,
    productName: order.productName,
    cartItems: order.cartItems,
    status: order.status,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    utr: order.utr,
    paymentMethod: order.paymentMethod,
    // Delivered credentials (only visible to customer if confirmed/fulfilled)
    deliveredCredentials:
      order.status === "confirmed"
        ? order.deliveredCredentials || (order.deliveredCredential ? [order.deliveredCredential] : [])
        : [],
    // Email delivery receipt status
    emailStatus: order.emailStatus,
    emailSentAt: order.emailSentAt,
    emailOpened: order.emailOpened,
  };
}
