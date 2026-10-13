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

/**
 * Dispatches an automated Discord announcement embed when a customer buys an item.
 */
export async function sendDiscordPurchaseNotification(
  opts: DiscordPurchaseNotificationOptions
): Promise<boolean> {
  const rawWebhookUrl =
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_ORDERS_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_PURCHASE_WEBHOOK_URL;
  const webhookUrl = rawWebhookUrl?.trim().replace(/^["']|["']$/g, "");

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim().replace(/^["']|["']$/g, "");
  const channelId = process.env.DISCORD_CHANNEL_ID?.trim().replace(/^["']|["']$/g, "");

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

  // Build modern Discord Rich Embed
  const embed = {
    title: "🛒 New Purchase Completed!",
    description: `🎉 **${rawUsername}** just paid **₹${amountStr}** via **${
      isCrypto ? "🪙 Crypto" : "💳 UPI"
    }** for **${productName}**!\n\n✅ **Account credentials have been successfully delivered to customer email.**`,
    color: isCrypto ? 0x8083ff : 0x10b981, // Indigo for Crypto, Emerald for UPI
    fields: [
      {
        name: "📦 Items Purchased",
        value: itemsDescription.slice(0, 1024),
        inline: false,
      },
      {
        name: "💳 Payment Method",
        value: `**${paymentMethodLabel}**`,
        inline: true,
      },
      {
        name: "💰 Amount Paid",
        value: `**₹${amountStr}**${
          opts.usdAmount
            ? ` (~$${opts.usdAmount} USD)`
            : isCrypto
            ? ` (~$${(Number(amountStr) * 0.011).toFixed(2)} USD)`
            : ""
        }`,
        inline: true,
      },
      {
        name: "✅ Credentials Status",
        value: `**Delivered via Email** (\`${deliveredUnits} unit${
          deliveredUnits > 1 ? "s" : ""
        }\`)`,
        inline: true,
      },
      {
        name: "👤 Customer",
        value: `${rawUsername} (\`${displayEmail}\`)`,
        inline: true,
      },
      {
        name: "🆔 Order ID",
        value: `\`#${opts.orderId}\``,
        inline: true,
      },
      ...(opts.utr
        ? [
            {
              name: isCrypto ? "⛓️ Blockchain TxID / Hash" : "🧾 Bank UTR Reference",
              value: `\`${opts.utr.replace(/^CRYPTO:/i, "").slice(0, 36)}${
                opts.utr.length > 36 ? "…" : ""
              }\``,
              inline: true,
            },
          ]
        : []),
    ],
    footer: {
      text: "TrinityMart Automated Store • Instant Auto-Delivery & Stock Sync",
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
            content: `🎉 **${rawUsername}** just bought **${productName}** via **${
              isCrypto ? "Crypto" : "UPI"
            }**!`,
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

export interface DiscordRestockNotificationOptions {
  productName: string;
  productId?: string;
  category?: string;
  unitsAdded: number;
  totalStock?: number;
  price?: number | string;
  customLogoUrl?: string;
}

/**
 * Dispatches an automated Discord announcement embed when a product is restocked.
 */
export async function sendDiscordRestockNotification(
  opts: DiscordRestockNotificationOptions
): Promise<boolean> {
  const rawWebhookUrl =
    process.env.DISCORD_RESTOCK_WEBHOOK_URL ||
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_PURCHASE_WEBHOOK_URL;
  const webhookUrl = rawWebhookUrl?.trim().replace(/^["']|["']$/g, "");

  const botToken = process.env.DISCORD_BOT_TOKEN?.trim().replace(/^["']|["']$/g, "");
  const channelId = (
    process.env.DISCORD_RESTOCK_CHANNEL_ID || process.env.DISCORD_CHANNEL_ID
  )?.trim().replace(/^["']|["']$/g, "");

  if (!webhookUrl && (!botToken || !channelId)) {
    console.log(
      "[DISCORD] Neither DISCORD_RESTOCK_WEBHOOK_URL nor DISCORD_SALES_WEBHOOK_URL nor Bot Token is set. Skipping restock notification."
    );
    return false;
  }

  const productName = opts.productName || "TrinityMart Digital Asset";
  const unitsAdded = Math.max(1, opts.unitsAdded || 1);
  const totalStock = opts.totalStock;
  const price = opts.price;

  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const avatarUrl = `${appUrl}/favicon.ico`;
  const storeUrl = opts.productId
    ? `${appUrl}/#product-${opts.productId}`
    : `${appUrl}/#products`;

  // Build modern Discord Restock Rich Embed
  const embed = {
    title: "🚀 Restock Alert — TrinityMart",
    description: `🔥 **${unitsAdded} new unit${unitsAdded > 1 ? "s" : ""}** of **${productName}** have just been loaded into TrinityMart! Grab yours while keys last.`,
    color: 0x6366f1, // Electric Indigo
    fields: [
      {
        name: "📦 Item",
        value: `**${productName}**`,
        inline: true,
      },
      {
        name: "⚡ Restocked",
        value: `**+${unitsAdded} unit${unitsAdded > 1 ? "s" : ""}**`,
        inline: true,
      },
      ...(totalStock !== undefined
        ? [
            {
              name: "📊 Available Now",
              value: `**${totalStock} in stock**`,
              inline: true,
            },
          ]
        : []),
      ...(price !== undefined && price !== null && price !== ""
        ? [
            {
              name: "💰 Price",
              value: `**₹${price}**`,
              inline: true,
            },
          ]
        : []),
      ...(opts.category
        ? [
            {
              name: "🏷️ Category",
              value: opts.category,
              inline: true,
            },
          ]
        : []),
      {
        name: "🛒 Storefront",
        value: `[**Instant Delivery Store →**](${storeUrl})`,
        inline: true,
      },
    ],
    footer: {
      text: "TrinityMart Automated Inventory • Instant Restock Alert",
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  const alertContent = `🚀 **RESTOCK ALERT:** **${productName}** has just been restocked with **+${unitsAdded} unit${unitsAdded > 1 ? "s" : ""}**! Get yours now: ${storeUrl}`;

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
}): Promise<boolean> {
  const rawWebhookUrl =
    process.env.DISCORD_RESTOCK_WEBHOOK_URL ||
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL;
  const webhookUrl = rawWebhookUrl?.trim().replace(/^["']|["']$/g, "");

  if (!webhookUrl) return false;

  const embed = {
    title: `⚠️ LOW STOCK WARNING: ${opts.productName}`,
    description: `Inventory for **${opts.productName}** has dropped to **${opts.remainingStock} unit${opts.remainingStock === 1 ? "" : "s"}** remaining!\n\nPlease restock accounts in the Admin Dashboard to avoid overselling.`,
    color: 0xf59e0b, // Amber warning
    fields: [
      { name: "📦 Product", value: opts.productName, inline: true },
      { name: "📉 Remaining Units", value: String(opts.remainingStock), inline: true },
      { name: "⚙️ Action Required", value: "Restock via Admin Stock Manager", inline: false },
    ],
    footer: {
      text: "TrinityMart Inventory Radar • Low Stock Guard",
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await postWithRetry(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "TrinityMart Stock Radar",
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
  const rawWebhookUrl =
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL;
  const webhookUrl = rawWebhookUrl?.trim().replace(/^["']|["']$/g, "");

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


