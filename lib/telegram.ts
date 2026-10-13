import { Redis } from "@upstash/redis";

/**
 * TrinityMart Telegram Notification & Bot Integration
 * 
 * Supports sending instant admin alerts to a private Telegram chat/channel
 * using Telegram Bot API (no third-party server needed).
 * 
 * Config can come from:
 * 1. Environment variables: `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`
 * 2. Admin dashboard settings stored in Redis (`trinitymart_telegram_config`)
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const TELEGRAM_CONFIG_KEY = "trinitymart_telegram_config";

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
  notifyOnSale?: boolean;
  notifyOnLowStock?: boolean;
  notifyOnEmailError?: boolean;
  lowStockThreshold?: number;
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  let saved: TelegramConfig | null = null;
  try {
    saved = await redis.get<TelegramConfig>(TELEGRAM_CONFIG_KEY);
  } catch {}

  const botToken =
    saved?.botToken?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^["']|["']$/g, "") ||
    "";
  const chatId =
    saved?.chatId?.trim() ||
    process.env.TELEGRAM_CHAT_ID?.trim().replace(/^["']|["']$/g, "") ||
    "";

  return {
    botToken,
    chatId,
    enabled: saved?.enabled ?? (!!botToken && !!chatId),
    notifyOnSale: saved?.notifyOnSale ?? true,
    notifyOnLowStock: saved?.notifyOnLowStock ?? true,
    notifyOnEmailError: saved?.notifyOnEmailError ?? true,
    lowStockThreshold: saved?.lowStockThreshold ?? 3,
  };
}

export async function saveTelegramConfig(config: Partial<TelegramConfig>): Promise<void> {
  const existing = await getTelegramConfig();
  const merged: TelegramConfig = {
    ...existing,
    ...config,
  };
  await redis.set(TELEGRAM_CONFIG_KEY, merged);
}

/**
 * Dispatches an HTML-formatted message to the admin's Telegram chat
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.botToken || !config.chatId || !config.enabled) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[TELEGRAM] Send message failed (${res.status}):`, err);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn("[TELEGRAM] Error dispatching message:", err?.message || err);
    return false;
  }
}

/**
 * Dispatches Telegram alert when a new order is paid and fulfilled
 */
export async function sendTelegramPurchaseNotification(opts: {
  orderId: string;
  email: string;
  amount: number | string;
  usdAmount?: number | string;
  productName?: string;
  quantity?: number;
  utr?: string;
  paymentType?: string;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnSale) return false;

  const maskedEmail = opts.email.includes("@")
    ? opts.email.slice(0, 2) + "***@" + opts.email.split("@")[1]
    : opts.email;
  const paymentBadge = opts.paymentType === "Crypto" ? "🪙 Crypto (Atlos)" : "💳 UPI (Instant)";
  const usdText = opts.usdAmount ? ` (~$${opts.usdAmount} USD)` : "";
  const utrText = opts.utr ? `<code>${opts.utr}</code>` : "<i>Confirmed</i>";

  const msg = [
    `💰 <b>NEW ORDER PAID &amp; FULFILLED!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>Order ID:</b> <code>#${opts.orderId}</code>`,
    `📦 <b>Product:</b> <b>${opts.productName || "TrinityMart Digital Asset"}</b> (x${opts.quantity || 1})`,
    `💵 <b>Amount:</b> <b>₹${opts.amount}</b>${usdText}`,
    `👤 <b>Customer:</b> <code>${maskedEmail}</code>`,
    `💳 <b>Payment:</b> ${paymentBadge}`,
    `🏦 <b>Tx / UTR:</b> ${utrText}`,
    `⚡ <b>Status:</b> Auto-Fulfilled &amp; Emailed`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🕒 <i>${new Date().toLocaleTimeString()} • TrinityMart Dispatch</i>`,
  ].join("\n");

  return sendTelegramMessage(msg);
}

/**
 * Dispatches Telegram alert when product stock reaches critical low threshold
 */
export async function sendTelegramLowStockAlert(opts: {
  productName: string;
  productId?: string;
  remainingStock: number;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnLowStock) return false;

  const msg = [
    `⚠️ <b>LOW STOCK WARNING!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 <b>Product:</b> <b>${opts.productName}</b>`,
    `📉 <b>Remaining Stock:</b> <b>${opts.remainingStock} unit${opts.remainingStock === 1 ? "" : "s"}</b>`,
    `🚨 Inventory is below threshold (${config.lowStockThreshold}).`,
    `👉 Log in to the Admin Dashboard to restock accounts.`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🕒 <i>${new Date().toLocaleTimeString()} • Inventory Radar</i>`,
  ].join("\n");

  return sendTelegramMessage(msg);
}

/**
 * Dispatches Telegram alert when automated email delivery fails
 */
export async function sendTelegramEmailFailureAlert(opts: {
  orderId: string;
  email: string;
  error: string;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnEmailError) return false;

  const msg = [
    `🚨 <b>EMAIL DELIVERY FAILED!</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>Order ID:</b> <code>#${opts.orderId}</code>`,
    `👤 <b>Customer:</b> <code>${opts.email}</code>`,
    `❌ <b>Error:</b> <i>${opts.error}</i>`,
    `⚠️ Please inspect in Admin -> Order Audit and resend manually.`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🕒 <i>${new Date().toLocaleTimeString()} • SMTP Monitor</i>`,
  ].join("\n");

  return sendTelegramMessage(msg);
}
