import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";

// Public endpoint — returns stock availability and public store config
export async function GET() {
  try {
    const pool = await redis.get<{ id: string }[]>(POOL_KEY);
    const count = pool?.length ?? 0;
    return NextResponse.json(
      {
        inStock: count > 0,
        count,
        price: APP_CONFIG.price,
        currencySymbol: APP_CONFIG.currencySymbol,
        productName: APP_CONFIG.productName,
        discordLink: APP_CONFIG.discordLink,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        inStock: false,
        count: 0,
        price: APP_CONFIG.price,
        currencySymbol: APP_CONFIG.currencySymbol,
        productName: APP_CONFIG.productName,
        discordLink: APP_CONFIG.discordLink,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
