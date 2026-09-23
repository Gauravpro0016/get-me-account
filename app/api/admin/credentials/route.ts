import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { randomUUID } from "crypto";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type Credential = {
  id: string;
  email: string;
  password: string;
  addedAt: string;
};

const POOL_KEY = "credentials_pool";

async function readPool(): Promise<Credential[]> {
  const pool = await redis.get<Credential[]>(POOL_KEY);
  return pool ?? [];
}

async function writePool(pool: Credential[]): Promise<void> {
  await redis.set(POOL_KEY, pool);
}

function checkAdmin(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const provided = req.headers.get("x-admin-password");
  return !!adminPassword && provided === adminPassword;
}

// GET — list all credentials
export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pool = await readPool();
  return NextResponse.json({ credentials: pool, count: pool.length });
}

// POST — add a credential
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const pool = await readPool();
  const newCredential: Credential = {
    id: randomUUID(),
    email: email.trim(),
    password: password.trim(),
    addedAt: new Date().toISOString(),
  };

  pool.push(newCredential);
  await writePool(pool);

  return NextResponse.json({ success: true, credential: newCredential }, { status: 201 });
}

// DELETE — remove a credential by id
export async function DELETE(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = (await req.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const pool = await readPool();
  const next = pool.filter((c) => c.id !== id);

  if (next.length === pool.length) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  await writePool(next);
  return NextResponse.json({ success: true });
}
