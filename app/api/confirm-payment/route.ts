import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Vercel Serverless Function timeout (valid on Hobby: 1 to 300 seconds)
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

type Credential = {
  id: string;
  email: string;
  password: string;
  addedAt: string;
};

type AtlosStatus =
  | 0    // New / unpaid
  | 10   // Pending — tx in mempool, awaiting confirmations
  | 100  // Success — fully confirmed on-chain
  | 55   // Canceled
  | 59;  // Expired

// ─── Redis ───────────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";
const SENT_KEY = (orderId: string) => `sent:${orderId}`;

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

async function markAsSent(orderId: string): Promise<boolean> {
  const result = await redis.set(SENT_KEY(orderId), "1", {
    nx: true,
    ex: 60 * 60 * 24 * 7, // 7 days TTL
  });
  return result === "OK";
}

// ─── Nodemailer ───────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendCredentialEmail(
  email: string,
  orderId: string,
  credential: Credential
): Promise<void> {
  await transporter.sendMail({
    from: `"Get Your Account" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your Account Details Payment Confirmed",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Account Details</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);padding:36px 40px;text-align:center;">
                    <div style="font-size:36px;margin-bottom:8px;">&#10003;</div>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Payment Confirmed!</h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Your account is ready to use</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 40px;">
                    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                      Hi there,<br/>
                      Thank you for your purchase! Your payment has been successfully verified on the blockchain.
                    </p>
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:24px 0;">
                      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Payment Summary</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#374151;font-size:14px;padding:4px 0;">Payment ID</td>
                          <td style="color:#6366f1;font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${orderId}</td>
                        </tr>
                        <tr>
                          <td style="color:#374151;font-size:14px;padding:4px 0;">Email</td>
                          <td style="color:#374151;font-size:14px;font-weight:600;text-align:right;">${email}</td>
                        </tr>
                        <tr>
                          <td style="color:#374151;font-size:14px;padding:4px 0;">Amount Paid</td>
                          <td style="color:#059669;font-size:14px;font-weight:700;text-align:right;">Rs.25</td>
                        </tr>
                      </table>
                    </div>
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px 24px;margin:24px 0;">
                      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Your Account Details</p>
                      <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.8;">
                        <strong>Email:</strong> ${credential.email}<br/>
                        <strong>Password:</strong> ${credential.password}
                      </p>
                    </div>
                    <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                      If you have any questions, reply to this email. Keep it safe.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;">Get Your Account - Secured by Atlos Crypto Gateway</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
}

// ─── Atlos API ────────────────────────────────────────────────────────────────

const ATLOS_API_BASE = "https://api.atlos.io/gateway/rest/";

/**
 * Try Payment/Get with a given id. Returns the status or null.
 */
async function fetchPaymentStatus(id: string): Promise<{ status: AtlosStatus; raw: Record<string, unknown> } | null> {
  try {
    const res = await fetch(`${ATLOS_API_BASE}Payment/Get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: process.env.ATLOS_API_SECRET!,
      },
      body: JSON.stringify({ PaymentId: id }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.Status !== undefined) {
        console.log(`Payment/Get (${id}) => Status:${data.Status}`);
        return { status: data.Status as AtlosStatus, raw: data };
      }
    } else {
      console.warn(`Atlos Payment/Get returned ${res.status} for id=${id}`);
    }
  } catch (err) {
    console.error("Atlos Payment/Get error:", err);
  }
  return null;
}

/**
 * Search Transaction/List for a transaction whose OrderId or Txid matches.
 * Returns the Atlos PaymentId + status if found.
 */
async function findByOrderOrTxId(
  orderId: string
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
    const items: Array<Record<string, unknown>> = Array.isArray(data)
      ? data
      : (data?.Items ?? data?.items ?? []);

    const normalized = orderId.trim().toLowerCase();
    for (const item of items) {
      const itemOrderId = String(item.OrderId ?? item.orderId ?? "").trim().toLowerCase();
      const itemTxId = String(item.Txid ?? item.TxId ?? "").trim().toLowerCase();
      const itemPaymentId = String(item.PaymentId ?? "");
      if ((itemOrderId && itemOrderId === normalized) || (itemTxId && itemTxId === normalized)) {
        console.log(`Transaction/List match: PaymentId=${itemPaymentId} Status=${item.Status}`);
        return { paymentId: itemPaymentId, status: (item.Status ?? 0) as AtlosStatus };
      }
    }
  } catch (err) {
    console.error("Atlos Transaction/List error:", err);
  }
  return null;
}

/**
 * Main lookup: try Payment/Get with paymentId, then orderId, then scan Transaction/List.
 */
async function getAtlosPaymentStatus(paymentId: string, orderId?: string): Promise<AtlosStatus | null> {
  // 1. Try with the paymentId directly
  const r1 = await fetchPaymentStatus(paymentId);
  if (r1) return r1.status;

  // 2. Try with the orderId if different
  if (orderId && orderId !== paymentId) {
    const r2 = await fetchPaymentStatus(orderId);
    if (r2) return r2.status;
  }

  // 3. Last resort: scan Transaction/List for the orderId
  //    (covers the case where orderId is our custom base64_timestamp key)
  const searchKey = orderId || paymentId;
  const match = await findByOrderOrTxId(searchKey);
  if (match) {
    // If we found it via list, re-confirm with Payment/Get for freshest status
    if (match.paymentId) {
      const r3 = await fetchPaymentStatus(match.paymentId);
      if (r3) return r3.status;
    }
    return match.status;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const orderId = (body.orderId || body.paymentId || "")?.toString().trim();
    const paymentId = (body.paymentId || body.orderId || "")?.toString().trim();

    console.log("POST /api/confirm-payment received:", { email, orderId, paymentId });

    if (!email || !orderId) {
      console.warn("Missing email or orderId:", { email, orderId });
      return NextResponse.json(
        { error: "Missing required fields (email or orderId)" },
        { status: 400 }
      );
    }

    // Validate orderId integrity if email prefix is present
    if (orderId.includes("_")) {
      try {
        const [encodedEmail] = orderId.split("_");
        const decodedEmail = Buffer.from(encodedEmail, "base64").toString("utf8");
        if (
          decodedEmail &&
          decodedEmail.includes("@") &&
          decodedEmail.toLowerCase() !== email.toLowerCase()
        ) {
          console.warn("orderId/email mismatch:", { email, decodedEmail, orderId });
          return NextResponse.json({ error: "Invalid order email" }, { status: 403 });
        }
      } catch (err) {
        console.warn("Could not decode orderId prefix, skipping integrity check:", err);
      }
    }

    // Check if credentials have already been delivered for this order
    const alreadySent = await redis.get(SENT_KEY(orderId));
    if (alreadySent) {
      console.log("Credentials already delivered for orderId:", orderId);
      return NextResponse.json({ status: "confirmed", already_sent: true });
    }

    // Query Atlos for current on-chain status
    const atlosStatus = await getAtlosPaymentStatus(paymentId, orderId);
    console.log(`Atlos status for ${paymentId}:`, atlosStatus);

    // Status 100 = Fully confirmed on-chain
    if (atlosStatus === 100) {
      // Idempotency lock: only one process will succeed in marking as sent
      const isFirst = await markAsSent(orderId);
      if (!isFirst) {
        return NextResponse.json({ status: "confirmed", already_sent: true });
      }

      // Claim a credential from the pool
      const credential = await claimCredential();
      if (!credential) {
        // Rollback lock so it can be fulfilled when restocked
        await redis.del(SENT_KEY(orderId));
        console.error("Credential pool is empty.");
        return NextResponse.json(
          { error: "No credentials available in stock. Please contact support." },
          { status: 503 }
        );
      }

      // Send the email with account details
      await sendCredentialEmail(email, orderId, credential);
      console.log(`Credentials delivered to ${email} for orderId=${orderId}`);

      return NextResponse.json({ status: "confirmed" });
    }

    // Status 55 = Canceled
    if (atlosStatus === 55) {
      return NextResponse.json({ status: "failed", reason: "Payment was canceled." });
    }

    // Status 59 = Expired
    if (atlosStatus === 59) {
      return NextResponse.json({ status: "failed", reason: "Payment window expired." });
    }

    // Status 10 (pending in mempool) or 0 (new) or awaiting blockchain
    return NextResponse.json({ status: "pending", atlosStatus: atlosStatus ?? "awaiting" });
  } catch (err) {
    console.error("confirm-payment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
