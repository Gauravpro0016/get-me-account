import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Tell Next.js/Vercel this route may run for up to 11 minutes
// (our polling window is 10 min — this gives a 1-min buffer)
export const maxDuration = 660;

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
    ex: 60 * 60 * 24 * 7,
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
const POLL_INTERVAL_MS = 6000;
const MAX_WAIT_MS = 10 * 60 * 1000;

async function getAtlosPaymentStatus(paymentId: string): Promise<AtlosStatus | null> {
  try {
    const res = await fetch(`${ATLOS_API_BASE}Payment/Get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: process.env.ATLOS_API_SECRET!,
      },
      body: JSON.stringify({ PaymentId: paymentId }),
    });
    if (!res.ok) {
      console.warn(`Atlos API returned ${res.status} for PaymentId=${paymentId}`);
      return null;
    }
    const data = await res.json();
    return data?.Status ?? null;
  } catch (err) {
    console.error("Atlos API fetch error:", err);
    return null;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { email, orderId, paymentId } = await req.json();

    if (!email || !orderId || !paymentId) {
      return NextResponse.json(
        { error: "Missing email, orderId, or paymentId" },
        { status: 400 }
      );
    }

    // Validate orderId integrity
    try {
      const [encodedEmail] = orderId.split("_");
      const decodedEmail = Buffer.from(encodedEmail, "base64").toString("utf8");
      if (decodedEmail.toLowerCase() !== email.toLowerCase()) {
        console.warn("orderId/email mismatch:", { email, orderId });
        return NextResponse.json({ error: "Invalid order" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Malformed orderId" }, { status: 400 });
    }

    // Idempotency guard — prevent double-delivery
    const isFirstSend = await markAsSent(orderId);
    if (!isFirstSend) {
      console.log("Duplicate request for orderId:", orderId);
      return NextResponse.json({ status: "already_sent" });
    }

    // Poll Atlos until confirmed or failed
    const deadline = Date.now() + MAX_WAIT_MS;
    let atlosStatus: AtlosStatus | null = null;

    while (Date.now() < deadline) {
      atlosStatus = await getAtlosPaymentStatus(paymentId);
      console.log(`Atlos status for ${paymentId}:`, atlosStatus);

      if (atlosStatus === 100) break;
      if (atlosStatus === 55 || atlosStatus === 59) break;

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    if (atlosStatus !== 100) {
      await redis.del(SENT_KEY(orderId));
      const reason =
        atlosStatus === 55
          ? "Payment was canceled."
          : atlosStatus === 59
          ? "Payment expired."
          : "Payment not confirmed within the allowed time.";
      return NextResponse.json({ status: "failed", reason }, { status: 402 });
    }

    // Claim a credential from the pool
    const credential = await claimCredential();
    if (!credential) {
      await redis.del(SENT_KEY(orderId));
      console.error("Credential pool is empty.");
      return NextResponse.json(
        { error: "No credentials available. Please contact support." },
        { status: 503 }
      );
    }

    // Send the email
    await sendCredentialEmail(email, orderId, credential);
    console.log(`Credentials delivered to ${email} for orderId=${orderId}`);

    return NextResponse.json({ status: "confirmed" });
  } catch (err) {
    console.error("confirm-payment error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
