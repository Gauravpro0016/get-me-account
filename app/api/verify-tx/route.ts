import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getFulfilledCredential,
  getOrder,
  isAlreadySent,
} from "@/lib/fulfillment";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const queryId =
      typeof body.txHash === "string"
        ? body.txHash.trim()
        : typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    console.log("POST /api/verify-tx received:", { email, queryId });

    if (!email || !queryId) {
      return NextResponse.json(
        { error: "Both email and Order ID / UPI UTR are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAMGATEWAY_API_KEY;

    // Check if already fulfilled
    if (await isAlreadySent(queryId)) {
      const cred = await getFulfilledCredential(queryId);
      return NextResponse.json({
        status: "confirmed",
        already_sent: true,
        credential: cred
          ? {
              email: cred.email,
              password: cred.password,
              token: cred.token,
              domain: cred.domain,
              twoFactorKey: cred.twoFactorKey,
              keyweb: cred.keyweb,
            }
          : undefined,
        credentials: cred ? [cred] : [],
      });
    }

    // Check FamGateway
    let verified = false;
    let finalUtr: string | undefined = undefined;
    let senderName: string | undefined = undefined;

    if (apiKey) {
      try {
        const res = await fetch(
          `https://famgateway.in/api/verify-order.php?api_key=${encodeURIComponent(
            apiKey
          )}&order_id=${encodeURIComponent(queryId)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            verified = true;
            finalUtr = data.data?.utr || data.utr;
            senderName = data.data?.sender_name || data.sender_name;
          }
        }
      } catch (err) {
        console.warn("verify-order error in verify-tx:", err);
      }
    }

    if (!verified) {
      // Try checkout-status.php
      try {
        const res = await fetch(
          `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(
            queryId
          )}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "success") {
            verified = true;
            finalUtr = data.utr;
            senderName = data.sender_name;
          }
        }
      } catch (err) {
        console.warn("checkout-status error in verify-tx:", err);
      }
    }

    if (verified) {
      const result = await fulfillOrder({
        orderId: queryId,
        email,
        utr: finalUtr,
        senderName,
        amount: 25,
      });

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
        utr: finalUtr,
      });
    }

    return NextResponse.json({
      status: "pending",
      message:
        "Payment not yet confirmed on FamGateway. Please allow 1-2 minutes for bank receipt detection or check your Order ID.",
    });
  } catch (err) {
    console.error("verify-tx error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
