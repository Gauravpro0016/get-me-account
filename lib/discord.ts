/**
 * TrinityMart Discord Notification Helper
 * 
 * Automatically sends rich embed announcements to a Discord server
 * when an order is paid and fulfilled.
 * 
 * Supports either:
 * 1. Discord Webhook URL (Recommended - simple, serverless-friendly, instant)
 *    Configure `DISCORD_SALES_WEBHOOK_URL` in `.env.local`
 * 2. Discord Bot Token + Channel ID (Optional bot application mode)
 *    Configure `DISCORD_BOT_TOKEN` and `DISCORD_CHANNEL_ID` in `.env.local`
 */

export interface DiscordPurchaseNotificationOptions {
  orderId: string;
  email: string;
  senderName?: string;
  amount: number | string;
  usdAmount?: number | string;
  productName?: string;
  quantity?: number;
  utr?: string;
  paymentType?: "UPI" | "Crypto" | string;
  cartItems?: Array<{ productId: string; productName?: string; quantity: number; price?: number }>;
  deliveredCount?: number;
  credentialsDelivered?: boolean;
}

/**
 * Mask an email for public Discord channel privacy (e.g. "alexander@gmail.com" -> "al****@gmail.com")
 */
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [user, domain] = email.split("@");
  if (user.length <= 2) {
    return `${user[0] || "*"}*@${domain}`;
  }
  const visible = user.slice(0, 2);
  const masked = "*".repeat(Math.min(user.length - 2, 5));
  return `${visible}${masked}@${domain}`;
}

/**
 * Helper to dispatch HTTP request to Discord with retry on 429 rate limits or transient errors
 */
async function postWithRetry(
  url: string,
  init: RequestInit,
  retries = 1
): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 429 && retries > 0) {
      // Rate limited by Discord; wait 1.2s and retry
      await new Promise((r) => setTimeout(r, 1200));
      return postWithRetry(url, init, retries - 1);
    }
    return res;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return postWithRetry(url, init, retries - 1);
    }
    throw err;
  }
}

import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function readEnvLocalValue(key: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            if (k === key) {
              const val = trimmed.substring(idx + 1).trim();
              return val.replace(/^["']|["']$/g, "");
            }
          }
        }
      }
    }
  } catch {}
  return undefined;
}

export const DISCORD_CONFIG_KEY = "trinitymart_discord_config";

export interface DiscordConfig {
  salesWebhookUrl?: string;
  restockWebhookUrl?: string;
}

export async function getDiscordConfig(): Promise<DiscordConfig> {
  let redisConfig: DiscordConfig | null = null;
  try {
    redisConfig = await redis.get<DiscordConfig>(DISCORD_CONFIG_KEY);
  } catch (e) {
    console.warn("Could not read DISCORD_CONFIG_KEY from Redis:", e);
  }

  const salesFromDisk =
    readEnvLocalValue("DISCORD_SALES_WEBHOOK_URL") ||
    readEnvLocalValue("DISCORD_ORDERS_WEBHOOK_URL") ||
    readEnvLocalValue("DISCORD_WEBHOOK_URL") ||
    readEnvLocalValue("DISCORD_PURCHASE_WEBHOOK_URL");

  const restockFromDisk =
    readEnvLocalValue("DISCORD_RESTOCK_WEBHOOK_URL");

  const salesWebhookUrl = (
    redisConfig?.salesWebhookUrl ||
    salesFromDisk ||
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_ORDERS_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_PURCHASE_WEBHOOK_URL ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const restockWebhookUrl = (
    redisConfig?.restockWebhookUrl ||
    restockFromDisk ||
    process.env.DISCORD_RESTOCK_WEBHOOK_URL ||
    salesWebhookUrl
  ).trim().replace(/^["']|["']$/g, "");

  return { salesWebhookUrl, restockWebhookUrl };
}

export async function setDiscordConfig(config: DiscordConfig): Promise<void> {
  const cleanSales = (config.salesWebhookUrl || "").trim().replace(/^["']|["']$/g, "");
  const cleanRestock = (config.restockWebhookUrl || "").trim().replace(/^["']|["']$/g, "");
  await redis.set(DISCORD_CONFIG_KEY, {
    salesWebhookUrl: cleanSales,
    restockWebhookUrl: cleanRestock,
  });
}

/**
 * Dispatches an automated Discord announcement embed when a customer buys an item.
 */
export async function sendDiscordPurchaseNotification(
  opts: DiscordPurchaseNotificationOptions
): Promise<boolean> {
  const { salesWebhookUrl } = await getDiscordConfig();
  const webhookUrl = salesWebhookUrl;

  const botToken = (
    process.env.DISCORD_BOT_TOKEN ||
    readEnvLocalValue("DISCORD_BOT_TOKEN") ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const channelId = (
    process.env.DISCORD_CHANNEL_ID ||
    readEnvLocalValue("DISCORD_CHANNEL_ID") ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  if (!webhookUrl && (!botToken || !channelId)) {
    console.log(
      "[DISCORD] Neither DISCORD_SALES_WEBHOOK_URL nor DISCORD_BOT_TOKEN+DISCORD_CHANNEL_ID is set. Skipping Discord notification."
    );
    return false;
  }

  const rawUsername =
    opts.senderName?.trim() ||
    (opts.email ? opts.email.split("@")[0] : "Customer");

  const productName = opts.productName || "TrinityMart Digital Asset";
  const qty = Math.max(1, opts.quantity || 1);
  const displayEmail = maskEmail(opts.email || "");
  const amountStr = String(opts.amount || 0);

  // Determine payment method and format cleanly
  const rawType = (opts.paymentType || "").toLowerCase();
  const isCrypto =
    rawType.includes("crypto") ||
    opts.orderId.startsWith("ORD-CR-") ||
    opts.orderId.startsWith("crypto_") ||
    (opts.utr && (opts.utr.startsWith("CRYPTO:") || opts.utr.startsWith("0x")));

  const paymentMethodLabel = isCrypto
    ? "🪙 Cryptocurrency (Atlos / Blockchain)"
    : "💳 UPI (Instant Bank Transfer)";

  // Format purchased items breakdown
  let itemsDescription = `**${productName}** ${qty > 1 ? `(\`${qty}x\` units)` : ""}`;
  if (Array.isArray(opts.cartItems) && opts.cartItems.length > 0) {
    itemsDescription = opts.cartItems
      .map(
        (ci) =>
          `• **${ci.productName || ci.productId}** \`×${ci.quantity || 1}\`${
            ci.price ? ` (₹${(ci.price * (ci.quantity || 1)).toFixed(0)})` : ""
          }`
      )
      .join("\n");
  }

  // App logo for avatar
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const avatarUrl = `${appUrl}/favicon.ico`;

  const deliveredUnits = opts.deliveredCount || qty;

  const paymentMethodSimple = isCrypto ? "Crypto" : "UPI";
  const itemsDetail =
    Array.isArray(opts.cartItems) && opts.cartItems.length > 0
      ? opts.cartItems
          .map((ci) => ci.productName || ci.productId)
          .filter(Boolean)
          .join(", ")
      : productName;

  const saleMessage = `🎉 **${rawUsername}** have just purchased **${qty}x ${productName}** (${itemsDetail}) using **${paymentMethodSimple}**. Thank you for trusting **TRINITYMART**! 🚀`;

  // Embed card with side gradient accent line (Electric Indigo 0x8083ff for Crypto, Emerald 0x10b981 for UPI)
  const sideLineColor = isCrypto ? 0x8083ff : 0x10b981;

  const embed = {
    description: saleMessage,
    color: sideLineColor,
    footer: {
      text: "TrinityMart Automated Store • Instant Auto-Delivery",
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: "TrinityMart Sales Bot",
    avatar_url: avatarUrl,
    embeds: [embed],
  };

  try {
    // 1. Webhook Mode (Preferred)
    if (webhookUrl) {
      const res = await postWithRetry(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error(
          `[DISCORD] Webhook returned status ${res.status}:`,
          errorText
        );
        return false;
      }

      console.log(
        `[DISCORD] ✅ Successfully dispatched purchase notification for order ${opts.orderId} (${paymentMethodLabel})`
      );
      return true;
    }

    // 2. Bot Token REST API Mode (Alternative)
    if (botToken && channelId) {
      const res = await postWithRetry(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
          }),
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error(
          `[DISCORD] Bot message returned status ${res.status}:`,
          errorText
        );
        return false;
      }

      console.log(
        `[DISCORD] ✅ Successfully sent bot message for order ${opts.orderId}`
      );
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("[DISCORD] Error sending Discord purchase notification:", err?.message || err);
    return false;
  }
}

export function resolveProductImageUrl(productId?: string, customImage?: string): string | undefined {
  if (customImage && customImage.startsWith("http")) return customImage;
  const pId = (productId || "").toLowerCase();
  if (pId.includes("minecraft")) return "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=1000&auto=format&fit=crop&q=80";
  if (pId.includes("nitro") || pId.includes("discord")) return "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png";
  if (pId.includes("chatgpt") || pId.includes("openai") || pId.includes("gpt")) return "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1000&auto=format&fit=crop&q=80";
  if (pId.includes("netflix")) return "https://assets.nflxext.com/ffe/siteui/common/icons/monet/seo-metadata.jpg";
  if (pId.includes("spotify")) return "https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png";
  if (pId.includes("steam") || pId.includes("cs2")) return "https://cdn.cloudflare.steamstatic.com/store/home/store_home_share.jpg";
  if (pId.includes("gta") || pId.includes("rockstar")) return "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1000&auto=format&fit=crop&q=80";
  if (pId.includes("windows")) return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80";
  return undefined;
}

export interface DiscordRestockNotificationOptions {
  productName: string;
  productId?: string;
  category?: string;
  unitsAdded: number;
  totalStock?: number;
  price?: number | string;
  customLogoUrl?: string;
  productImage?: string;
}

/**
 * Dispatches an automated Discord announcement embed when a product is restocked.
 */
export async function sendDiscordRestockNotification(
  opts: DiscordRestockNotificationOptions
): Promise<boolean> {
  const { restockWebhookUrl, salesWebhookUrl } = await getDiscordConfig();
  const webhookUrl = restockWebhookUrl || salesWebhookUrl;

  const botToken = (
    process.env.DISCORD_BOT_TOKEN ||
    readEnvLocalValue("DISCORD_BOT_TOKEN") ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const channelId = (
    process.env.DISCORD_RESTOCK_CHANNEL_ID ||
    readEnvLocalValue("DISCORD_RESTOCK_CHANNEL_ID") ||
    process.env.DISCORD_CHANNEL_ID ||
    readEnvLocalValue("DISCORD_CHANNEL_ID") ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  if (!webhookUrl && (!botToken || !channelId)) {
    console.log(
      "[DISCORD] Neither DISCORD_RESTOCK_WEBHOOK_URL nor DISCORD_SALES_WEBHOOK_URL nor Bot Token is set. Skipping restock notification."
    );
    return false;
  }

  const productName = opts.productName || "TrinityMart Digital Asset";
  const unitsAdded = Math.max(1, opts.unitsAdded || 1);
  const totalStock = opts.totalStock ?? unitsAdded;
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

  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const avatarUrl = `${appUrl}/favicon.ico`;
  const productUrl = opts.productId
    ? `${appUrl}/product/${opts.productId}`
    : `${appUrl}/#products`;

  const resolvedImage =
    (opts.productImage && opts.productImage.startsWith("http") ? opts.productImage : undefined) ||
    (opts.customLogoUrl && opts.customLogoUrl.startsWith("http") ? opts.customLogoUrl : undefined) ||
    resolveProductImageUrl(opts.productId, opts.customLogoUrl);

  const alertContent = `[${productName} - RESTOCKED](<${productUrl}>)`;

  const embedDescription = [
    `**Service:** ${productName}`,
    `**Available stock:** ${totalStock} unit${totalStock === 1 ? "" : "s"}`,
    `**Price:** ${priceFormatted}`,
    `**Information:** We have recently restocked this product!`,
  ].join("\n");

  // Build clean modern Discord Restock Rich Embed with embedded product image underneath
  const embed: Record<string, any> = {
    title: `${productName} - RESTOCKED`,
    url: productUrl,
    description: embedDescription,
    color: 0x10b981, // Vibrant Emerald
    footer: {
      text: "TrinityMart Automated Inventory • Instant Restock Alert",
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  if (resolvedImage) {
    embed.image = { url: resolvedImage };
  }

  const payload = {
    username: "TrinityMart Restock Bot",
    avatar_url: avatarUrl,
    content: alertContent,
    embeds: [embed],
  };

  try {
    // 1. Webhook Mode (Preferred)
    if (webhookUrl) {
      const res = await postWithRetry(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error(
          `[DISCORD] Restock Webhook returned status ${res.status}:`,
          errorText
        );
        return false;
      }

      console.log(
        `[DISCORD] ✅ Successfully dispatched restock notification for ${productName} (+${unitsAdded} units)`
      );
      return true;
    }

    // 2. Bot Token REST API Mode (Alternative)
    if (botToken && channelId) {
      const res = await postWithRetry(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: alertContent,
            embeds: [embed],
          }),
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error(
          `[DISCORD] Restock Bot message returned status ${res.status}:`,
          errorText
        );
        return false;
      }

      console.log(
        `[DISCORD] ✅ Successfully sent restock bot message for ${productName}`
      );
      return true;
    }

    return false;
  } catch (err: any) {
    console.error("[DISCORD] Error sending Discord restock notification:", err?.message || err);
    return false;
  }
}

/**
 * Dispatches an automated Discord alert when a product's stock is critically low.
 */
export async function sendDiscordLowStockAlert(opts: {
  productName: string;
  productId?: string;
  remainingStock: number;
  price?: number | string;
  productImage?: string;
  customLogoUrl?: string;
}): Promise<boolean> {
  const { salesWebhookUrl, restockWebhookUrl } = await getDiscordConfig();
  const webhookUrl = restockWebhookUrl || salesWebhookUrl;

  if (!webhookUrl) return false;

  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const avatarUrl = `${appUrl}/favicon.ico`;
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

  const resolvedImage =
    (opts.productImage && opts.productImage.startsWith("http") ? opts.productImage : undefined) ||
    (opts.customLogoUrl && opts.customLogoUrl.startsWith("http") ? opts.customLogoUrl : undefined) ||
    resolveProductImageUrl(opts.productId, opts.customLogoUrl);

  const alertContent = `[${productName} - LOW STOCK](<${productUrl}>)`;

  const embedDescription = [
    `**Service:** ${productName}`,
    `**Available stock:** ${opts.remainingStock} unit${opts.remainingStock === 1 ? "" : "s"}`,
    `**Price:** ${priceFormatted}`,
    `**Information:** Hurry! This product is almost sold out. Grab yours before keys run out!`,
  ].join("\n");

  const embed: Record<string, any> = {
    title: `${productName} - LOW STOCK`,
    url: productUrl,
    description: embedDescription,
    color: 0xf59e0b, // Amber warning
    footer: {
      text: "TrinityMart Inventory Radar • Low Stock Guard",
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  if (resolvedImage) {
    embed.image = { url: resolvedImage };
  }

  try {
    const res = await postWithRetry(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "TrinityMart Stock Radar",
        avatar_url: avatarUrl,
        content: alertContent,
        embeds: [embed],
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn("[DISCORD] Low stock alert error:", err);
    return false;
  }
}

/**
 * Dispatches an automated Discord alert when customer credential email delivery fails.
 */
export async function sendDiscordEmailFailureAlert(opts: {
  orderId: string;
  email: string;
  error: string;
}): Promise<boolean> {
  const { salesWebhookUrl } = await getDiscordConfig();
  const webhookUrl = salesWebhookUrl;

  if (!webhookUrl) return false;

  const embed = {
    title: `🚨 EMAIL DELIVERY FAILED: #${opts.orderId}`,
    description: `An error occurred while dispatching credentials to customer **${opts.email}**.\n\nPlease inspect the order in the Admin Panel and retry delivery.`,
    color: 0xef4444, // Red error
    fields: [
      { name: "🆔 Order ID", value: `#${opts.orderId}`, inline: true },
      { name: "👤 Customer", value: opts.email, inline: true },
      { name: "❌ Error Message", value: `\`\`\`${opts.error.slice(0, 500)}\`\`\``, inline: false },
    ],
    footer: {
      text: "TrinityMart SMTP Monitor • Delivery Alert",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await postWithRetry(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "TrinityMart SMTP Monitor",
        embeds: [embed],
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn("[DISCORD] Email failure alert error:", err);
    return false;
  }
}

/**
 * Dispatches an automated Discord alert when a new order is registered/initiated by customer.
 * Disabled: Alert for awaiting payment has been removed per merchant request.
 */
export async function sendDiscordOrderInitiatedNotification(opts: {
  orderId: string;
  email: string;
  amount: number | string;
  productName?: string;
  quantity?: number;
  paymentMethod?: string;
}): Promise<boolean> {
  // Alert for awaiting payment is disabled
  return false;
}


