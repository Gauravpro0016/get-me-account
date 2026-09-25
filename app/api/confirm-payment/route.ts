import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getFulfilledCredential,
  getOrder,
  isAlreadySent,
} from "@/lib/fulfillment";

export const maxDuration = 45;

/**
 * Verify order status with FamGateway.
 * Checks both authoritative backend endpoint and public checkout-status fallback.
 */
async function checkFamGatewayOrderStatus(orderId: string): Promise<{
  status: "success" | "pending" | "expired" | "not_found";
  utr?: string;
  senderName?: string;
  amount?: number;
}> {
  const apiKey = process.env.FAMGATEWAY_API_KEY;

  // 1. Try authoritative verify-order endpoint if API key is present
  if (apiKey) {
    try {
      const res = await fetch(
        `https://famgateway.in/api/verify-order.php?api_key=${encodeURIComponent(
          apiKey
        )}&order_id=${encodeURIComponent(orderId)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          cache: "no-store",
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log(`FamGateway verify-order for ${orderId}:`, data);
        if (data.status === "success") {
          return {
            status: "success",
            utr: data.data?.utr || data.utr,
            senderName: data.data?.sender_name || data.sender_name,
            amount: Number(data.data?.amount || data.amount) || 25,
          };
        }
        if (data.status === "expired") {
          return { status: "expired" };
        }
      }
    } catch (err) {
      console.warn("verify-order endpoint error, falling back to checkout-status:", err);
    }
  }

  // 2. Fallback to public checkout-status endpoint
  try {
    const res = await fetch(
      `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(
        orderId
      )}`,
      { cache: "no-store" }
    );

    if (res.ok) {
      const data = await res.json();
      console.log(`FamGateway checkout-status for ${orderId}:`, data);
      if (data.status === "success") {
        return {
          status: "success",
          utr: data.utr,
          senderName: data.sender_name,
          amount: Number(data.amount) || 25,
        };
      }
      if (data.status === "expired") {
        return { status: "expired" };
      }
      if (data.status === "pending") {
        return { status: "pending" };
      }
    }
  } catch (err) {
    console.error("checkout-status endpoint error:", err);
  }

  return { status: "pending" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = ((body.orderId || body.order_id) as string)?.trim();
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    console.log("POST /api/confirm-payment received:", { orderId, email });

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    // Retrieve saved email from Redis if not provided
    if (!email) {
      const orderData = await getOrder(orderId);
      if (orderData?.email) {
        email = orderData.email;
      }
    }

    // 1. Check if already fulfilled (e.g. processed via Webhook earlier)
    const alreadySent = await isAlreadySent(orderId);
    if (alreadySent) {
      const credential = await getFulfilledCredential(orderId);
      return NextResponse.json({
        status: "confirmed",
        already_sent: true,
        credential: credential
          ? { email: credential.email, password: credential.password }
          : undefined,
      });
    }

    // 2. Check status with FamGateway
    const fgStatus = await checkFamGatewayOrderStatus(orderId);

    if (fgStatus.status === "success") {
      if (!email) {
        return NextResponse.json(
          { error: "Payment confirmed on FamGateway, but no email is linked to this order." },
          { status: 400 }
        );
      }

      // Fulfill order, claim credential, send email
      const result = await fulfillOrder({
        orderId,
        email,
        utr: fgStatus.utr,
        senderName: fgStatus.senderName,
        amount: fgStatus.amount || 25,
      });

      if (!result.success && result.error) {
        return NextResponse.json(
          { error: "Payment received, but credentials are currently out of stock. Support notified." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        status: "confirmed",
        credential: result.credential
          ? {
              email: result.credential.email,
              password: result.credential.password,
              token: result.credential.token,
              domain: result.credential.domain,
              twoFactorKey: result.credential.twoFactorKey,
              keyweb: result.credential.keyweb,
            }
          : undefined,
        credentials: result.credentials || (result.credential ? [result.credential] : []),
        utr: fgStatus.utr,
      });
    }

    if (fgStatus.status === "expired") {
      return NextResponse.json({
        status: "failed",
        reason: "UPI payment window expired (5 minutes). Please start a new payment.",
      });
    }

    // Still pending
    return NextResponse.json({ status: "pending" });
  } catch (err) {
    console.error("confirm-payment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId") || url.searchParams.get("order_id");
  const email = url.searchParams.get("email");

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  // Delegate to POST logic
  const pseudoReq = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ orderId, email }),
  });

  return POST(pseudoReq);
}
