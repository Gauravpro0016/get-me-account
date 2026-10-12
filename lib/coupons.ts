import { Redis } from "@upstash/redis";

export interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  maxUses?: number;
  usedCount: number;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
  description?: string;
}

export const COUPONS_REDIS_KEY = "trinitymart_coupons";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const DEFAULT_COUPONS: Coupon[] = [
  {
    id: "coup_welcome10",
    code: "WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscountAmount: 100,
    maxUses: 500,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
    description: "Welcome discount - 10% off for all customers",
  },
  {
    id: "coup_trinity5",
    code: "TRINITY5",
    discountType: "flat",
    discountValue: 5,
    minOrderAmount: 10,
    maxUses: 1000,
    usedCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
    description: "Flat ₹5 discount on orders of ₹10 or more",
  },
];

/**
 * Retrieves all coupons from Redis (or falls back to defaults and caches them)
 * Automatically purges any legacy TRINITY10 records from the database.
 */
export async function getAllCoupons(): Promise<Coupon[]> {
  try {
    const raw = await redis.get<Coupon[]>(COUPONS_REDIS_KEY);
    if (Array.isArray(raw) && raw.length > 0) {
      // Automatically purge legacy/old coupon code TRINITY10 from database
      const cleaned = raw.filter(
        (c) => c && c.code && c.code.toUpperCase() !== "TRINITY10"
      );
      if (cleaned.length !== raw.length) {
        await redis.set(COUPONS_REDIS_KEY, cleaned);
      }
      return cleaned;
    }
    // Initialize defaults if not present
    await redis.set(COUPONS_REDIS_KEY, DEFAULT_COUPONS);
    return DEFAULT_COUPONS;
  } catch (err) {
    console.warn("getAllCoupons: Redis fetch failed, falling back to in-memory defaults:", err);
    return DEFAULT_COUPONS;
  }
}

/**
 * Saves all coupons array to Redis
 */
export async function saveAllCoupons(coupons: Coupon[]): Promise<void> {
  // Ensure TRINITY10 is never saved to the database
  const cleaned = coupons.filter(
    (c) => c && c.code && c.code.toUpperCase() !== "TRINITY10"
  );
  await redis.set(COUPONS_REDIS_KEY, cleaned);
}

/**
 * Validates a coupon code against a specific purchase order amount.
 */
export async function validateCoupon(
  code: string,
  orderAmount: number
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  finalAmount?: number;
  error?: string;
}> {
  if (!code || typeof code !== "string") {
    return { valid: false, error: "Please enter a coupon code." };
  }

  const cleanCode = code.trim().toUpperCase();

  if (cleanCode === "TRINITY10") {
    return { valid: false, error: 'Coupon code "TRINITY10" has been retired. Please use an active coupon like WELCOME10.' };
  }

  const coupons = await getAllCoupons();
  const found = coupons.find((c) => c.code.toUpperCase() === cleanCode);

  if (!found) {
    return { valid: false, error: `Coupon code "${cleanCode}" does not exist.` };
  }

  if (!found.active) {
    return { valid: false, error: `Coupon "${cleanCode}" is currently inactive.` };
  }

  if (found.expiresAt) {
    const expiry = new Date(found.expiresAt).getTime();
    if (!Number.isNaN(expiry) && Date.now() > expiry) {
      return { valid: false, error: `Coupon "${cleanCode}" has expired.` };
    }
  }

  if (typeof found.maxUses === "number" && found.maxUses > 0) {
    if (found.usedCount >= found.maxUses) {
      return { valid: false, error: `Coupon "${cleanCode}" usage limit has been reached.` };
    }
  }

  if (orderAmount < (found.minOrderAmount || 0)) {
    return {
      valid: false,
      error: `Coupon "${cleanCode}" requires a minimum order amount of ₹${found.minOrderAmount}.`,
    };
  }

  let discount = 0;
  if (found.discountType === "percentage") {
    const percentVal = Math.min(100, Math.max(0, found.discountValue));
    discount = Number(((orderAmount * percentVal) / 100).toFixed(2));
    if (found.maxDiscountAmount && found.maxDiscountAmount > 0) {
      discount = Math.min(discount, found.maxDiscountAmount);
    }
  } else {
    // Flat discount in INR
    discount = Math.min(orderAmount, found.discountValue);
  }

  // Ensure positive discount and keep final amount at least ₹1 (or 0 for 100% off promos)
  discount = Math.max(0, Math.min(orderAmount, discount));
  const finalAmount = Math.max(0, Number((orderAmount - discount).toFixed(2)));

  return {
    valid: true,
    coupon: found,
    discountAmount: discount,
    finalAmount,
  };
}

/**
 * Increment usage counter for a coupon upon successful order fulfillment
 */
export async function incrementCouponUsage(code: string): Promise<void> {
  if (!code) return;
  try {
    const cleanCode = code.trim().toUpperCase();
    const coupons = await getAllCoupons();
    const idx = coupons.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (idx !== -1) {
      coupons[idx].usedCount = (coupons[idx].usedCount || 0) + 1;
      await saveAllCoupons(coupons);
    }
  } catch (err) {
    console.warn("incrementCouponUsage error:", err);
  }
}
