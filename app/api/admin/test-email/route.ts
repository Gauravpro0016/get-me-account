import { NextRequest, NextResponse } from "next/server";
import { createMailTransporter, sendMerchantSaleNotification } from "@/lib/fulfillment";

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

    // 2. Send test email to admin
    const testOrderId = `TEST-${Date.now().toString().slice(-6)}`;
    const info = await transporter.sendMail({
      from: `"Trinitymart Verification" <${adminEmail}>`,
      to: adminEmail,
      subject: `🧪 Test Email from Trinitymart [Production SMTP Online]`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;padding:24px;background:#0f172a;color:#ffffff;border-radius:12px;">
          <h2 style="color:#06b6d4;margin:0 0 10px;">✅ SMTP Email System Working Perfectly!</h2>
          <p style="color:#cbd5e1;font-size:14px;line-height:1.5;">
            This is a test email sent from your Trinitymart store.
          </p>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;">
            <p style="margin:4px 0;"><strong>Sender:</strong> ${adminEmail}</p>
            <p style="margin:4px 0;"><strong>Recipient:</strong> ${adminEmail}</p>
            <p style="margin:4px 0;"><strong>Handshake Latency:</strong> ${verifyTimeMs}ms</p>
            <p style="margin:4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;">
            Your credentials delivery and merchant notification emails are fully operational in production.
          </p>
        </div>
      `,
    });

    const totalTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Test email successfully sent to ${adminEmail}`,
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
