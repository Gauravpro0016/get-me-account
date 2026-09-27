import { NextRequest, NextResponse } from "next/server";
import { markEmailOpened } from "@/lib/fulfillment";

// 1x1 transparent GIF in binary
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (orderId) {
    const userAgent = req.headers.get("user-agent") || undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    // Asynchronously record open event in Redis without blocking image delivery
    markEmailOpened(orderId, {
      userAgent,
      ip,
      manual: false,
    }).catch((err) => {
      console.warn("Error marking email opened:", err);
    });
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": TRANSPARENT_GIF.length.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
