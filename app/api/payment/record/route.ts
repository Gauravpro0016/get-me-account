import { NextRequest, NextResponse } from "next/server";
import {
  recordNewOrder,
  fulfillOrder,
  markOrderConfirmedInHistory,
  getOrder,
  sendCredentialEmail,
  sendOrderInitiatedEmail,
  storeFulfilledCredentials,
  Credential,
  redis,
  ORDERS_HISTORY_KEY,
  StoredOrder,
  checkFamGatewayOrderStatus,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const amount = Number(body.amount) || APP_CONFIG.price;
    const quantity = Math.max(1, Number(body.quantity) || 1);
    const utr = typeof body.utr === "string" ? body.utr.trim() : undefined;
    const senderName = typeof body.senderName === "string" ? body.senderName.trim() : undefined;
    const productName = typeof body.productName === "string" ? body.productName.trim() : undefined;
    const productId = typeof body.productId === "string" ? body.productId.trim() : undefined;
    const cartItems = Array.isArray(body.cartItems) ? body.cartItems : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // ── ACTION: CREATE (Record pending order into Redis database) ──
    if (action === "create") {
      if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 });
      }

      await recordNewOrder({
        orderId,
        email,
        amount,
        quantity,
        productId,
        productName,
        cartItems,
      });

      // Send order tracking email to customer
      try {
        sendOrderInitiatedEmail({
          orderId,
          email,
          amount,
          quantity,
          productName: productName || APP_CONFIG.productName,
          cartItems,
          paymentMethod: "upi",
        }).catch((e) => console.warn("[PAYMENT RECORD INITIATED EMAIL ERROR]:", e));
      } catch (e) {
        console.warn("Could not dispatch payment record initiated email:", e);
      }

      // Save additional meta info
      try {
        await redis.hset(`order_meta:${orderId}`, {
          productId: productId || "",
          productName: productName || "Trinitymart Digital Asset",
          cartItems: JSON.stringify(cartItems || []),
          createdAt: new Date().toISOString(),
          quantity: String(quantity),
          amount: String(amount),
        });
      } catch (e) {
        console.warn("Could not record order_meta:", e);
      }

      return NextResponse.json({
        success: true,
        message: "Order successfully recorded in Redis database",
        orderId,
      });
    }

    // ── ACTION: CONFIRM (Strict Bank & Gateway Verification) ──
    if (action === "confirm") {
      if (!email) {
        const savedOrder = await getOrder(orderId);
        if (savedOrder?.email) {
          email = savedOrder.email;
        } else {
          email = "buyer@trinitymart.com";
        }
      }

      const cleanUtr = utr ? utr.trim() : "";

      // 1. Strict 12-digit numeric check for Indian UPI UTR
      if (!cleanUtr || !/^\d{12}$/.test(cleanUtr)) {
        return NextResponse.json(
          {
            error:
              "Invalid UTR number. Bank UTR / Transaction Reference must be exactly 12 numeric digits (e.g. 423456789012).",
          },
          { status: 400 }
        );
      }

      // 2. Check for duplicate UTR reuse
      let isUsed = false;
      try {
        isUsed = Boolean(await redis.sismember("used_bank_utrs", cleanUtr));
      } catch (e) {
        console.warn("Redis used_bank_utrs check error:", e);
      }

      if (isUsed) {
        return NextResponse.json(
          {
            error: `This UTR (${cleanUtr}) has already been claimed for another transaction. Duplicate redemptions are rejected.`,
          },
          { status: 400 }
        );
      }

      // 3. Immediately persist submitted UTR to orders_history so admin sees it right away
      try {
        const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
        const idx = history.findIndex((o) => o.orderId === orderId);
        if (idx !== -1) {
          history[idx].utr = cleanUtr;
          if (senderName) history[idx].senderName = senderName;
          await redis.set(ORDERS_HISTORY_KEY, history);
        }
        await redis.hset(`order_meta:${orderId}`, { utr: cleanUtr });
      } catch (e) {
        console.warn("Could not record submitted UTR on order:", e);
      }

      // 4. Authoritatively verify with FamGateway live API
      const fgStatus = await checkFamGatewayOrderStatus(orderId);
      let gatewayVerified = fgStatus.status === "success";
      let confirmedUtr = fgStatus.utr || cleanUtr;
      let fgSender = fgStatus.senderName;

      if (!gatewayVerified) {
        return NextResponse.json(
          {
            success: false,
            pending: true,
            utr: cleanUtr,
            error: `UTR (${cleanUtr}) recorded. FamGateway is waiting for bank settlement detection. If you just paid, please allow 30-60 seconds for processing or check your email for credentials.`,
          },
          { status: 400 }
        );
      }

      // Remember this UTR so it cannot be used again
      try {
        await redis.sadd("used_bank_utrs", cleanUtr);
      } catch (e) {
        console.warn("Failed to store in used_bank_utrs:", e);
      }

      const savedOrder = await getOrder(orderId);
      const resolvedAmount = Number(body.amount) || savedOrder?.amount || amount;
      const resolvedQuantity = Math.max(1, Number(body.quantity) || savedOrder?.quantity || quantity);
      const resolvedProductId = productId || savedOrder?.productId;
      const resolvedProductName = productName || savedOrder?.productName;
      const resolvedCartItems = cartItems || savedOrder?.cartItems;

      // Fulfill order: Claim REAL credentials directly from product database inventory in Redis,
      // dispatch automated customer email, merchant notification, and Discord sale embed
      const result = await fulfillOrder({
        orderId,
        email,
        utr: confirmedUtr,
        senderName: fgSender || senderName || "UPI Customer",
        amount: resolvedAmount,
        quantity: resolvedQuantity,
        productId: resolvedProductId,
        productName: resolvedProductName,
        cartItems: resolvedCartItems,
      });

      if (!result.success && result.error) {
        return NextResponse.json(
          { error: result.error || "Failed to claim credentials from database." },
          { status: 400 }
        );
      }

      const deliveredCredentials = result.credentials || (result.credential ? [result.credential] : []);

      return NextResponse.json({
        success: true,
        status: "confirmed",
        orderId,
        utr: confirmedUtr,
        credentials: deliveredCredentials,
        credential: deliveredCredentials[0],
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Error in /api/payment/record:", err);
    return NextResponse.json(
      { error: "Internal server error while processing payment database record" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const order = history.find((o) => o.orderId === orderId);

    if (!order) {
      const fallback = await getOrder(orderId);
      if (fallback) {
        return NextResponse.json({
          success: true,
          order: {
            orderId: fallback.orderId,
            email: fallback.email,
            amount: fallback.amount,
            status: "pending",
          },
        });
      }
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, order });
  } catch (err) {
    console.error("Error in GET /api/payment/record:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
