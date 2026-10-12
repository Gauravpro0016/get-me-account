import { NextRequest, NextResponse } from "next/server";
import { markEmailOpened, getAllOrders, getAdminProfilePic } from "@/lib/fulfillment";
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

  const profilePic = (await getAdminProfilePic()) || "/admin-profile.jpg";
  const primaryTitle = (orderData as any)?.productName || APP_CONFIG.productName || "Trinitymart Digital Asset";
  const amountPaid = orderData?.amount || APP_CONFIG.price;
  const utrRef = orderData?.utr || "CONFIRMED_UPI_TX";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Official Invoice &amp; Delivery Receipt &mdash; Trinitymart</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: linear-gradient(135deg, #070913 0%, #101528 50%, #0b0d1b 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      color: #ffffff;
    }
    .card {
      background: rgba(18, 23, 38, 0.85);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 28px;
      padding: 44px 36px;
      max-width: 560px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
      position: relative;
    }
    .avatar-wrapper {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899);
      padding: 3px;
      margin: 0 auto 20px auto;
      box-shadow: 0 0 30px rgba(6, 182, 212, 0.45);
      display: inline-block;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      background: #0f172a;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(139, 92, 246, 0.2));
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 11px;
      font-weight: 800;
      padding: 5px 14px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .info-box {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(10, 15, 30, 0.95));
      border: 1.5px solid rgba(56, 189, 248, 0.2);
      border-radius: 18px;
      padding: 20px 22px;
      margin-bottom: 24px;
      text-align: left;
    }
    .info-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .info-title {
      font-size: 11px;
      font-weight: 800;
      color: #60a5fa;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: rgba(255, 255, 255, 0.55); font-weight: 500; }
    .info-val { font-weight: 700; color: #ffffff; font-family: monospace; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
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
    .btn-gradient {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #06b6d4 0%, #2563eb 50%, #7c3aed 100%);
      color: #ffffff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 800;
      padding: 14px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(6, 182, 212, 0.35);
      transition: all 0.2s ease;
      margin-bottom: 12px;
      border: none;
      cursor: pointer;
    }
    .btn-secondary {
      display: inline-block;
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.85);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      padding: 12px 20px;
      border-radius: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
      margin-bottom: 8px;
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .footer-text {
      margin-top: 24px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }
    @media (max-width: 480px) {
      body { padding: 12px; }
      .card { padding: 28px 18px; border-radius: 20px; }
      h1 { font-size: 22px; }
      p.subtitle { font-size: 13px; margin-bottom: 18px; }
      .info-box { padding: 14px 14px; margin-bottom: 18px; }
      .info-row { font-size: 12px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar-wrapper">
      <img src="${profilePic}" class="avatar-img" alt="Trinitymart Admin" onerror="this.src='/admin-profile.jpg'" />
    </div>

    <div>
      <span class="badge">🛡️ Verified Trinitymart Dispatcher</span>
    </div>

    <h1>Official Invoice &amp; Delivery Verified</h1>
    <p class="subtitle">
      Thank you for choosing Trinitymart! Your delivery receipt is logged and full replacement warranty is active.
    </p>

    <div class="info-box">
      <div class="info-header">
        <span class="info-title">📄 Official Invoice Summary</span>
        <span class="status-pill"><span class="status-dot"></span> Paid &amp; Delivered</span>
      </div>

      <div class="info-row">
        <span class="info-label">Invoice / Order ID</span>
        <span class="info-val" style="color: #38bdf8;">${orderId || "N/A"}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Product Name</span>
        <span class="info-val" style="font-family: inherit;">${primaryTitle}</span>
      </div>

      ${orderData?.email ? `
      <div class="info-row">
        <span class="info-label">Customer Email</span>
        <span class="info-val" style="font-family: inherit;">${orderData.email}</span>
      </div>` : ""}

      ${utrRef ? `
      <div class="info-row">
        <span class="info-label">Transaction Reference</span>
        <span class="info-val">${utrRef}</span>
      </div>` : ""}

      <div class="info-row">
        <span class="info-label">Amount Paid</span>
        <span class="info-val" style="color: #34d399; font-size: 15px;">₹${amountPaid}</span>
      </div>

      <div class="info-row">
        <span class="info-label">Warranty Status</span>
        <span class="info-val" style="color: #34d399; font-family: inherit;">Lifetime Replacement Active</span>
      </div>

      <div class="info-row">
        <span class="info-label">Verification Time</span>
        <span class="info-val" style="font-size: 11px;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
      </div>
    </div>

    <button onclick="window.print()" class="btn-gradient">
      🖨️ Print / Save Official Invoice
    </button>

    <a href="${process.env.DISCORD_LINK || process.env.NEXT_PUBLIC_DISCORD_LINK || (APP_CONFIG.discordLink?.startsWith('http') ? APP_CONFIG.discordLink : '/discord')}" target="_blank" class="btn-secondary">
      💬 Join 24/7 Discord Support
    </a>

    <a href="/" class="btn-secondary">
      Return to Storefront
    </a>

    <p class="footer-text">
      Trinitymart &bull; Automated Dispatch &bull; 24/7 Customer Support
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
