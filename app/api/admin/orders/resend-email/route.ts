import { NextRequest, NextResponse } from "next/server";
import { resendOrderEmail } from "@/lib/fulfillment";

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get("x-admin-password");
  return !!adminPassword && provided === adminPassword;
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { orderId, email } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const result = await resendOrderEmail(orderId, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to resend credential email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Credential email resent successfully",
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("Failed to resend order email:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
