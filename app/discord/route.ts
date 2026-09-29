import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const target =
    process.env.DISCORD_LINK ||
    process.env.NEXT_PUBLIC_DISCORD_LINK ||
    "https://discord.com/invite/grrSJENXR";

  return NextResponse.redirect(target, 307);
}
