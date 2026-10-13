import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/telegram";
import {
  getAllOrders,
  readPool,
  manualFulfillOrder,
  getOrderById,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  return NextResponse.json({
    status: "active",
    bot: "TrinityMart Telegram Assistant",
    webhook: "Ready for Telegram updates",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json().catch(() => null);
    if (!update || !update.message) {
      return NextResponse.json({ ok: true });
    }

    const { message } = update;
    const chatId = String(message.chat?.id || "");
    const text = (message.text || "").trim();

    if (!text) {
      return NextResponse.json({ ok: true });
    }

    const config = await getTelegramConfig();
    const authorizedChatId = String(config.chatId || "").trim();

    // Security check: Ignore commands from unauthorized users
    if (authorizedChatId && chatId !== authorizedChatId) {
      console.warn(`[TELEGRAM BOT] Unauthorized message from chatId ${chatId}: ${text}`);
      return NextResponse.json({ ok: true });
    }

    const command = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1);

    // ── Command: /start or /help ─────────────────────────────────────────────
    if (command === "/start" || command === "/help") {
      const helpMsg = [
        `🤖 <b>TrinityMart Admin Assistant</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `Welcome! Use these commands to manage your digital store directly from Telegram:`,
        ``,
        `📊 <b>/stock</b> — Check real-time inventory levels`,
        `🛒 <b>/orders</b> — Today's sales & revenue breakdown`,
        `💰 <b>/revenue</b> — All-time earnings report (INR & USD)`,
        `⏳ <b>/pending</b> — View orders awaiting payment`,
        `⚡ <b>/fulfill &lt;orderId&gt;</b> — Manually fulfill order & email keys`,
        `ℹ️ <b>/help</b> — Display this help menu`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `<i>Connected to TrinityMart Virtual Dispatch</i>`,
      ].join("\n");

      await sendTelegramMessage(helpMsg);
      return NextResponse.json({ ok: true });
    }

    // ── Command: /stock ──────────────────────────────────────────────────────
    if (command === "/stock") {
      const customProducts = (await redis.get<any[]>("trinitymart_custom_products")) || [];
      const legacyPool = await readPool();

      const lines = [
        `📦 <b>LIVE INVENTORY REPORT</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
      ];

      if (customProducts.length > 0) {
        customProducts.forEach((prod) => {
          const invCount = Array.isArray(prod.inventory) ? prod.inventory.length : prod.stockCount || 0;
          const statusIcon = invCount > 5 ? "🟢" : invCount > 0 ? "🟡" : "🔴";
          lines.push(`${statusIcon} <b>${prod.name || prod.id}:</b> <code>${invCount} units</code>`);
        });
      }

      lines.push(`🔷 <b>Legacy Pool (Booster/Nitro):</b> <code>${legacyPool.length} units</code>`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🕒 <i>As of ${new Date().toLocaleTimeString()}</i>`);

      await sendTelegramMessage(lines.join("\n"));
      return NextResponse.json({ ok: true });
    }

    // ── Command: /orders ─────────────────────────────────────────────────────
    if (command === "/orders") {
      const orders = await getAllOrders();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const todayOrders = orders.filter((o) => o.createdAt.startsWith(todayStr));
      const confirmed = todayOrders.filter((o) => o.status === "confirmed");
      const pending = todayOrders.filter((o) => o.status === "pending");
      const todayRev = confirmed.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      const inrToUsd = APP_CONFIG.inrToUsdRate || 0.011;

      const lines = [
        `📊 <b>TODAY'S SALES OVERVIEW</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `💵 <b>Today's Revenue:</b> <b>₹${todayRev}</b> (~$${(todayRev * inrToUsd).toFixed(2)} USD)`,
        `✅ <b>Paid Orders:</b> ${confirmed.length}`,
        `⏳ <b>Pending Orders:</b> ${pending.length}`,
        `📈 <b>Total Sessions:</b> ${todayOrders.length}`,
      ];

      if (confirmed.length > 0) {
        lines.push(``);
        lines.push(`<b>Recent Sales Today:</b>`);
        confirmed.slice(0, 5).forEach((o) => {
          const mEmail = o.email.includes("@") ? o.email.slice(0, 2) + "***@" + o.email.split("@")[1] : o.email;
          lines.push(`• <code>#${o.orderId}</code>: ₹${o.amount} (${o.productName || "Product"}) — <i>${mEmail}</i>`);
        });
      }

      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`🕒 <i>${new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</i>`);

      await sendTelegramMessage(lines.join("\n"));
      return NextResponse.json({ ok: true });
    }

    // ── Command: /revenue ────────────────────────────────────────────────────
    if (command === "/revenue") {
      const orders = await getAllOrders();
      const confirmed = orders.filter((o) => o.status === "confirmed");
      const totalRev = confirmed.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      const inrToUsd = APP_CONFIG.inrToUsdRate || 0.011;

      const upiOrders = confirmed.filter((o) => o.paymentMethod !== "crypto");
      const cryptoOrders = confirmed.filter((o) => o.paymentMethod === "crypto");
      const upiRev = upiOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
      const cryptoRev = cryptoOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

      const msg = [
        `💰 <b>ALL-TIME REVENUE REPORT</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `💎 <b>Total Earnings:</b> <b>₹${totalRev}</b> (~$${(totalRev * inrToUsd).toFixed(2)} USD)`,
        `📦 <b>Delivered Orders:</b> ${confirmed.length}`,
        ``,
        `💳 <b>UPI Revenue:</b> ₹${upiRev} (${upiOrders.length} orders)`,
        `🪙 <b>Crypto Revenue:</b> ₹${cryptoRev} (${cryptoOrders.length} orders)`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `<i>TrinityMart Financial Ledger</i>`,
      ].join("\n");

      await sendTelegramMessage(msg);
      return NextResponse.json({ ok: true });
    }

    // ── Command: /pending ────────────────────────────────────────────────────
    if (command === "/pending") {
      const orders = await getAllOrders();
      const pending = orders.filter((o) => o.status === "pending").slice(0, 6);

      if (pending.length === 0) {
        await sendTelegramMessage("✅ <b>No pending orders!</b> All customer sessions are paid or completed.");
        return NextResponse.json({ ok: true });
      }

      const lines = [
        `⏳ <b>PENDING ORDERS AWAITING PAYMENT (${pending.length})</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
      ];

      pending.forEach((o) => {
        const diffMins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60));
        lines.push(
          `• <code>#${o.orderId}</code>: ₹${o.amount} (${o.productName || "Asset"}) — <i>${diffMins}m ago</i>\n  Email: <code>${o.email}</code> | Method: ${o.paymentMethod || "UPI"}`
        );
      });

      lines.push(`━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`💡 To force fulfill an order, use: <code>/fulfill &lt;orderId&gt;</code>`);

      await sendTelegramMessage(lines.join("\n"));
      return NextResponse.json({ ok: true });
    }

    // ── Command: /fulfill <orderId> ───────────────────────────────────────────
    if (command === "/fulfill") {
      const targetId = (args[0] || "").replace("#", "").trim();
      if (!targetId) {
        await sendTelegramMessage("❌ <b>Usage:</b> <code>/fulfill &lt;orderId&gt;</code>\nExample: <code>/fulfill ORD-1729381029</code>");
        return NextResponse.json({ ok: true });
      }

      await sendTelegramMessage(`⏳ Fulfilling order <code>#${targetId}</code> from stock pool…`);

      const targetOrder = await getOrderById(targetId);
      if (!targetOrder) {
        await sendTelegramMessage(`❌ Order <code>#${targetId}</code> was not found in the database.`);
        return NextResponse.json({ ok: true });
      }

      const result = await manualFulfillOrder({
        orderId: targetId,
        utr: "TELEGRAM_ADMIN_FULFILLMENT",
      });

      if (!result.success) {
        await sendTelegramMessage(
          `❌ <b>Fulfillment Failed for #${targetId}</b>\nError: <i>${result.error || "No credentials available in stock"}</i>`
        );
      } else {
        await sendTelegramMessage(
          `✅ <b>ORDER #${targetId} FULFILLED!</b>\nCredentials claimed and dispatched to <code>${targetOrder.email}</code>.`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Unrecognized command
    await sendTelegramMessage(
      `❓ Unknown command <code>${command}</code>. Send <b>/help</b> to view all available commands.`
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[TELEGRAM BOT ERROR]:", err);
    return NextResponse.json({ ok: true });
  }
}
