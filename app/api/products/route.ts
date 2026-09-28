import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Product, PRODUCTS as DEFAULT_PRODUCTS } from "@/lib/products";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CUSTOM_PRODUCTS_KEY = "trinitymart_custom_products";
const REMOVED_PRODUCTS_KEY = "trinitymart_removed_product_ids";
const PRODUCT_OVERRIDES_KEY = "trinitymart_product_overrides";
const REVIEWS_REDIS_KEY = "trinitymart_reviews";

export async function GET() {
  try {
    let customProducts: Product[] = [];
    let removedIds: string[] = [];
    let overrides: Record<string, any> = {};
    let allReviews: any[] = [];

    try {
      customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
    } catch {
      customProducts = [];
    }

    try {
      removedIds = (await redis.get<string[]>(REMOVED_PRODUCTS_KEY)) || [];
    } catch {
      removedIds = [];
    }

    try {
      overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
    } catch {
      overrides = {};
    }

    try {
      allReviews = (await redis.get<any[]>(REVIEWS_REDIS_KEY)) || [];
    } catch {
      allReviews = [];
    }

    // Merge custom and default products, filtering out any that were removed
    const merged = [...customProducts, ...DEFAULT_PRODUCTS].filter(
      (p) => !removedIds.includes(p.id)
    );

    // Fetch live inventory for all active products in parallel
    const inventories = await Promise.all(
      merged.map(async (prod) => {
        try {
          let inv = await redis.get<any[]>(`trinitymart_inventory_${prod.id}`);
          if (inv && Array.isArray(inv) && inv.length > 0) return inv;

          // Auto-sync nitro booster from credentials_pool if not yet in inventory
          if (prod.id === "discord-nitro-booster") {
            const pool = (await redis.get<any[]>("credentials_pool")) || [];
            if (Array.isArray(pool) && pool.length > 0) {
              const migrated = pool.map((item: any) => ({
                id: item.id || `inv-nitro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                fields: {
                  id: item.email || item.id || "DiscordNitroUser",
                  email: item.email,
                  password: item.discordPassword || item.password || item.emailPassword,
                  emailPassword: item.emailPassword,
                  token: item.token,
                  domain: item.domain || "Outlook.com",
                },
                addedAt: item.addedAt || new Date().toISOString(),
              }));
              await redis.set(`trinitymart_inventory_${prod.id}`, migrated);
              return migrated;
            }
          }

          return Array.isArray(inv) ? inv : [];
        } catch {
          return [];
        }
      })
    );

    // Apply database overrides, real stock counts, and real reviews
    const all = merged.map((prod, idx) => {
      const p = { ...prod };
      const override = overrides[p.id];
      if (override) {
        Object.assign(p, override);
      }

      const inv = inventories[idx] || [];
      const activeInventory = inv.filter((item) => !item.claimedAt);

      // Stock units: if credentials exist in DB, stockCount is strictly the number of active credentials!
      if (inv.length > 0) {
        p.stockCount = activeInventory.length;
        p.inStock = activeInventory.length > 0;
      } else {
        const dbStock =
          override?.stockCount !== undefined
            ? override.stockCount
            : p.stockCount ?? 0;
        p.stockCount = Math.max(0, Number(dbStock));
        p.inStock =
          override?.inStock !== undefined
            ? Boolean(override.inStock)
            : p.stockCount > 0;
      }

      // Security: Strip raw credentials before sending to public buyers
      delete (p as any).inventory;

      // Real reviews from database
      const prodReviews = allReviews.filter((r) => r.productId === p.id);
      if (prodReviews.length > 0) {
        p.reviews = prodReviews;
        p.reviewsCount = prodReviews.length;
        const totalRating = prodReviews.reduce(
          (sum: number, r: any) => sum + (Number(r.rating) || 5),
          0
        );
        p.rating = Number((totalRating / prodReviews.length).toFixed(1));
      } else {
        // If no real reviews in database, set to 0 reviews and rating 5
        p.reviews = [];
        p.reviewsCount = 0;
        p.rating = 5.0;
      }

      return p;
    });

    return NextResponse.json(
      {
        products: all,
        total: all.length,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({
      products: DEFAULT_PRODUCTS,
      total: DEFAULT_PRODUCTS.length,
    });
  }
}
