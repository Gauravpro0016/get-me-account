import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";

// Public endpoint — returns stock availability and public store config
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || searchParams.get("id");
    if (productId) {
      try {
        let inv = await redis.get<any[]>(`trinitymart_inventory_${productId}`);
        if ((!inv || inv.length === 0) && productId === "discord-nitro-booster") {
          const pool = await redis.get<any[]>(POOL_KEY);
          if (Array.isArray(pool) && pool.length > 0) {
            return NextResponse.json(
              {
                inStock: pool.length > 0,
                count: pool.length,
                productId,
              },
              {
                headers: {
                  "Cache-Control": "no-store, no-cache, must-revalidate",
                },
              }
            );
          }
        }
        if (inv && Array.isArray(inv)) {
          const active = inv.filter((item) => !item.claimedAt);
          return NextResponse.json(
            {
              inStock: active.length > 0,
              count: active.length,
              productId,
            },
            {
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
              },
            }
          );
        }
      } catch (e) {
        console.warn("Failed to check product inventory:", e);
      }
    }

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
