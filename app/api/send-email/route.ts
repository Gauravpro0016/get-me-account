import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

type Credential = {
  id: string;
  email: string;
  password: string;
  addedAt: string;
};

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

/** Pick and atomically remove the first credential from the pool. Returns null if empty. */
async function claimCredential(): Promise<Credential | null> {
  const pool = await readPool();
  if (pool.length === 0) return null;
  const [claimed, ...rest] = pool;
  await writePool(rest);
  return claimed;
}

// Gmail SMTP transporter — uses App Password (not your real Gmail password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: NextRequest) {
  try {
    const { email, paymentId } = await req.json();

    if (!email || !paymentId) {
      return NextResponse.json(
        { error: "Missing email or paymentId" },
        { status: 400 }
      );
    }

    // ── Pick a credential from the pool ──────────────────────────────────
    const credential = await claimCredential();

    if (!credential) {
      console.error("Credential pool is empty — cannot deliver account details.");
      return NextResponse.json(
        { error: "No credentials available. Please contact support." },
        { status: 503 }
      );
    }

    await transporter.sendMail({
      from: `"Get Your Account" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "✅ Your Account Details — Payment Confirmed",
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

                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#6366f1,#7c3aed);padding:36px 40px;text-align:center;">
                      <div style="font-size:36px;margin-bottom:8px;">✅</div>
                      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                        Payment Confirmed!
                      </h1>
                      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                        Your account is ready to use
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;">
                      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                        Hi there 👋,<br/>
                        Thank you for your purchase! Your payment has been successfully verified and your account details are below.
                      </p>

                      <!-- Payment Info Box -->
                      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;margin:24px 0;">
                        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">
                          Payment Summary
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="color:#374151;font-size:14px;padding:4px 0;">Payment ID</td>
                            <td style="color:#6366f1;font-size:14px;font-weight:600;text-align:right;font-family:monospace;">${paymentId}</td>
                          </tr>
                          <tr>
                            <td style="color:#374151;font-size:14px;padding:4px 0;">Email</td>
                            <td style="color:#374151;font-size:14px;font-weight:600;text-align:right;">${email}</td>
                          </tr>
                          <tr>
                            <td style="color:#374151;font-size:14px;padding:4px 0;">Amount Paid</td>
                            <td style="color:#059669;font-size:14px;font-weight:700;text-align:right;">₹25</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Account Details Box -->
                      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px 24px;margin:24px 0;">
                        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">
                          Your Account Details
                        </p>
                        <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.8;">
                          <strong>Email:</strong> ${credential.email}<br/>
                          <strong>Password:</strong> ${credential.password}
                        </p>
                      </div>

                      <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
                        If you have any questions, reply to this email. Keep it safe — it contains your account credentials.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;">
                        © ${new Date().getFullYear()} Get Your Account · Secured by Razorpay
                      </p>
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
