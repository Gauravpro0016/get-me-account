import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";
import { getBlacklist } from "@/lib/fulfillment";

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
    const blacklist = await getBlacklist();

    if (productId) {
      try {
        let inv = await redis.get<any[]>(`trinitymart_inventory_${productId}`);
        if ((!inv || inv.length === 0) && productId === "discord-nitro-booster") {
          const pool = await redis.get<any[]>(POOL_KEY);
          if (Array.isArray(pool) && pool.length > 0) {
            const cleanPool = pool.filter((item: any) => {
              const id = String(item.id || "").trim().toLowerCase();
              const em = String(item.email || "").trim().toLowerCase();
              const tok = String(item.token || "").trim().toLowerCase();
              return !blacklist.has(id) && !blacklist.has(em) && (!tok || !blacklist.has(tok));
            });

            return NextResponse.json(
              {
                inStock: cleanPool.length > 0,
                count: cleanPool.length,
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
          const active = inv.filter((item) => {
            if (!item || item.claimedAt) return false;
            const itemId = String(item.id || "").trim().toLowerCase();
            const f = item.fields || {};
            const itemEmail = String(f.email || f.id || "").trim().toLowerCase();
            const itemToken = String(f.token || f.key || "").trim().toLowerCase();
            if (itemId && blacklist.has(itemId)) return false;
            if (itemEmail && blacklist.has(itemEmail)) return false;
            if (itemToken && blacklist.has(itemToken)) return false;
            return true;
          });

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
