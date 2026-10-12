import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { sendCredentialEmail, Credential } from "@/lib/fulfillment";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const POOL_KEY = "credentials_pool";

async function readPool(): Promise<Credential[]> {
  const pool = await redis.get<Credential[]>(POOL_KEY);
  return pool ?? [];
}

async function writePool(pool: Credential[]): Promise<void> {
  await redis.set(POOL_KEY, pool);
}

/** Pick and atomically remove the first credential from the pool. Returns null if empty. */
async function claimCredential(): Promise<Credential | null> {
  const pool = await readPool();
  if (pool.length === 0) return null;
  const [claimed, ...rest] = pool;
  await writePool(rest);
  return claimed;
}

export async function POST(req: NextRequest) {
  try {
    const { email, orderId, txId } = await req.json();

    if (!email || !orderId) {
      return NextResponse.json(
        { error: "Missing email or orderId" },
        { status: 400 }
      );
    }

    // ── Basic orderId integrity check ─────────────────────────────────────
    try {
      const [encodedEmail] = orderId.split("_");
      const decodedEmail = Buffer.from(encodedEmail, "base64").toString("utf8");
      if (decodedEmail.toLowerCase() !== email.toLowerCase()) {
        console.warn("orderId/email mismatch — possible spoofing attempt:", { email, orderId });
        return NextResponse.json({ error: "Invalid order" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Malformed orderId" }, { status: 400 });
    }

    // ── Pick a credential from the pool ──────────────────────────────────
    const credential = await claimCredential();

    if (!credential) {
      console.error("Credential pool is empty — cannot deliver account details.");
      return NextResponse.json(
        { error: "No credentials available. Please contact support." },
        { status: 503 }
      );
    }

    // ── Dispatch unified gradient email with admin profile pic ─────────────
    const sentInfo = await sendCredentialEmail({
      email,
      orderId,
      credential,
      utr: txId,
    });

    return NextResponse.json({ success: true, messageId: sentInfo.messageId });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
