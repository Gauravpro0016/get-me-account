import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  sendTelegramLowStockAlert,
} from "@/lib/telegram";
import {
  sendDiscordPurchaseNotification,
  sendDiscordRestockNotification,
  sendDiscordLowStockAlert,
  getDiscordConfig,
  setDiscordConfig,
} from "@/lib/discord";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim().replace(/^["']|["']$/g, "");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.replace(/^Bearer\s+/i, "");
  const provided = (
    req.headers.get("x-admin-password") ||
    req.nextUrl.searchParams.get("password") ||
    bearer ||
    ""
  ).trim().replace(/^["']|["']$/g, "");
  return !!adminPassword && provided === adminPassword;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getTelegramConfig();
  const discordConfig = await getDiscordConfig();
  const discordWebhookConfigured = Boolean(
    discordConfig.salesWebhookUrl || discordConfig.restockWebhookUrl
  );

  return NextResponse.json({
    telegram: config,
    discord: discordConfig,
    discordWebhookConfigured,
  });
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // ── Test Triggers ────────────────────────────────────────────────────────
    if (body.test === "telegram") {
      const ok = await sendTelegramMessage(
        `🔔 <b>TrinityMart Telegram Test Alert</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ Your Telegram Bot connection is operating properly!\nYou will now receive instant notifications when items are bought.`
      );
      if (!ok) {
        return NextResponse.json(
          { error: "Could not send Telegram message. Please verify your Bot Token & Chat ID." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: "Test alert dispatched to Telegram!" });
    }

    if (body.test === "discord") {
      const ok = await sendDiscordPurchaseNotification({
        orderId: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        email: "customer-test@example.com",
        senderName: "Surya",
        amount: 149,
        usdAmount: "1.78",
        productName: "Minecraft Account [LIFETIME]",
        quantity: 1,
        utr: "TEST_TX_99881122",
        paymentType: "Crypto",
        deliveredCount: 1,
        credentialsDelivered: true,
      });
      if (!ok) {
        return NextResponse.json(
          { error: "Could not send Discord webhook. Check DISCORD_SALES_WEBHOOK_URL." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: "Test purchase embed sent to Discord!" });
    }

    if (body.test === "discord_restock") {
      const ok = await sendDiscordRestockNotification({
        productName: "Discord Nitro 3-Month (TEST RESTOCK)",
        unitsAdded: 5,
        totalStock: 10,
        price: 149,
        category: "Discord",
      });
      if (!ok) {
        return NextResponse.json(
          { error: "Could not send Discord restock webhook. Check DISCORD_RESTOCK_WEBHOOK_URL." },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, message: "Test restock embed sent to Discord!" });
    }

    if (body.test === "low_stock") {
      await Promise.allSettled([
        sendTelegramLowStockAlert({
          productName: "Discord Nitro Booster (TEST)",
          productId: "discord-nitro",
          remainingStock: 2,
          price: 149,
        }),
        sendDiscordLowStockAlert({
          productName: "Discord Nitro Booster (TEST)",
          productId: "discord-nitro",
          remainingStock: 2,
          price: 149,
        }),
      ]);
      return NextResponse.json({ success: true, message: "Test low-stock alert dispatched to Telegram & Discord!" });
    }

    // ── Save Settings ────────────────────────────────────────────────────────
    await saveTelegramConfig({
      botToken: body.botToken?.trim(),
      chatId: body.chatId?.trim(),
      enabled: body.enabled ?? true,
      notifyOnSale: body.notifyOnSale ?? true,
      notifyOnLowStock: body.notifyOnLowStock ?? true,
      notifyOnEmailError: body.notifyOnEmailError ?? true,
      lowStockThreshold: Number(body.lowStockThreshold) || 3,
    });

    if (body.salesWebhookUrl !== undefined || body.restockWebhookUrl !== undefined) {
      await setDiscordConfig({
        salesWebhookUrl: body.salesWebhookUrl,
        restockWebhookUrl: body.restockWebhookUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Bot & Alert preferences saved successfully!",
    });
  } catch (err: any) {
    console.error("[BOT SETTINGS ERROR]:", err);
    return NextResponse.json(
      { error: "Failed to update bot settings." },
      { status: 500 }
    );
  }
}
