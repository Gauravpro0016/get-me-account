import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getFulfilledCredential,
  getFulfilledCredentials,
  getOrder,
  isAlreadySent,
  checkFamGatewayOrderStatus,
  checkAtlosOrderStatus,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

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
      if (credentialsList && credentialsList.length > 0) {
        const credential = credentialsList[0] || null;
        return NextResponse.json({
          status: "confirmed",
          already_sent: true,
          credential: credential || undefined,
          credentials: credentialsList,
        });
      }
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
    return NextResponse.json({ error: "Internal server error during payment verification" }, { status: 500 });
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
    return NextResponse.json({ error: "Internal server error during payment verification" }, { status: 500 });
  }
}
