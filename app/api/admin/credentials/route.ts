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
  emailPassword?: string;
  discordPassword?: string;
  password?: string;
  token?: string;
  domain?: string;
  twoFactorKey?: string;
  keyweb?: string;
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

// POST — add a credential (single or bulk batch)
export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  // Support batch import if an array or { credentials: [...] } is passed
  if (Array.isArray(body) || Array.isArray(body.credentials)) {
    const list: Record<string, unknown>[] = Array.isArray(body) ? body : body.credentials;
    const pool = await readPool();
    const addedList: Credential[] = [];

    for (const item of list) {
      if (
        item &&
        item.email &&
        (item.emailPassword || item.discordPassword || item.email_password || item.discord_password || item.password)
      ) {
        const ep = item.emailPassword ?? item.email_password ?? item.password;
        const dp = item.discordPassword ?? item.discord_password;
        const cred: Credential = {
          id: randomUUID(),
          email: String(item.email).trim(),
          emailPassword: ep ? String(ep).trim() : undefined,
          discordPassword: dp ? String(dp).trim() : undefined,
          token: item.token ? String(item.token).trim() : undefined,
          domain: item.domain ? String(item.domain).trim() : undefined,
          twoFactorKey: (item.twoFactorKey || item.twoFactor || item["2faKey"] || item["2fa"])
            ? String(item.twoFactorKey || item.twoFactor || item["2faKey"] || item["2fa"]).trim()
            : undefined,
          keyweb: (item.keyweb || item.webkey)
            ? String(item.keyweb || item.webkey).trim()
            : undefined,
          addedAt: new Date().toISOString(),
        };
        pool.push(cred);
        addedList.push(cred);
      }
    }

    if (addedList.length > 0) {
      await writePool(pool);
      return NextResponse.json(
        { success: true, count: addedList.length, credentials: addedList },
        { status: 201 }
      );
    } else {
      return NextResponse.json({ error: "No valid credentials found in batch" }, { status: 400 });
    }
  }

  // Single credential
  const {
    email,
    emailPassword,
    discordPassword,
    email_password,
    discord_password,
    password,
    token,
    domain,
    twoFactorKey,
    keyweb,
    twoFactor,
    webkey,
  } = body as {
    email?: string;
    emailPassword?: string;
    discordPassword?: string;
    email_password?: string;
    discord_password?: string;
    password?: string;
    token?: string;
    domain?: string;
    twoFactorKey?: string;
    keyweb?: string;
    twoFactor?: string;
    webkey?: string;
  };

  const finalEmailPass = (emailPassword || email_password || password)?.trim();
  const finalDiscordPass = (discordPassword || discord_password)?.trim();

  if (!email || (!finalEmailPass && !finalDiscordPass)) {
    return NextResponse.json(
      { error: "Account email and at least one password (email password or discord password) are required" },
      { status: 400 }
    );
  }

  const pool = await readPool();
  const raw2fa =
    twoFactorKey ||
    twoFactor ||
    (body as Record<string, unknown>)["2faKey"] ||
    (body as Record<string, unknown>)["2fa"];
  const rawKeyweb = keyweb || webkey;

  const newCredential: Credential = {
    id: randomUUID(),
    email: email.trim(),
    emailPassword: finalEmailPass || undefined,
    discordPassword: finalDiscordPass || undefined,
    token: token?.trim() || undefined,
    domain: domain?.trim() || undefined,
    twoFactorKey: raw2fa ? String(raw2fa).trim() : undefined,
    keyweb: rawKeyweb ? String(rawKeyweb).trim() : undefined,
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
