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

function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  senderName?: string;
  cartItems?: Array<{ productName?: string; productId?: string; quantity?: number; price?: number }>;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnSale) return false;

  const rawEmail = opts.email || "";
  const rawUsername =
    opts.senderName?.trim() ||
    (rawEmail ? rawEmail.split("@")[0] : "Customer");
  const maskedEmail = rawEmail.includes("@")
    ? rawEmail.slice(0, 2) + "***@" + rawEmail.split("@")[1]
    : rawEmail;

  const isCrypto = (opts.paymentType || "").toLowerCase().includes("crypto");
  const paymentMethodSimple = isCrypto ? "Crypto" : "UPI";
  const paymentBadge = isCrypto ? "🪙 Crypto (Atlos)" : "💳 UPI (Instant)";
  const usdText = opts.usdAmount ? ` (~$${escapeHtml(opts.usdAmount)} USD)` : "";
  const utrText = opts.utr ? `<code>${escapeHtml(opts.utr)}</code>` : "<i>Confirmed</i>";
  const qty = Math.max(1, opts.quantity || 1);
  const productName = opts.productName || "TrinityMart Digital Asset";
  const itemsDetail =
    Array.isArray(opts.cartItems) && opts.cartItems.length > 0
      ? opts.cartItems
          .map((ci) => ci.productName || ci.productId)
          .filter(Boolean)
          .join(", ")
      : productName;

  const saleLine = `🎉 <b>${escapeHtml(rawUsername)}</b> have just purchased <b>${qty}x ${escapeHtml(productName)}</b> (${escapeHtml(itemsDetail)}) using <b>${paymentMethodSimple}</b>. Thank you for trusting TRINITYMART! 🚀`;

  const msg = [
    saleLine,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>Order ID:</b> <code>#${escapeHtml(opts.orderId)}</code>`,
    `📦 <b>Product:</b> <b>${escapeHtml(productName)}</b> (x${qty})`,
    `💵 <b>Amount:</b> <b>₹${escapeHtml(opts.amount)}</b>${usdText}`,
    `👤 <b>Customer:</b> <code>${escapeHtml(maskedEmail)}</code>`,
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
export async function sendTelegramRestockNotification(opts: {
  productName: string;
  productId?: string;
  unitsAdded: number;
  totalStock?: number;
  price?: number | string;
  productImage?: string;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnSale && !config.notifyOnLowStock) return false;

  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const productUrl = opts.productId
    ? `${appUrl}/product/${opts.productId}`
    : `${appUrl}/#products`;

  const productName = opts.productName || "TrinityMart Digital Asset";
  const totalStock = opts.totalStock ?? opts.unitsAdded;
  const rawPrice = opts.price;
  const priceFormatted =
    rawPrice !== undefined && rawPrice !== null && rawPrice !== ""
      ? String(rawPrice).startsWith("₹") ||
        String(rawPrice).startsWith("€") ||
        String(rawPrice).startsWith("$") ||
        String(rawPrice).startsWith("£")
        ? String(rawPrice)
        : `₹${rawPrice}`
      : "₹499";

  const msg = [
    `<a href="${productUrl}"><b>[${escapeHtml(productName)} - RESTOCKED]</b></a>`,
    ``,
    `<b>Service:</b> ${escapeHtml(productName)}`,
    `<b>Available stock:</b> ${escapeHtml(totalStock)} unit${totalStock === 1 ? "" : "s"}`,
    `<b>Price:</b> ${escapeHtml(priceFormatted)}`,
    `<b>Information:</b> We have recently restocked this product!`,
    ``,
    `<a href="${productUrl}">👉 <b>Buy Now on TrinityMart</b></a>`,
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
  price?: number | string;
  productImage?: string;
}): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config.notifyOnLowStock) return false;

  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const productUrl = opts.productId
    ? `${appUrl}/product/${opts.productId}`
    : `${appUrl}/#products`;

  const productName = opts.productName || "TrinityMart Digital Asset";
  const rawPrice = opts.price;
  const priceFormatted =
    rawPrice !== undefined && rawPrice !== null && rawPrice !== ""
      ? String(rawPrice).startsWith("₹") ||
        String(rawPrice).startsWith("€") ||
        String(rawPrice).startsWith("$") ||
        String(rawPrice).startsWith("£")
        ? String(rawPrice)
        : `₹${rawPrice}`
      : "Best Price";

  const msg = [
    `<a href="${productUrl}"><b>[${escapeHtml(productName)} - LOW STOCK]</b></a>`,
    ``,
    `<b>Service:</b> ${escapeHtml(productName)}`,
    `<b>Available stock:</b> ${escapeHtml(opts.remainingStock)} unit${opts.remainingStock === 1 ? "" : "s"}`,
    `<b>Price:</b> ${escapeHtml(priceFormatted)}`,
    `<b>Information:</b> Hurry! This product is almost sold out. Grab yours before keys run out!`,
    ``,
    `<a href="${productUrl}">👉 <b>Claim Last Units on TrinityMart</b></a>`,
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
    `🆔 <b>Order ID:</b> <code>#${escapeHtml(opts.orderId)}</code>`,
    `👤 <b>Customer:</b> <code>${escapeHtml(opts.email)}</code>`,
    `❌ <b>Error:</b> <i>${escapeHtml(opts.error)}</i>`,
    `⚠️ Please inspect in Admin -> Order Audit and resend manually.`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🕒 <i>${new Date().toLocaleTimeString()} • SMTP Monitor</i>`,
  ].join("\n");

  return sendTelegramMessage(msg);
}
