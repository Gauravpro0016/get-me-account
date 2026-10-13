import { NextRequest, NextResponse } from "next/server";
import {
  sendDiscordPurchaseNotification,
  sendDiscordRestockNotification,
} from "@/lib/discord";

export const maxDuration = 30;

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided =
    req.headers.get("x-admin-password") ||
    req.nextUrl.searchParams.get("password");
  return !adminPassword || provided === adminPassword;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") || "purchase";

  const webhookUrl =
    (type === "restock" && process.env.DISCORD_RESTOCK_WEBHOOK_URL) ||
    process.env.DISCORD_SALES_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL ||
    process.env.DISCORD_PURCHASE_WEBHOOK_URL;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId =
    (type === "restock" && process.env.DISCORD_RESTOCK_CHANNEL_ID) ||
    process.env.DISCORD_CHANNEL_ID;

  if (!webhookUrl && (!botToken || !channelId)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Neither DISCORD_SALES_WEBHOOK_URL (or DISCORD_RESTOCK_WEBHOOK_URL) nor DISCORD_BOT_TOKEN+DISCORD_CHANNEL_ID is set in .env.local",
        instructions:
          "Open your Discord Server -> Server Settings -> Integrations -> Webhooks -> Create Webhook, copy the URL and add DISCORD_SALES_WEBHOOK_URL to .env.local",
      },
      { status: 400 }
    );
  }

  const testOrderId = `TM-TEST-${Date.now().toString().slice(-6)}`;

  try {
    let success = false;

    if (type === "restock") {
      success = await sendDiscordRestockNotification({
        productName: "Discord Nitro 1 Month [Live Restock Test]",
        productId: "discord-nitro-booster",
        category: "Discord & Gaming",
        unitsAdded: 15,
        totalStock: 30,
        price: 199,
      });
    } else {
      success = await sendDiscordPurchaseNotification({
        orderId: testOrderId,
        email: "buyer.example@gmail.com",
        senderName: "GauravPro",
        amount: 199,
        productName: "Discord Nitro 1 Month [Live Test]",
        quantity: 1,
        utr: "TEST-TXID-99281729",
      });
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Discord rejected the message. Please ensure the webhook URL or bot token is valid and has permission to send messages in the channel.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test ${type === "restock" ? "restock" : "purchase"} notification successfully sent to Discord! Check your channel.`,
      notificationType: type,
      testOrderId: type === "purchase" ? testOrderId : undefined,
      configuredTarget: webhookUrl
        ? "Webhook Mode"
        : `Bot Token Mode (Channel: ${channelId})`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to trigger test Discord notification",
      },
      { status: 500 }
    );
  }
}

