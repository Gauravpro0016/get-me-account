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
  productName?: string;
  quantity?: number;
  utr?: string;
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
 * Dispatches an automated Discord announcement embed when a customer buys an item.
 */
export async function sendDiscordPurchaseNotification(
  opts: DiscordPurchaseNotificationOptions
): Promise<boolean> {
  const rawWebhookUrl =
    process.env.DISCORD_SALES_WEBHOOK_URL ||
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

  // App logo for avatar
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://get-me-account.vercel.app"
  ).replace(/\/$/, "");
  const avatarUrl = `${appUrl}/favicon.ico`;

  // Build modern Discord Rich Embed
  const embed = {
    title: "🛒 New Purchase Completed!",
    description: `🎉 **${rawUsername}** just purchased **${productName}**!`,
    color: 0x10b981, // Emerald green
    fields: [
      {
        name: "📦 Item",
        value: `**${productName}** ${qty > 1 ? `(\`${qty}x\` units)` : ""}`,
        inline: true,
      },
      {
        name: "💰 Amount",
        value: `**₹${amountStr}**`,
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
              name: "🧾 Payment Ref",
              value: `\`${opts.utr.slice(0, 30)}${opts.utr.length > 30 ? "…" : ""}\``,
              inline: true,
            },
          ]
        : []),
    ],
    footer: {
      text: "TrinityMart Automated Store • Instant Auto-Delivery",
      icon_url: avatarUrl,
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: "TrinityMart Bot",
    avatar_url: avatarUrl,
    embeds: [embed],
  };

  try {
    // 1. Webhook Mode (Preferred)
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
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
        `[DISCORD] ✅ Successfully dispatched purchase notification for order ${opts.orderId}`
      );
      return true;
    }

    // 2. Bot Token REST API Mode (Alternative)
    if (botToken && channelId) {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `🎉 **${rawUsername}** just bought **${productName}**!`,
            embeds: [embed],
          }),
          signal: AbortSignal.timeout(6000),
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
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(6000),
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
      const res = await fetch(
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
          signal: AbortSignal.timeout(6000),
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

