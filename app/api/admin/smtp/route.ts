import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSmtpConfig,
  setAdminSmtpConfig,
  createMailTransporter,
} from "@/lib/fulfillment";

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

  try {
    const config = await getAdminSmtpConfig();
    return NextResponse.json({
      success: true,
      user: config.user || "",
      hasPassword: Boolean(config.pass),
      envUser: (process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, ""),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const user = typeof body.user === "string" ? body.user.trim().replace(/^["']|["']$/g, "") : "";
    const pass = typeof body.pass === "string" ? body.pass.trim().replace(/^["']|["']$/g, "") : "";

    if (!user || !user.includes("@")) {
      return NextResponse.json(
        { error: "A valid Gmail address is required (e.g. yourname@gmail.com)." },
        { status: 400 }
      );
    }

    if (!pass) {
      return NextResponse.json(
        { error: "16-character Google App Password is required." },
        { status: 400 }
      );
    }

    const cleanPass = pass.replace(/\s+/g, "");
    if (cleanPass.length < 14 || cleanPass.length > 20) {
      return NextResponse.json(
        {
          error:
            "Invalid App Password format. Google App Passwords are 16 letters (e.g. 'abcd efgh ijkl mnop').",
        },
        { status: 400 }
      );
    }

    // Verify handshake directly with Google SMTP
    const testTransporter = createMailTransporter({ user, pass: cleanPass });
    try {
      await testTransporter.verify();
    } catch (smtpErr: unknown) {
      console.error("[SMTP VERIFY FAILED]:", smtpErr);
      const errMsg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
      const isBadCreds =
        errMsg.includes("535") ||
        errMsg.includes("BadCredentials") ||
        (smtpErr as { code?: string })?.code === "EAUTH";

      if (isBadCreds) {
        return NextResponse.json(
          {
            error:
              "Google rejected login (535-5.7.8 BadCredentials). Please ensure: 1) 2-Step Verification is ON in your Google Account. 2) You created an App Password at https://myaccount.google.com/apppasswords under this exact Gmail account.",
            details: errMsg,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error: `SMTP connection error: ${errMsg}`,
        },
        { status: 400 }
      );
    }

    // Save verified credentials to Redis
    await setAdminSmtpConfig({ user, pass: cleanPass });

    return NextResponse.json({
      success: true,
      message: `Verified and connected successfully to ${user}!`,
      user,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
