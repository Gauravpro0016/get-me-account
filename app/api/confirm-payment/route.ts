import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getFulfilledCredential,
  getFulfilledCredentials,
  getOrder,
  isAlreadySent,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

/**
 * Fast FamGateway status check.
 * Prioritizes the snappy checkout-status.php endpoint (<400ms) with a 2.8s timeout,
 * and falls back to verify-order.php with a 2.8s timeout so requests never block.
 */
async function checkFamGatewayOrderStatus(orderId: string): Promise<{
  status: "success" | "pending" | "expired" | "not_found";
  utr?: string;
  senderName?: string;
  amount?: number;
}> {
  const apiKey = process.env.FAMGATEWAY_API_KEY;

  // 1. Fast checkout-status check (<400ms typical)
  try {
    const res = await fetch(
      `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(2800),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.status === "success" || data.status === "COMPLETED") {
        return {
          status: "success",
          utr: data.utr,
          senderName: data.sender_name,
          amount: Number(data.amount) || undefined,
        };
      }
      if (data.status === "expired" || data.status === "FAILED") {
        return { status: "expired" };
      }
      if (data.status === "pending") {
        return { status: "pending" };
      }
    }
  } catch (err: any) {
    // Timeout or network glitch — continue to fallback
  }

  // 2. Authoritative verify-order endpoint with safe 2.8s timeout
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
          signal: AbortSignal.timeout(2800),
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          return {
            status: "success",
            utr: data.data?.utr || data.utr,
            senderName: data.data?.sender_name || data.sender_name,
            amount: Number(data.data?.amount || data.amount) || undefined,
          };
        }
        if (data.status === "expired") {
          return { status: "expired" };
        }
      }
    } catch (err) {
      // Safely ignore timeout or network issue
    }
  }

  return { status: "pending" };
}

/**
 * Fast Atlos Crypto status check.
 * Checks if cryptocurrency payment for this order was broadcast in mempool or confirmed on blockchain.
 */
async function checkAtlosOrderStatus(orderId: string): Promise<{
  status: "success" | "mempool_detected" | "pending";
  txid?: string;
  amount?: number;
}> {
  const atlosSecret =
    process.env.ATLOS_API_SECRET || "6UCqzHHDmb5f0NbXOGCmLKFc2PVIMEYB";
  const merchantId =
    process.env.ATLOS_MERCHANT_ID ||
    process.env.ATLOS_MERCHANT_ID ||
    "ADK7QABYR0";

  if (!atlosSecret) {
    console.warn("checkAtlosOrderStatus: ATLOS_API_SECRET is not set in environment.");
    return { status: "pending" };
  }

  try {
    const res = await fetch("https://api.atlos.io/gateway/rest/Transaction/List", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: atlosSecret,
      },
      body: JSON.stringify({ MerchantId: merchantId, OrderId: orderId }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const transactions = Array.isArray(data)
        ? data
        : data.Transactions || data.transactions || data.items || [];
      const match = transactions.find(
        (t: any) =>
          t.OrderId === orderId ||
          t.orderId === orderId ||
          t.order_id === orderId
      );

      if (match) {
        // Status 100 = completed, Status 10 = mempool detected
        if (
          match.Status === 100 ||
          match.status === "success" ||
          String(match.Status) === "100"
        ) {
          return {
            status: "success",
            txid: match.BlockchainHash || match.Txid || match.txid || match.hash,
            amount: Number(match.PaidAmount || match.OrderAmount || match.amount),
          };
        }
        if (match.Status === 10 || match.status === "pending_mempool") {
          return {
            status: "mempool_detected",
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("checkAtlosOrderStatus fetch error:", err?.message || err);
  }

  return { status: "pending" };
}

/**
 * Shared order confirmation pipeline for both GET and POST requests.
 */
async function handleOrderConfirmation(orderId: string, emailParam?: string, methodParam?: string) {
  try {
    let email = emailParam ? emailParam.trim().toLowerCase() : "";

    const orderData = await getOrder(orderId);
    if (!email && orderData?.email) {
      email = orderData.email.trim().toLowerCase();
    }

    // 1. Check if already fulfilled (e.g. processed via Webhook earlier)
    const alreadySent = await isAlreadySent(orderId);
    if (alreadySent) {
      const credentialsList = await getFulfilledCredentials(orderId);
      const credential = credentialsList[0] || null;
      return NextResponse.json({
        status: "confirmed",
        already_sent: true,
        credential: credential || undefined,
        credentials: credentialsList,
      });
    }

    const isCrypto =
      methodParam === "crypto" ||
      orderId.startsWith("ORD-CR-") ||
      orderId.startsWith("crypto_");

    // 2. Crypto Order Check with Atlos Gateway
    if (isCrypto) {
      const atlosStatus = await checkAtlosOrderStatus(orderId);

      if (atlosStatus.status === "success") {
        if (!email) {
          return NextResponse.json(
            { error: "Crypto payment confirmed, but no delivery email is linked to this order." },
            { status: 400 }
          );
        }

        const inrRate = APP_CONFIG.inrToUsdRate || 0.0118;
        const convertedInr = atlosStatus.amount ? Number((atlosStatus.amount / inrRate).toFixed(0)) : APP_CONFIG.price;

        const result = await fulfillOrder({
          orderId,
          email,
          utr: atlosStatus.txid ? `CRYPTO:${atlosStatus.txid}` : undefined,
          amount: orderData?.amount || convertedInr,
          quantity: orderData?.quantity || 1,
          productId: orderData?.productId,
          productName: orderData?.productName,
          cartItems: orderData?.cartItems,
        });

        if (!result.success && result.error) {
          return NextResponse.json(
            { error: "Payment received, but credentials are currently out of stock. Support notified." },
            { status: 503 }
          );
        }

        return NextResponse.json({
          status: "confirmed",
          credential: result.credential || undefined,
          credentials: result.credentials || (result.credential ? [result.credential] : []),
          utr: atlosStatus.txid,
        });
      }

      if (atlosStatus.status === "mempool_detected") {
        return NextResponse.json({
          status: "mempool_detected",
          message: "Transaction detected in mempool! Confirming on blockchain...",
        });
      }

      return NextResponse.json({ status: "pending" });
    }

    // 3. UPI Order Check with FamGateway
    const fgStatus = await checkFamGatewayOrderStatus(orderId);

    if (fgStatus.status === "success") {
      if (!email) {
        return NextResponse.json(
          { error: "Payment confirmed on FamGateway, but no email is linked to this order." },
          { status: 400 }
        );
      }

      // Fulfill order, claim credentials, send email
      const result = await fulfillOrder({
        orderId,
        email,
        utr: fgStatus.utr,
        senderName: fgStatus.senderName,
        amount: orderData?.amount || fgStatus.amount || APP_CONFIG.price,
        quantity: orderData?.quantity || 1,
        productId: orderData?.productId,
        productName: orderData?.productName,
        cartItems: orderData?.cartItems,
      });

      if (!result.success && result.error) {
        return NextResponse.json(
          { error: "Payment received, but credentials are currently out of stock. Support notified." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        status: "confirmed",
        credential: result.credential || undefined,
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
  } catch (err: any) {
    console.error("handleOrderConfirmation error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error", stack: err?.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = ((body.orderId || body.order_id) as string)?.trim();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const method = typeof body.method === "string" ? body.method.trim().toLowerCase() : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    return handleOrderConfirmation(orderId, email, method);
  } catch (err) {
    console.error("POST /api/confirm-payment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = (url.searchParams.get("orderId") || url.searchParams.get("order_id"))?.trim();
    const email = url.searchParams.get("email")?.trim().toLowerCase();
    const method = url.searchParams.get("method")?.trim().toLowerCase();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    return handleOrderConfirmation(orderId, email, method);
  } catch (err: any) {
    console.error("GET /api/confirm-payment error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error", stack: err?.stack }, { status: 500 });
  }
}
