import { NextRequest, NextResponse } from "next/server";
import { createMailTransporter, sendCredentialEmail } from "@/lib/fulfillment";

export const maxDuration = 30;

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get("x-admin-password") || req.nextUrl.searchParams.get("password");
  return !adminPassword || provided === adminPassword;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = (process.env.GMAIL_USER || "").trim();
  const startTime = Date.now();

  try {
    const transporter = createMailTransporter();

    // 1. Verify SMTP handshake
    await transporter.verify();
    const verifyTimeMs = Date.now() - startTime;

    // 2. Send real test gradient email with profile pic to admin
    const testOrderId = `TEST-${Date.now().toString().slice(-6)}`;
    const info = await sendCredentialEmail({
      email: adminEmail,
      orderId: testOrderId,
      amount: 25,
      productName: "Discord Nitro Booster [Live SMTP Test]",
      senderName: "Store Admin",
      utr: "TEST_UTR_88392019",
      credential: {
        id: "trinity_vip_test_user",
        email: "verified.customer@gmail.com",
        password: "TestPassword#2026",
        token: "mfa.W92kd81-LiveTestTokenNitro",
        twoFactorKey: "948201",
        addedAt: new Date().toISOString(),
        productName: "Discord Nitro Booster [Live SMTP Test]",
      },
    });

    const totalTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Full gradient test email successfully dispatched to ${adminEmail}`,
      messageId: info.messageId,
      verifyTimeMs,
      totalTimeMs,
      sender: adminEmail,
    });
  } catch (err: unknown) {
    console.error("Test email failed:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
