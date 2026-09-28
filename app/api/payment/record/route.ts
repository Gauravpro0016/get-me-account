import { NextRequest, NextResponse } from "next/server";
import {
  recordNewOrder,
  fulfillOrder,
  markOrderConfirmedInHistory,
  getOrder,
  sendCredentialEmail,
  storeFulfilledCredentials,
  Credential,
  redis,
  ORDERS_HISTORY_KEY,
  StoredOrder,
} from "@/lib/fulfillment";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const amount = Number(body.amount) || 25;
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

    // 3. Strict Gateway Verification with FamGateway API
    // Ensure payment actually settled in merchant bank account
    const apiKey = process.env.FAMGATEWAY_API_KEY;
    let gatewayVerified = false;
    let fgUtr: string | undefined = undefined;
    let fgSender: string | undefined = undefined;

    if (apiKey) {
      // Method A: Check authoritative verify-order endpoint
      try {
        const fgRes = await fetch(
          `https://famgateway.in/api/verify-order.php?api_key=${encodeURIComponent(
            apiKey
          )}&order_id=${encodeURIComponent(orderId)}`,
          {
            headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            cache: "no-store",
          }
        );
        if (fgRes.ok) {
          const fgData = await fgRes.json();
          if (fgData.status === "success") {
            gatewayVerified = true;
            fgUtr = fgData.data?.utr || fgData.utr;
            fgSender = fgData.data?.sender_name || fgData.sender_name;
          }
        }
      } catch (e) {
        console.warn("FamGateway verify error:", e);
      }

      // Method B: Fallback to checkout-status
      if (!gatewayVerified) {
        try {
          const csRes = await fetch(
            `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(
              orderId
            )}`,
            { cache: "no-store" }
          );
          if (csRes.ok) {
            const csData = await csRes.json();
            if (csData.status === "success") {
              gatewayVerified = true;
              fgUtr = csData.utr;
              fgSender = csData.sender_name;
            }
          }
        } catch (e) {
          console.warn("FamGateway checkout-status error:", e);
        }
      }
    }

    // Require genuine gateway bank verification
    if (!gatewayVerified) {
      return NextResponse.json(
        {
          error: `Payment verification failed: No matching bank settlement found on FamGateway for Order "${orderId}". Please ensure you completed payment in your UPI app and try again in 30 seconds.`,
        },
        { status: 400 }
      );
    }

    const confirmedUtr = fgUtr || cleanUtr;

    // Remember this UTR so it cannot be used again
    try {
      await redis.sadd("used_bank_utrs", cleanUtr);
    } catch (e) {
      console.warn("Failed to store in used_bank_utrs:", e);
    }

      // Fulfill order: Claim REAL credentials directly from product database inventory in Redis
      const result = await fulfillOrder({
        orderId,
        email,
        utr: confirmedUtr,
        senderName: senderName || "UPI Customer",
        amount,
        quantity,
        productId,
        productName,
        cartItems,
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
