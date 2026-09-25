import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";

// Public endpoint — only reveals whether stock > 0, no credential data
export async function GET() {
  try {
    const pool = await redis.get<{ id: string }[]>(POOL_KEY);
    const count = pool?.length ?? 0;
    return NextResponse.json({ inStock: count > 0, count });
  } catch {
    // On Redis error, fail safe — don't allow payment to proceed
    return NextResponse.json({ inStock: false, count: 0 });
  }
}
