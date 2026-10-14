import { NextRequest, NextResponse } from "next/server";
import {
  createMailTransporter,
  sendCredentialEmail,
  getAdminSmtpConfig,
} from "@/lib/fulfillment";

export const maxDuration = 30;

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = (process.env.ADMIN_PASSWORD || "").trim().replace(/^["']|["']$/g, "");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const provided = (
    req.headers.get("x-admin-password") ||
    req.nextUrl.searchParams.get("password") ||
    bearer ||
    ""
  ).trim().replace(/^["']|["']$/g, "");
  return !adminPassword || provided === adminPassword;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const smtp = await getAdminSmtpConfig();
  const adminEmail = (smtp.user || process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, "");
  const startTime = Date.now();

  try {
    const transporter = createMailTransporter(smtp);

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
    const rawError = err instanceof Error ? err.message : String(err);
    const isBadCreds =
      rawError.includes("535") ||
      rawError.includes("BadCredentials") ||
      (err as { code?: string })?.code === "EAUTH";

    const userAdvice = isBadCreds
      ? "Google rejected login (535-5.7.8 BadCredentials). 1) Ensure 2-Step Verification is ON for your Google account. 2) Generate a new 16-character App Password at https://myaccount.google.com/apppasswords. 3) Update GMAIL_APP_PASSWORD in .env.local or enter it in the SMTP Settings section below."
      : rawError;

    return NextResponse.json(
      {
        success: false,
        error: userAdvice,
        rawError,
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}
