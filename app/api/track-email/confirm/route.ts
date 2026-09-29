import { NextRequest, NextResponse } from "next/server";
import { markEmailOpened, getAllOrders } from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  let orderData = null;
  if (orderId) {
    const userAgent = req.headers.get("user-agent") || undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    try {
      orderData = await markEmailOpened(orderId, {
        userAgent,
        ip,
        manual: true,
      });
    } catch (err) {
      console.warn("Error marking receipt confirmed:", err);
    }

    if (!orderData) {
      const history = await getAllOrders();
      orderData = history.find((o) => o.orderId === orderId) || null;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt Confirmed &mdash; Get Your Account</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(135deg, #0c0a21 0%, #1a1640 50%, #110e2e 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #ffffff;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    }
    .badge-icon {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1));
      border: 1px solid rgba(16, 185, 129, 0.3);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      margin-bottom: 20px;
      box-shadow: 0 0 24px rgba(16, 185, 129, 0.2);
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.65);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .info-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px 20px;
      margin-bottom: 24px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: rgba(255, 255, 255, 0.5); }
    .info-val { font-weight: 600; color: #ffffff; font-family: monospace; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      background: #34d399;
      border-radius: 50%;
    }
    .btn {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      padding: 14px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }
    .btn:hover {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      transform: translateY(-1px);
    }
    .btn-secondary {
      display: block;
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 12px 20px;
      border-radius: 12px;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .footer-text {
      margin-top: 24px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.35);
    }
    @media (max-width: 480px) {
      body { padding: 16px; }
      .card { padding: 28px 18px; border-radius: 20px; }
      h1 { font-size: 20px; }
      p.subtitle { font-size: 13px; margin-bottom: 20px; }
      .info-box { padding: 12px 14px; margin-bottom: 20px; }
      .info-row { font-size: 12px; }
      .btn, .btn-secondary { font-size: 13px; padding: 12px 16px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge-icon">✅</div>
    <h1>Email Delivery Verified</h1>
    <p class="subtitle">
      Thank you! Your email receipt has been logged. Your Nitro booster accounts are active with full warranty coverage.
    </p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Order ID</span>
        <span class="info-val">${orderId || "N/A"}</span>
      </div>
      ${orderData?.email ? `
      <div class="info-row">
        <span class="info-label">Customer</span>
        <span class="info-val" style="font-family: inherit;">${orderData.email}</span>
      </div>` : ""}
      <div class="info-row">
        <span class="info-label">Receipt Status</span>
        <span class="status-pill"><span class="status-dot"></span> Confirmed & Received</span>
      </div>
      <div class="info-row">
        <span class="info-label">Warranty</span>
        <span class="info-val" style="color: #34d399; font-family: inherit;">Full Replacement Guarantee</span>
      </div>
      <div class="info-row">
        <span class="info-label">Verified At</span>
        <span class="info-val" style="font-size: 11px;">${new Date().toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}</span>
      </div>
    </div>

    <a href="${process.env.DISCORD_LINK || process.env.NEXT_PUBLIC_DISCORD_LINK || (APP_CONFIG.discordLink?.startsWith('http') ? APP_CONFIG.discordLink : '/discord')}" target="_blank" class="btn">
      💬 Join 24/7 Discord Support
    </a>
    <a href="/" class="btn-secondary">
      Return to Store
    </a>

    <p class="footer-text">
      Get Your Account &bull; Automated Delivery Verification
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
