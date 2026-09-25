import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

type Credential = {
  id: string;
  email: string;
  password: string;
  addedAt: string;
};

type AtlosStatus = 0 | 10 | 100 | 55 | 59;

// ─── Redis ───────────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";

async function readPool(): Promise<Credential[]> {
  const pool = await redis.get<Credential[]>(POOL_KEY);
  return pool ?? [];
}

async function writePool(pool: Credential[]): Promise<void> {
  await redis.set(POOL_KEY, pool);
}

async function claimCredential(): Promise<Credential | null> {
  const pool = await readPool();
  if (pool.length === 0) return null;
  const [claimed, ...rest] = pool;
  await writePool(rest);
  return claimed;
}

// ─── Nodemailer ──────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendCredentialEmail(
  email: string,
  txHash: string,
  credential: Credential
): Promise<void> {
  await transporter.sendMail({
    from: `"Get Your Account" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your Account Details - Payment Confirmed",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Account Details</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#7c3aed);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Payment Confirmed!</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your account is ready to use</p>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="color:#374151;font-size:15px;line-height:1.6;">Hi there,<br/>Your blockchain transaction has been verified. Your account details are below.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:24px 0;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;">Payment Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="color:#374151;font-size:14px;">Tx Hash</td><td style="color:#6366f1;font-size:11px;font-weight:600;text-align:right;font-family:monospace;word-break:break-all;">${txHash}</td></tr>
              <tr><td style="color:#374151;font-size:14px;padding:4px 0;">Email</td><td style="color:#374151;font-size:14px;font-weight:600;text-align:right;">${email}</td></tr>
              <tr><td style="color:#374151;font-size:14px;">Amount Paid</td><td style="color:#059669;font-size:14px;font-weight:700;text-align:right;">Rs.25</td></tr>
            </table>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px 24px;margin:24px 0;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3b82f6;text-transform:uppercase;">Your Account Details</p>
            <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.8;"><strong>Email:</strong> ${credential.email}<br/><strong>Password:</strong> ${credential.password}</p>
          </div>
          <p style="color:#6b7280;font-size:13px;">If you have any questions, reply to this email. Keep it safe.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Get Your Account - Secured by Atlos Crypto Gateway</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// ─── Atlos API ────────────────────────────────────────────────────────────────

const ATLOS_API_BASE = "https://api.atlos.io/gateway/rest/";

/**
 * Search Atlos Transaction/List for a transaction matching the given blockchain tx hash.
 * Returns the internal PaymentId + status if found, or null.
 */
async function findPaymentIdByTxHash(
  txHash: string
): Promise<{ paymentId: string; status: AtlosStatus } | null> {
  try {
    const res = await fetch(`${ATLOS_API_BASE}Transaction/List`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: process.env.ATLOS_API_SECRET!,
      },
      body: JSON.stringify({ PageSize: 50, PageNumber: 1 }),
    });

    if (!res.ok) {
      console.warn(`Atlos Transaction/List returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const items: Array<{
      Txid?: string;
      TxId?: string;
      PaymentId?: string;
      Status?: number;
    }> = Array.isArray(data) ? data : (data?.Items ?? data?.items ?? []);

    const normalizedHash = txHash.trim().toLowerCase();

    for (const item of items) {
      const itemTxId = (item.Txid || item.TxId || "").trim().toLowerCase();
      if (itemTxId && itemTxId === normalizedHash) {
        return {
          paymentId: item.PaymentId ?? "",
          status: (item.Status ?? 0) as AtlosStatus,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("Atlos Transaction/List error:", err);
    return null;
  }
}

/**
 * Verify payment status by Atlos internal PaymentId.
 */
async function getAtlosPaymentStatus(
  paymentId: string
): Promise<AtlosStatus | null> {
  try {
    const res = await fetch(`${ATLOS_API_BASE}Payment/Get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: process.env.ATLOS_API_SECRET!,
      },
      body: JSON.stringify({ PaymentId: paymentId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.Status !== undefined) return data.Status as AtlosStatus;
    }
  } catch (err) {
    console.error("Atlos Payment/Get error:", err);
  }
  return null;
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const txHash =
      typeof body.txHash === "string" ? body.txHash.trim() : "";

    console.log("POST /api/verify-tx received:", { email, txHash });

    if (!email || !txHash) {
      return NextResponse.json(
        { error: "Missing required fields (email or txHash)" },
        { status: 400 }
      );
    }

    // Idempotency key based on the tx hash
    const sentKey = `txhash:${txHash.toLowerCase()}`;

    const alreadySent = await redis.get(sentKey);
    if (alreadySent) {
      console.log("Already delivered for txHash:", txHash);
      return NextResponse.json({ status: "confirmed", already_sent: true });
    }

    // Step 1: Find Atlos PaymentId by searching recent transactions
    console.log("Searching Atlos transactions for txHash:", txHash);
    const txMatch = await findPaymentIdByTxHash(txHash);

    if (!txMatch) {
      console.warn("No Atlos transaction found for txHash:", txHash);
      return NextResponse.json(
        {
          status: "not_found",
          error:
            "Transaction not found on Atlos. It may still be propagating - please wait a few minutes and try again.",
        },
        { status: 404 }
      );
    }

    console.log("Found Atlos PaymentId:", txMatch.paymentId, "Status:", txMatch.status);

    // Step 2: Double-check with Payment/Get for fresh status
    let finalStatus: AtlosStatus | null = txMatch.status;
    if (txMatch.paymentId) {
      const freshStatus = await getAtlosPaymentStatus(txMatch.paymentId);
      if (freshStatus !== null) finalStatus = freshStatus;
    }

    if (finalStatus === 55) {
      return NextResponse.json({ status: "failed", reason: "Payment was canceled." });
    }
    if (finalStatus === 59) {
      return NextResponse.json({ status: "failed", reason: "Payment window expired." });
    }
    if (finalStatus !== 100) {
      return NextResponse.json({
        status: "pending",
        atlosStatus: finalStatus ?? "awaiting",
        message:
          "Transaction found but not yet fully confirmed on-chain. Please try again in a few minutes.",
      });
    }

    // Step 3: Idempotency lock
    const isFirst = await redis.set(sentKey, "1", {
      nx: true,
      ex: 60 * 60 * 24 * 7,
    });

    if (!isFirst) {
      return NextResponse.json({ status: "confirmed", already_sent: true });
    }

    // Step 4: Claim credential
    const credential = await claimCredential();
    if (!credential) {
      await redis.del(sentKey);
      console.error("Credential pool is empty.");
      return NextResponse.json(
        { error: "No credentials available in stock. Please contact support." },
        { status: 503 }
      );
    }

    // Step 5: Send email with account details
    await sendCredentialEmail(email, txHash, credential);
    console.log(`Credentials delivered to ${email} for txHash=${txHash}`);

    return NextResponse.json({ status: "confirmed" });
  } catch (err) {
    console.error("verify-tx error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
