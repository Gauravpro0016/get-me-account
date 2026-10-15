import nodemailer, { type SendMailOptions, type SentMessageInfo } from "nodemailer";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";
import { incrementCouponUsage } from "@/lib/coupons";
import {
  sendDiscordPurchaseNotification,
  sendDiscordLowStockAlert,
  sendDiscordEmailFailureAlert,
} from "@/lib/discord";
import {
  sendTelegramPurchaseNotification,
  sendTelegramLowStockAlert,
  sendTelegramEmailFailureAlert,
} from "@/lib/telegram";

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
  productId?: string;
  productName?: string;
  fields?: Record<string, string>;
};

export type CartOrderItem = {
  productId: string;
  productName?: string;
  quantity: number;
  price?: number;
};

export type OrderData = {
  email: string;
  amount: number;
  orderId: string;
  createdAt: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: CartOrderItem[];
  couponCode?: string;
  discountAmount?: number;
};

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const POOL_KEY = "credentials_pool";
export const DELETED_CREDENTIALS_KEY = "trinitymart_deleted_credentials";
export const CLAIMED_CREDENTIALS_KEY = "trinitymart_claimed_credentials";
export const SENT_KEY = (orderId: string) => `sent:${orderId}`;
export const ORDER_KEY = (orderId: string) => `order:${orderId}`;
export const FULFILLED_KEY = (orderId: string) => `fulfilled:${orderId}`;

/**
 * Returns a Set of all blacklisted credential identifiers (deleted or already claimed).
 * Matches IDs, emails, usernames, and license tokens (case-insensitive).
 */
export async function getBlacklist(): Promise<Set<string>> {
  try {
    const [deleted, claimed] = await Promise.all([
      redis.get<string[]>(DELETED_CREDENTIALS_KEY),
      redis.get<string[]>(CLAIMED_CREDENTIALS_KEY),
    ]);
    const set = new Set<string>();
    if (Array.isArray(deleted)) {
      for (const d of deleted) {
        if (d && typeof d === "string") set.add(d.trim().toLowerCase());
      }
    }
    if (Array.isArray(claimed)) {
      for (const c of claimed) {
        if (c && typeof c === "string") set.add(c.trim().toLowerCase());
      }
    }
    return set;
  } catch {
    return new Set<string>();
  }
}

/**
 * Permanently mark credentials as deleted so they can NEVER be claimed, migrated, or sent.
 */
export async function markCredentialDeleted(identifiers: (string | undefined | null)[]): Promise<void> {
  const valid = identifiers
    .filter((x): x is string => !!x && typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
  if (valid.length === 0) return;

  try {
    const existing = (await redis.get<string[]>(DELETED_CREDENTIALS_KEY)) || [];
    const set = new Set(Array.isArray(existing) ? existing.map((x) => String(x).toLowerCase()) : []);
    for (const v of valid) set.add(v);
    await redis.set(DELETED_CREDENTIALS_KEY, Array.from(set));
  } catch (err) {
    console.warn("Failed to mark credential as deleted:", err);
  }
}

/**
 * Permanently mark credentials as claimed so they cannot be fulfilled a second time.
 */
export async function markCredentialClaimed(identifiers: (string | undefined | null)[]): Promise<void> {
  const valid = identifiers
    .filter((x): x is string => !!x && typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
  if (valid.length === 0) return;

  try {
    const existing = (await redis.get<string[]>(CLAIMED_CREDENTIALS_KEY)) || [];
    const set = new Set(Array.isArray(existing) ? existing.map((x) => String(x).toLowerCase()) : []);
    for (const v of valid) set.add(v);
    await redis.set(CLAIMED_CREDENTIALS_KEY, Array.from(set));
  } catch (err) {
    console.warn("Failed to mark credential as claimed:", err);
  }
}

/**
 * Remove credentials from blacklist when an admin explicitly restocks / adds them,
 * ensuring newly added accounts are never auto-purged from inventory.
 */
export async function unblacklistCredentials(identifiers: (string | undefined | null)[]): Promise<void> {
  const valid = identifiers
    .filter((x): x is string => !!x && typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
  if (valid.length === 0) return;

  const validSet = new Set(valid);

  try {
    const [deleted, claimed] = await Promise.all([
      redis.get<string[]>(DELETED_CREDENTIALS_KEY),
      redis.get<string[]>(CLAIMED_CREDENTIALS_KEY),
    ]);

    if (Array.isArray(deleted) && deleted.length > 0) {
      const filteredDeleted = deleted.filter((d) => d && !validSet.has(String(d).toLowerCase().trim()));
      if (filteredDeleted.length !== deleted.length) {
        await redis.set(DELETED_CREDENTIALS_KEY, filteredDeleted);
      }
    }

    if (Array.isArray(claimed) && claimed.length > 0) {
      const filteredClaimed = claimed.filter((c) => c && !validSet.has(String(c).toLowerCase().trim()));
      if (filteredClaimed.length !== claimed.length) {
        await redis.set(CLAIMED_CREDENTIALS_KEY, filteredClaimed);
      }
    }
  } catch (err) {
    console.warn("Failed to unblacklist credentials:", err);
  }
}

export async function readPool(): Promise<Credential[]> {
  const pool = await redis.get<Credential[]>(POOL_KEY);
  if (!pool || !Array.isArray(pool)) return [];

  const blacklist = await getBlacklist();
  if (blacklist.size === 0) return pool;

  return pool.filter((c) => {
    const id = String(c.id || "").trim().toLowerCase();
    const em = String(c.email || "").trim().toLowerCase();
    const tok = String(c.token || "").trim().toLowerCase();
    return !blacklist.has(id) && !blacklist.has(em) && (!tok || !blacklist.has(tok));
  });
}

export async function writePool(pool: Credential[]): Promise<void> {
  await redis.set(POOL_KEY, pool);
}

/**
 * Claim multiple available credentials from the pool atomically.
 */
export async function claimCredentials(quantity: number = 1): Promise<Credential[]> {
  const count = Math.max(1, quantity);
  const pool = await readPool();
  if (!pool || pool.length === 0) return [];
  const claimed = pool.slice(0, count);
  const rest = pool.slice(count);
  await writePool(rest);

  // Permanently record in claimed blacklist
  const identifiers: string[] = [];
  for (const c of claimed) {
    if (c.id) identifiers.push(c.id);
    if (c.email) identifiers.push(c.email);
    if (c.token) identifiers.push(c.token);
  }
  await markCredentialClaimed(identifiers);

  return claimed;
}

/**
 * Claim the first available credential from the pool atomically.
 */
export async function claimCredential(): Promise<Credential | null> {
  const [claimed] = await claimCredentials(1);
  return claimed ?? null;
}

/**
 * Claim available credentials for a specific product from its database inventory in Redis.
 * Redis key: `trinitymart_inventory_${productId}`
 * Strictly drops any deleted or blacklisted credentials, and prevents duplicate deliveries.
 */
export async function claimProductCredentials({
  productId,
  quantity = 1,
  orderId,
  customerEmail,
  productName,
}: {
  productId: string;
  quantity: number;
  orderId: string;
  customerEmail?: string;
  productName?: string;
}): Promise<Credential[]> {
  const count = Math.max(1, quantity);
  const invKey = `trinitymart_inventory_${productId}`;
  const nowIso = new Date().toISOString();
  const blacklist = await getBlacklist();

  let inventory: any[] = [];
  try {
    inventory = (await redis.get<any[]>(invKey)) || [];
  } catch (err) {
    console.warn(`Failed to read inventory for product ${productId}:`, err);
  }

  // Also check if inventory is embedded in trinitymart_custom_products if invKey was empty
  if (!inventory || inventory.length === 0) {
    try {
      const customProducts = (await redis.get<any[]>("trinitymart_custom_products")) || [];
      const prod = customProducts.find((p) => p.id === productId);
      if (prod && Array.isArray(prod.inventory) && prod.inventory.length > 0) {
        inventory = prod.inventory;
      }
    } catch {}
  }

  // Filter out any credentials that are already marked claimed or deleted
  if (Array.isArray(inventory) && inventory.length > 0) {
    inventory = inventory.filter((item) => {
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
  }

  // Also check if inventory is in credentials_pool ONLY if productId is discord-nitro-booster
  if ((!inventory || inventory.length === 0) && productId === "discord-nitro-booster") {
    try {
      const pool = (await redis.get<any[]>("credentials_pool")) || [];
      if (Array.isArray(pool) && pool.length > 0) {
        const cleanPool = pool.filter((item: any) => {
          const id = String(item.id || "").trim().toLowerCase();
          const em = String(item.email || "").trim().toLowerCase();
          const tok = String(item.token || "").trim().toLowerCase();
          return !blacklist.has(id) && !blacklist.has(em) && (!tok || !blacklist.has(tok));
        });

        if (cleanPool.length > 0) {
          inventory = cleanPool.map((item: any) => ({
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
          await redis.set(invKey, inventory);
        }
      }
    } catch {}
  }

  const unclaimedIndices: number[] = [];
  if (Array.isArray(inventory)) {
    inventory.forEach((item, idx) => {
      if (!item.claimedAt) {
        unclaimedIndices.push(idx);
      }
    });
  }

  const claimedCredentials: Credential[] = [];

  if (unclaimedIndices.length > 0) {
    const toClaim = unclaimedIndices.slice(0, count);
    const toClaimIndicesSet = new Set(toClaim);
    const claimedItemIds = new Set<string>();

    for (const idx of toClaim) {
      const item = inventory[idx];
      if (!item) continue;
      if (item.id) claimedItemIds.add(item.id);
      const f = item.fields || {};

      claimedCredentials.push({
        id: item.id || `cred-${Date.now()}-${idx}`,
        email: f.id || f.email || f.username || customerEmail || "Account Delivered",
        password: f.password || f.pass || f.emailPassword,
        emailPassword: f.emailPassword || f.password,
        discordPassword: f.discordPassword,
        token: f.token || f.key || f.license || f.code,
        domain: f.domain,
        twoFactorKey: f.pin || f.twoFactorKey || f["2fa"] || f.twoFactor,
        keyweb: f.keyweb,
        addedAt: item.addedAt || nowIso,
        productId,
        productName: productName || f.productName,
        fields: f,
      });
    }

    // Permanently remove purchased credentials from product inventory!
    const remainingInventory = inventory.filter((item, idx) => {
      if (toClaimIndicesSet.has(idx)) return false;
      if (item.id && claimedItemIds.has(item.id)) return false;
      return true;
    });

    // Write updated inventory back to Redis without the purchased credentials
    try {
      await redis.set(invKey, remainingInventory);
    } catch (e) {
      console.error(`Failed to save updated inventory for ${productId}:`, e);
    }

    // Immediately update live database stock count in overrides
    const remainingActive = remainingInventory.length;
    try {
      let overrides = (await redis.get<Record<string, any>>("trinitymart_product_overrides")) || {};
      overrides[productId] = {
        ...(overrides[productId] || {}),
        id: productId,
        stockCount: remainingActive,
        inStock: remainingActive > 0,
        updatedAt: nowIso,
      };
      await redis.set("trinitymart_product_overrides", overrides);
    } catch (e) {
      console.warn("Failed to update product overrides:", e);
    }

    // Also update custom products if custom
    try {
      const customProducts = (await redis.get<any[]>("trinitymart_custom_products")) || [];
      const cIdx = customProducts.findIndex((p) => p.id === productId);
      if (cIdx !== -1) {
        customProducts[cIdx].inventory = remainingInventory;
        customProducts[cIdx].stockCount = remainingActive;
        customProducts[cIdx].inStock = remainingActive > 0;
        await redis.set("trinitymart_custom_products", customProducts);
      }
    } catch (e) {
      console.warn("Failed to update custom products stock:", e);
    }

    // If discord-nitro-booster, also clean up credentials_pool
    if (productId === "discord-nitro-booster" && claimedCredentials.length > 0) {
      try {
        const pool = (await redis.get<any[]>("credentials_pool")) || [];
        if (Array.isArray(pool) && pool.length > 0) {
          const claimedEmails = new Set(claimedCredentials.map((c) => (c.email || "").toLowerCase()));
          const updatedPool = pool.filter((p) => !claimedEmails.has((p.email || p.id || "").toLowerCase()));
          await redis.set("credentials_pool", updatedPool);
        }
      } catch (e) {
        console.warn("Failed to clean credentials_pool:", e);
      }
    }

    // Mark claimed items in persistent blacklist
    const identifiersToMark: string[] = [];
    for (const c of claimedCredentials) {
      if (c.id && !c.id.startsWith("cred-")) identifiersToMark.push(c.id);
      const rawItemEmail = (c.fields?.email || c.fields?.id || "").trim();
      if (
        rawItemEmail &&
        rawItemEmail.toLowerCase() !== "account delivered" &&
        (!customerEmail || rawItemEmail.toLowerCase() !== customerEmail.toLowerCase())
      ) {
        identifiersToMark.push(rawItemEmail);
      }
      const rawToken = (c.fields?.token || c.token || "").trim();
      if (rawToken) identifiersToMark.push(rawToken);
    }
    await markCredentialClaimed(identifiersToMark);
  }

  // If we claimed all requested items, return them
  if (claimedCredentials.length >= count) {
    return claimedCredentials;
  }

  // If product inventory had fewer items than requested:
  const stillNeeded = count - claimedCredentials.length;

  // 1. Try legacy credentials pool ONLY if product is specifically discord-nitro-booster
  if (productId === "discord-nitro-booster" && stillNeeded > 0) {
    try {
      const fromPool = await claimCredentials(stillNeeded);
      if (fromPool && fromPool.length > 0) {
        fromPool.forEach((c) => {
          claimedCredentials.push({
            ...c,
            productId,
            productName: productName || c.productName,
          });
        });
      }
    } catch (e) {
      console.warn("Legacy pool fallback error:", e);
    }
  }

  return claimedCredentials;
}

/**
 * Acquire idempotency lock so credentials are sent only once.
 */
export async function markAsSent(orderId: string): Promise<boolean> {
  const result = await redis.set(SENT_KEY(orderId), "1", {
    nx: true,
    ex: 60 * 60 * 24 * 7, // 7 days TTL
  });
  return result === "OK";
}

export async function isAlreadySent(orderId: string): Promise<boolean> {
  const exists = await redis.get(SENT_KEY(orderId));
  return !!exists;
}

export async function storeOrder(orderId: string, data: OrderData): Promise<void> {
  await redis.set(ORDER_KEY(orderId), data, {
    ex: 60 * 60 * 24 * 2, // 2 days TTL
  });
}

export async function getOrder(orderId: string): Promise<OrderData | null> {
  return await redis.get<OrderData>(ORDER_KEY(orderId));
}

export async function storeFulfilledCredentials(
  orderId: string,
  credentials: Credential[]
): Promise<void> {
  await redis.set(FULFILLED_KEY(orderId), credentials, {
    ex: 60 * 60 * 24 * 7,
  });
}

export async function storeFulfilledCredential(
  orderId: string,
  credential: Credential
): Promise<void> {
  await storeFulfilledCredentials(orderId, [credential]);
}

export async function getFulfilledCredentials(
  orderId: string
): Promise<Credential[]> {
  const raw = await redis.get<Credential | Credential[]>(FULFILLED_KEY(orderId));
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [raw];
}

export async function getFulfilledCredential(
  orderId: string
): Promise<Credential | null> {
  const list = await getFulfilledCredentials(orderId);
  return list[0] ?? null;
}

export const ADMIN_PROFILE_PIC_KEY = "trinitymart_admin_profile_pic";

/**
 * Retrieve the current Admin Profile Picture URL or Base64 data from Redis,
 * environment variables, or local default.
 */
export async function getAdminProfilePic(): Promise<string> {
  try {
    const saved = await redis.get<string>(ADMIN_PROFILE_PIC_KEY);
    if (saved && typeof saved === "string" && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.warn("Could not read admin profile pic from Redis:", e);
  }
  return (
    process.env.ADMIN_PROFILE_PIC ||
    process.env.NEXT_PUBLIC_ADMIN_PROFILE_PIC ||
    "/admin-profile.jpg"
  );
}

/**
 * Persist updated Admin Profile Picture URL or Base64 data into Redis.
 */
export async function setAdminProfilePic(picUrl: string): Promise<void> {
  await redis.set(ADMIN_PROFILE_PIC_KEY, picUrl.trim());
}

export function readEnvLocalValue(key: string): string | undefined {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            if (k === key) {
              const val = trimmed.substring(idx + 1).trim();
              return val.replace(/^["']|["']$/g, "");
            }
          }
        }
      }
    }
  } catch {}
  return undefined;
}

export const ADMIN_SMTP_CONFIG_KEY = "trinitymart_smtp_config";

export async function getAdminSmtpConfig(): Promise<{ user: string; pass: string }> {
  try {
    const raw = await redis.get<{ user: string; pass: string }>(ADMIN_SMTP_CONFIG_KEY);
    if (raw && raw.user && raw.pass) {
      return {
        user: raw.user.trim().replace(/^["']|["']$/g, ""),
        pass: raw.pass.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, ""),
      };
    }
  } catch (err) {
    console.warn("Could not read ADMIN_SMTP_CONFIG_KEY from Redis:", err);
  }

  const fileUser = readEnvLocalValue("GMAIL_USER");
  const filePass = readEnvLocalValue("GMAIL_APP_PASSWORD");

  return {
    user: (fileUser || process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, ""),
    pass: (filePass || process.env.GMAIL_APP_PASSWORD || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, ""),
  };
}

export async function setAdminSmtpConfig(config: { user: string; pass: string }): Promise<void> {
  const cleanUser = config.user.trim().replace(/^["']|["']$/g, "");
  const cleanPass = config.pass.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  await redis.set(ADMIN_SMTP_CONFIG_KEY, { user: cleanUser, pass: cleanPass });
}

export function createMailTransporter(
  customCreds?: { user?: string; pass?: string },
  port: 465 | 587 = 465
) {
  const fileUser = readEnvLocalValue("GMAIL_USER");
  const filePass = readEnvLocalValue("GMAIL_APP_PASSWORD");

  const user = (customCreds?.user || fileUser || process.env.GMAIL_USER || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  const pass = (customCreds?.pass || filePass || process.env.GMAIL_APP_PASSWORD || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port,
    secure: isSecure,
    requireTLS: !isSecure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 15000,
  });
}

/**
 * Robust email dispatch with dual-port (465 SSL & 587 TLS) and credential fallback.
 * Automatically tries port 465 first; on timeout/connection drops, tries port 587.
 * If authentication fails with Redis credentials, automatically falls back to .env.local/process.env credentials.
 */
export async function sendMailWithFallback(
  mailOptions: SendMailOptions,
  customCreds?: { user?: string; pass?: string }
): Promise<SentMessageInfo> {
  // 1. Try port 465 with provided credentials
  try {
    const transporter465 = createMailTransporter(customCreds, 465);
    return await transporter465.sendMail(mailOptions);
  } catch (err465: any) {
    console.warn("[MAIL] Port 465 attempt failed:", err465?.message || err465);

    const isAuthError =
      err465?.code === "EAUTH" ||
      err465?.responseCode === 535 ||
      String(err465?.message).includes("535") ||
      String(err465?.message).includes("BadCredentials");

    const fileUser = readEnvLocalValue("GMAIL_USER") || process.env.GMAIL_USER;
    const filePass = readEnvLocalValue("GMAIL_APP_PASSWORD") || process.env.GMAIL_APP_PASSWORD;
    const envCreds = fileUser && filePass ? { user: fileUser, pass: filePass } : undefined;

    // If auth error occurred on Redis config, retry with .env.local / process.env config
    if (isAuthError && envCreds && (envCreds.user !== customCreds?.user || envCreds.pass !== customCreds?.pass)) {
      console.log("[MAIL] Retrying with environment / .env.local credentials due to auth failure...");
      try {
        const envTransporter465 = createMailTransporter(envCreds, 465);
        return await envTransporter465.sendMail(mailOptions);
      } catch (envErr) {
        console.warn("[MAIL] Environment credentials on port 465 failed, trying port 587...", envErr);
        const envTransporter587 = createMailTransporter(envCreds, 587);
        return await envTransporter587.sendMail(mailOptions);
      }
    }

    // 2. Try port 587 with STARTTLS
    console.log("[MAIL] Retrying delivery on Port 587 (STARTTLS)...");
    try {
      const transporter587 = createMailTransporter(customCreds, 587);
      return await transporter587.sendMail(mailOptions);
    } catch (err587: any) {
      // 3. If attachments were present, try without attachments in case of size timeout
      if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        console.warn("[MAIL] Retrying without attachments to avoid payload limits/timeouts...");
        try {
          const strippedOptions = { ...mailOptions, attachments: [] };
          const transporterFallback = createMailTransporter(customCreds, 587);
          return await transporterFallback.sendMail(strippedOptions);
        } catch {
          // If still fails, throw error
        }
      }
      throw err587;
    }
  }
}

export async function sendCredentialEmail({
  email,
  orderId,
  credential,
  credentials,
  utr,
  senderName,
  amount = APP_CONFIG.price,
  productName,
}: {
  email: string;
  orderId: string;
  credential?: Credential;
  credentials?: Credential[];
  utr?: string;
  senderName?: string;
  amount?: number | string;
  productName?: string;
}): Promise<SentMessageInfo> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error(`Invalid recipient email for order ${orderId}: "${email}"`);
  }

  const allCreds = credentials && credentials.length > 0 ? credentials : (credential ? [credential] : []);
  const qty = allCreds.length;
  const primaryTitle = productName || allCreds[0]?.productName || "Trinitymart Digital Asset";

  const baseUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://get-me-account.vercel.app"
  ).replace(/\/+$/, "");

  const trackingPixelUrl = `${baseUrl}/api/track-email?orderId=${encodeURIComponent(orderId)}`;
  const confirmReceiptUrl = `${baseUrl}/api/track-email/confirm?orderId=${encodeURIComponent(orderId)}`;
  const orderTrackingUrl = `${baseUrl}/orders/lookup?orderId=${encodeURIComponent(orderId)}`;
  const emailDiscordUrl =
    process.env.DISCORD_LINK ||
    process.env.NEXT_PUBLIC_DISCORD_LINK ||
    (APP_CONFIG.discordLink && APP_CONFIG.discordLink.startsWith("http")
      ? APP_CONFIG.discordLink
      : `${baseUrl}/discord`);

  // ── Profile Picture Resolution & Inline Attachment ───────────────────────
  const configuredPic = await getAdminProfilePic();
  const attachments: Array<{
    filename?: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
  }> = [];

  let avatarImgSrc = "";
  const publicJpgPath = path.join(process.cwd(), "public", "admin-profile.jpg");

  if (configuredPic && configuredPic.startsWith("data:image/")) {
    const match = configuredPic.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      attachments.push({
        filename: "admin-avatar.png",
        content: Buffer.from(match[2], "base64"),
        contentType: match[1],
        cid: "admin-profile-avatar",
      });
      avatarImgSrc = "cid:admin-profile-avatar";
    } else {
      avatarImgSrc = `${baseUrl}/admin-profile.jpg`;
    }
  } else if (configuredPic && (configuredPic.startsWith("http://") || configuredPic.startsWith("https://"))) {
    avatarImgSrc = configuredPic;
  } else if (fs.existsSync(publicJpgPath)) {
    attachments.push({
      filename: "admin-profile.jpg",
      path: publicJpgPath,
      cid: "admin-profile-avatar",
    });
    avatarImgSrc = "cid:admin-profile-avatar";
  } else {
    avatarImgSrc = `${baseUrl}/admin-profile.jpg`;
  }

  // ── Credentials HTML formatting with rich gradient cards ────────────────
  const credentialsHtml = allCreds
    .map((cred, idx) => {
      const itemTitle = cred.productName || primaryTitle;
      const accountId = cred.fields?.id || cred.fields?.username || cred.fields?.login || (cred.email !== email ? cred.email : "");
      const password = cred.fields?.password || cred.password || cred.emailPassword;
      const token = cred.fields?.token || cred.token || cred.fields?.key;
      const pin = cred.fields?.pin || cred.twoFactorKey || cred.fields?.["2fa"];

      const standardKeys = new Set([
        "id",
        "email",
        "username",
        "login",
        "password",
        "emailPassword",
        "discordPassword",
        "token",
        "key",
        "license",
        "code",
        "pin",
        "twoFactorKey",
        "2fa",
        "twoFactor",
        "domain",
        "keyweb",
        "productName",
      ]);

      const customFieldsHtml = cred.fields
        ? Object.entries(cred.fields)
            .filter(([k, v]) => !standardKeys.has(k) && Boolean(v))
            .map(
              ([k, v]) => `
      <tr>
        <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">${k}:</td>
        <td style="padding:4px 0;">
          <div style="background:#090d16;color:#e2e8f0;font-size:13px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
            ${String(v)}
          </div>
        </td>
      </tr>`
            )
            .join("")
        : "";

      return `
    <div style="background:linear-gradient(180deg,#14192b 0%,#0c101d 100%);border:1.5px solid #29354d;border-radius:16px;padding:22px;margin:18px 0;box-shadow:0 12px 30px rgba(0,0,0,0.5);">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:12px;">
        <tr>
          <td>
            <span style="background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;font-size:11px;font-weight:800;padding:5px 12px;border-radius:8px;text-transform:uppercase;letter-spacing:0.6px;display:inline-block;">
              🔑 ${qty > 1 ? `Unit #${idx + 1} &mdash; ${itemTitle}` : `Credentials &bull; ${itemTitle}`}
            </span>
          </td>
          <td align="right">
            <span style="color:#34d399;font-size:11px;font-weight:700;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);border-radius:16px;padding:3px 10px;display:inline-block;">
              ● Verified &amp; Active
            </span>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0">
        ${accountId ? `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">Account ID / Login</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#38bdf8;font-size:14px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
              ${accountId}
            </div>
          </td>
        </tr>` : `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">Customer Email</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#38bdf8;font-size:14px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
              ${cred.email}
            </div>
          </td>
        </tr>`}
        ${password ? `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">Password</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#4ade80;font-size:14px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
              ${password}
            </div>
          </td>
        </tr>` : ""}
        ${token ? `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">License / Key</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#c084fc;font-size:13px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
              ${token}
            </div>
          </td>
        </tr>` : ""}
        ${pin ? `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">2FA / PIN Code</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#fbbf24;font-size:14px;font-weight:700;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;word-break:break-all;">
              ${pin}
            </div>
          </td>
        </tr>` : ""}
        ${customFieldsHtml}
        ${cred.domain ? `
        <tr>
          <td style="color:#94a3b8;font-size:13px;padding:6px 0;width:130px;font-weight:600;">Domain</td>
          <td style="padding:4px 0;">
            <div style="background:#090d16;color:#e2e8f0;font-size:13px;font-weight:600;font-family:'Courier New',Courier,monospace;padding:9px 14px;border-radius:8px;border:1px solid #1e293b;">
              ${cred.domain}
            </div>
          </td>
        </tr>` : ""}
      </table>

      <div style="margin-top:14px;padding:10px 14px;background:rgba(6,182,212,0.06);border-left:3px solid #06b6d4;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
          🔒 <strong style="color:#e2e8f0;">Security tip:</strong> Save credentials safely. Full replacement warranty is active.
        </p>
      </div>
    </div>`;
    })
    .join("");

  const smtp = await getAdminSmtpConfig();
  const adminUser = smtp.user || (process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, "");

  return await sendMailWithFallback({
    from: `"Trinitymart Store" <${adminUser}>`,
    to: cleanEmail,
    bcc: adminUser && adminUser.toLowerCase() !== cleanEmail.toLowerCase() ? adminUser : undefined,
    subject: `✅ Your ${primaryTitle} [Order #${orderId}] — Payment Confirmed & Delivered`,
    attachments,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${primaryTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#dfe2ee;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 12px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111524;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);border:1px solid #232b42;">
                
                <!-- ── GRADIENT HEADER WITH ADMIN PROFILE PIC ── -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e1b4b 0%,#2e1065 50%,#0f172a 100%);padding:40px 32px 32px 32px;text-align:center;border-bottom:1px solid #2e3856;">
                    
                    <!-- Admin Profile Picture with Glowing Gradient Ring -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px auto;">
                      <tr>
                        <td align="center">
                          <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899);padding:3px;box-shadow:0 0 25px rgba(6,182,212,0.45);display:inline-block;">
                            <img src="${avatarImgSrc}" width="80" height="80" alt="Admin Profile" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:block;background:#0f172a;" />
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Official Admin Dispatcher Badge -->
                    <div style="text-align:center;margin-bottom:12px;">
                      <span style="display:inline-block;background:linear-gradient(135deg,rgba(6,182,212,0.2),rgba(139,92,246,0.2));border:1px solid rgba(56,189,248,0.4);border-radius:24px;padding:5px 16px;font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:0.8px;text-transform:uppercase;">
                        🛡️ TRINITYMART DISPATCH &bull; VERIFIED ADMIN
                      </span>
                    </div>

                    <!-- Thank You Heading (Rich Gradient Accent) -->
                    <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">
                      Thank You for Your Order! 🎉
                    </h1>
                    <p style="margin:0 auto;color:#cbd5e1;font-size:14px;line-height:1.6;max-width:460px;">
                      Hi ${senderName ? `<strong style="color:#ffffff;">${senderName}</strong>` : "there"}, your payment of <strong style="color:#34d399;">₹${amount}</strong> was confirmed successfully. Your digital assets are delivered below.
                    </p>
                  </td>
                </tr>

                <!-- ── MAIN BODY CONTENT ── -->
                <tr>
                  <td style="padding:32px 28px;">
                    
                    <!-- Warranty Guarantee Banner -->
                    <div style="display:flex;align-items:center;background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:14px 18px;margin-bottom:24px;">
                      <span style="font-size:22px;margin-right:12px;">🛡️</span>
                      <div style="font-size:13px;color:#a7f3d0;line-height:1.5;">
                        <strong style="color:#34d399;">Full Replacement Warranty Active:</strong> Every unit is verified and backed by replacement guarantee. Need help? 24/7 Discord support is always on standby.
                      </div>
                    </div>

                    <!-- ── CREDENTIALS SECTION (GRADIENT STYLED) ── -->
                    <div style="margin:20px 0;">
                      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;">
                          ⚡ Instant Delivered Credentials
                        </span>
                        <span style="font-size:12px;color:#94a3b8;">
                          ${qty} Unit(s)
                        </span>
                      </div>
                      ${credentialsHtml}
                    </div>

                    <!-- ── LIVE ORDER TRACKING & MANAGEMENT CARD ── -->
                    <div style="background:linear-gradient(135deg,rgba(16,24,39,0.95) 0%,rgba(30,41,59,0.95) 100%);border:1.5px solid #06b6d4;border-radius:18px;padding:22px;margin:24px 0;box-shadow:0 8px 30px rgba(6,182,212,0.18);">
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                        <tr>
                          <td>
                            <span style="font-size:11px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;background:rgba(6,182,212,0.15);padding:4px 10px;border-radius:6px;border:1px solid rgba(6,182,212,0.3);">
                              📦 ORDER TRACKING &amp; LOOKUP
                            </span>
                          </td>
                          <td align="right">
                            <span style="font-size:11px;font-weight:700;color:#34d399;">
                              ● Delivered &amp; Active
                            </span>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:8px 0 14px 0;font-size:13px;color:#cbd5e1;line-height:1.5;">
                        Save your <strong>Order ID</strong>! You can track warranty status, view transaction history, or re-access credentials anytime:
                      </p>

                      <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;margin-bottom:16px;text-align:center;">
                        <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">
                          YOUR OFFICIAL ORDER ID
                        </div>
                        <div style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:800;color:#38bdf8;letter-spacing:1px;word-break:break-all;">
                          ${orderId}
                        </div>
                      </div>

                      <div style="text-align:center;">
                        <a href="${orderTrackingUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#3b82f6 100%);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:800;font-size:13px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(6,182,212,0.35);">
                          🔍 Track Your Order &amp; Access Dashboard &rarr;
                        </a>
                      </div>
                    </div>

                    <!-- ── OFFICIAL INVOICE & WEB RECEIPT (GRADIENT BUTTON) ── -->
                    <div style="background:linear-gradient(135deg,rgba(15,23,42,0.95) 0%,rgba(24,30,54,0.95) 100%);border:1.5px solid #3b82f6;border-radius:18px;padding:24px;margin:26px 0;box-shadow:0 8px 32px rgba(37,99,235,0.2);">
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
                        <tr>
                          <td>
                            <div style="font-size:12px;font-weight:800;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;">
                              📄 OFFICIAL INVOICE &amp; PAYMENT SUMMARY
                            </div>
                          </td>
                          <td align="right">
                            <span style="font-size:11px;font-weight:700;color:#34d399;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.3);padding:3px 10px;border-radius:20px;">
                              PAID IN FULL
                            </span>
                          </td>
                        </tr>
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Product</td>
                          <td style="color:#ffffff;font-weight:700;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${primaryTitle}</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Quantity</td>
                          <td style="color:#38bdf8;font-weight:700;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${qty} Unit(s)</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Invoice / Order ID</td>
                          <td style="color:#60a5fa;font-weight:700;text-align:right;font-family:'Courier New',Courier,monospace;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${orderId}</td>
                        </tr>
                        ${utr ? `
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Bank UTR Reference</td>
                          <td style="color:#e2e8f0;font-weight:700;text-align:right;font-family:'Courier New',Courier,monospace;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${utr}</td>
                        </tr>` : ""}
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Amount Paid</td>
                          <td style="color:#34d399;font-weight:800;font-size:15px;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">₹${amount}</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;">Warranty Coverage</td>
                          <td style="color:#34d399;font-weight:700;text-align:right;padding:6px 0;">Lifetime Replacement Active</td>
                        </tr>
                      </table>

                      <!-- Glowing Gradient Invoice Link Button -->
                      <div style="text-align:center;margin-top:20px;">
                        <a href="${confirmReceiptUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#2563eb 50%,#7c3aed 100%);color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.4px;box-shadow:0 6px 24px rgba(6,182,212,0.45);border:1px solid rgba(255,255,255,0.25);">
                          📄 View Official Invoice &amp; Confirm Delivery &rarr;
                        </a>
                        <p style="margin:10px 0 0 0;font-size:11px;color:#94a3b8;">
                          Click to open your live web invoice, save receipt &amp; log delivery in 1 click.
                        </p>
                      </div>
                    </div>

                    <!-- ── 24/7 DISCORD SUPPORT BOX ── -->
                    <div style="background:linear-gradient(135deg,rgba(88,101,242,0.15) 0%,rgba(124,58,237,0.12) 100%);border:1px solid rgba(88,101,242,0.35);border-radius:16px;padding:22px 20px;text-align:center;margin:22px 0;">
                      <p style="margin:0 0 6px;font-weight:800;color:#818cf8;font-size:15px;">💬 Need Help? 24/7 Live Discord Support</p>
                      <p style="margin:0 0 14px;color:#94a3b8;font-size:13px;line-height:1.5;">Join our official server for warranty replacements, ticket assistance, and instant guide downloads.</p>
                      <a href="${emailDiscordUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#5865F2,#7c3aed);color:#ffffff;text-decoration:none;padding:11px 26px;border-radius:10px;font-weight:700;font-size:13px;box-shadow:0 4px 14px rgba(88,101,242,0.35);">
                        Join Official Discord Server &rarr;
                      </a>
                    </div>

                    <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                      Please save these credentials safely and change the passwords if desired.
                    </p>
                  </td>
                </tr>

                <!-- ── FOOTER ── -->
                <tr>
                  <td style="background:#090d16;border-top:1px solid #1e293b;padding:22px 36px;text-align:center;">
                    <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;">
                      Trinitymart &bull; Automated Digital Goods Dispatch &bull; 24/7 Support
                    </p>
                    <p style="margin:0;color:#475569;font-size:11px;">
                      Track this order anytime at <a href="${orderTrackingUrl}" style="color:#38bdf8;text-decoration:none;">${baseUrl}/orders/lookup</a> with Order ID: ${orderId}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
        <!-- Invisible 1x1 Delivery Tracking Pixel -->
        <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none!important;width:1px!important;height:1px!important;border:0!important;outline:none!important;opacity:0!important;" />
      </body>
      </html>
    `,
  }, smtp);
}

/**
 * Sends Order Initiated / Tracking Link email to customer as soon as order is created.
 * Provides the Order ID and direct link to /orders/lookup?orderId=... so the buyer
 * can easily track their payment confirmation and credentials delivery in real time.
 */
export async function sendOrderInitiatedEmail({
  orderId,
  email,
  amount = APP_CONFIG.price,
  quantity = 1,
  productName,
  cartItems,
  paymentMethod = "upi",
}: {
  orderId: string;
  email: string;
  amount?: number | string;
  quantity?: number;
  productName?: string;
  cartItems?: CartOrderItem[];
  paymentMethod?: "upi" | "crypto" | string;
}): Promise<SentMessageInfo | null> {
  if (!email || !email.includes("@")) {
    return null;
  }

  // Deduplicate using Redis to avoid sending multiple emails for the same order
  const lockKey = `email_initiated_sent:${orderId}`;
  try {
    const alreadySent = await redis.get(lockKey);
    if (alreadySent) {
      console.log(`[INITIATED EMAIL] Already sent for order ${orderId}, skipping.`);
      return null;
    }
  } catch (err) {
    console.warn("Could not check email_initiated_sent lock:", err);
  }

  const primaryTitle =
    productName ||
    (cartItems && cartItems.length > 0
      ? `${cartItems.length} Products`
      : "Trinitymart Digital Asset");

  const baseUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://get-me-account.vercel.app"
  ).replace(/\/+$/, "");

  const orderTrackingUrl = `${baseUrl}/orders/lookup?orderId=${encodeURIComponent(orderId)}`;
  const emailDiscordUrl =
    process.env.DISCORD_LINK ||
    process.env.NEXT_PUBLIC_DISCORD_LINK ||
    (APP_CONFIG.discordLink && APP_CONFIG.discordLink.startsWith("http")
      ? APP_CONFIG.discordLink
      : `${baseUrl}/discord`);

  const configuredPic = await getAdminProfilePic();
  const attachments: Array<{
    filename?: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
  }> = [];

  let avatarImgSrc = "";
  const publicJpgPath = path.join(process.cwd(), "public", "admin-profile.jpg");

  if (configuredPic && configuredPic.startsWith("data:image/")) {
    const match = configuredPic.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      attachments.push({
        filename: "admin-avatar.png",
        content: Buffer.from(match[2], "base64"),
        contentType: match[1],
        cid: "admin-profile-avatar",
      });
      avatarImgSrc = "cid:admin-profile-avatar";
    } else {
      avatarImgSrc = `${baseUrl}/admin-profile.jpg`;
    }
  } else if (configuredPic && (configuredPic.startsWith("http://") || configuredPic.startsWith("https://"))) {
    avatarImgSrc = configuredPic;
  } else if (fs.existsSync(publicJpgPath)) {
    attachments.push({
      filename: "admin-profile.jpg",
      path: publicJpgPath,
      cid: "admin-profile-avatar",
    });
    avatarImgSrc = "cid:admin-profile-avatar";
  } else {
    avatarImgSrc = `${baseUrl}/admin-profile.jpg`;
  }

  const isCrypto =
    paymentMethod === "crypto" ||
    orderId.startsWith("ORD-CR-") ||
    orderId.startsWith("crypto_");

  const methodLabel = isCrypto
    ? "Cryptocurrency (USDT/USDC/BTC/ETH/SOL)"
    : "UPI (Google Pay / PhonePe / Paytm)";

  const smtp = await getAdminSmtpConfig();
  const adminUser = smtp.user || (process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, "");

  const info = await sendMailWithFallback({
    from: `"Trinitymart Store" <${adminUser}>`,
    to: email,
    subject: `📦 Order #${orderId} Initiated — Track Your Order Status`,
    attachments,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Order #${orderId} Initiated</title>
      </head>
      <body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#dfe2ee;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 12px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111524;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);border:1px solid #232b42;">
                
                <!-- ── HEADER ── -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e1b4b 0%,#2e1065 50%,#0f172a 100%);padding:40px 32px 32px 32px;text-align:center;border-bottom:1px solid #2e3856;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px auto;">
                      <tr>
                        <td align="center">
                          <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899);padding:3px;box-shadow:0 0 25px rgba(6,182,212,0.45);display:inline-block;">
                            <img src="${avatarImgSrc}" width="76" height="76" alt="Admin" style="width:76px;height:76px;border-radius:50%;object-fit:cover;display:block;background:#0f172a;" />
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="text-align:center;margin-bottom:12px;">
                      <span style="display:inline-block;background:linear-gradient(135deg,rgba(6,182,212,0.2),rgba(139,92,246,0.2));border:1px solid rgba(56,189,248,0.4);border-radius:24px;padding:5px 16px;font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:0.8px;text-transform:uppercase;">
                        🛡️ TRINITYMART DISPATCH &bull; ORDER CREATED
                      </span>
                    </div>

                    <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                      Your Order is Registered! 📦
                    </h1>
                    <p style="margin:0 auto;color:#cbd5e1;font-size:14px;line-height:1.6;max-width:480px;">
                      We've created your order session. Keep your <strong>Order ID</strong> below to track payment verification and instant delivery.
                    </p>
                  </td>
                </tr>

                <!-- ── BODY ── -->
                <tr>
                  <td style="padding:32px 28px;">
                    
                    <!-- ORDER ID PROMINENT CARD -->
                    <div style="background:linear-gradient(135deg,rgba(16,24,39,0.95) 0%,rgba(30,41,59,0.95) 100%);border:1.5px solid #06b6d4;border-radius:18px;padding:22px;margin:0 0 24px 0;box-shadow:0 8px 30px rgba(6,182,212,0.2);text-align:center;">
                      <div style="font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                        YOUR TRACKING ORDER ID
                      </div>
                      <div style="background:#090d16;border:1px solid #1e293b;border-radius:10px;padding:12px 16px;margin:8px auto 16px auto;display:inline-block;max-width:90%;">
                        <span style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:800;color:#38bdf8;letter-spacing:1px;word-break:break-all;">
                          ${orderId}
                        </span>
                      </div>

                      <div>
                        <a href="${orderTrackingUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#06b6d4 0%,#2563eb 50%,#7c3aed 100%);color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:12px;font-weight:800;font-size:14px;letter-spacing:0.4px;box-shadow:0 6px 24px rgba(6,182,212,0.45);border:1px solid rgba(255,255,255,0.25);">
                          🔍 Track Your Order Status Live &rarr;
                        </a>
                      </div>
                      <p style="margin:10px 0 0 0;font-size:12px;color:#94a3b8;">
                        Click anytime to check real-time settlement and view your digital credentials.
                      </p>
                    </div>

                    <!-- ORDER SUMMARY TABLE -->
                    <div style="background:#0f131c;border:1px solid #1e293b;border-radius:16px;padding:20px;margin-bottom:24px;">
                      <div style="font-size:12px;font-weight:800;color:#818cf8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                        📋 Order Summary
                      </div>
                      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Product</td>
                          <td style="color:#ffffff;font-weight:700;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${primaryTitle}</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Quantity</td>
                          <td style="color:#38bdf8;font-weight:700;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${quantity} Unit(s)</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Total Amount</td>
                          <td style="color:#34d399;font-weight:800;font-size:15px;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">₹${amount}</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">Payment Channel</td>
                          <td style="color:#e2e8f0;font-weight:600;text-align:right;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${methodLabel}</td>
                        </tr>
                        <tr>
                          <td style="color:#94a3b8;padding:6px 0;">Current Status</td>
                          <td style="color:#fbbf24;font-weight:700;text-align:right;padding:6px 0;">● Awaiting Payment Confirmation</td>
                        </tr>
                      </table>
                    </div>

                    <!-- WHAT HAPPENS NEXT BANNER -->
                    <div style="background:rgba(56,189,248,0.08);border-left:3px solid #38bdf8;border-radius:0 12px 12px 0;padding:14px 18px;margin-bottom:24px;">
                      <div style="font-size:13px;font-weight:700;color:#38bdf8;margin-bottom:4px;">
                        ⚡ How delivery works:
                      </div>
                      <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.6;">
                        1. Complete the payment in your UPI app or crypto wallet.<br/>
                        2. Our automated system detects the incoming settlement in 15–60 seconds.<br/>
                        3. Your digital credentials &amp; warranty receipt will be emailed immediately and unlocked on your Order Tracking page.
                      </p>
                    </div>

                    <!-- 24/7 SUPPORT -->
                    <div style="background:linear-gradient(135deg,rgba(88,101,242,0.12) 0%,rgba(124,58,237,0.1) 100%);border:1px solid rgba(88,101,242,0.3);border-radius:16px;padding:20px;text-align:center;margin-bottom:10px;">
                      <p style="margin:0 0 6px;font-weight:800;color:#818cf8;font-size:14px;">💬 Need Help or Have Questions?</p>
                      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">Our team is available 24/7 on Discord to help with payment verification and instant delivery.</p>
                      <a href="${emailDiscordUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#5865F2,#7c3aed);color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:10px;font-weight:700;font-size:12px;">
                        Join Discord Support &rarr;
                      </a>
                    </div>

                  </td>
                </tr>

                <!-- ── FOOTER ── -->
                <tr>
                  <td style="background:#090d16;border-top:1px solid #1e293b;padding:22px 36px;text-align:center;">
                    <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:600;">
                      Trinitymart &bull; Automated Digital Goods Dispatch &bull; 24/7 Support
                    </p>
                    <p style="margin:0;color:#475569;font-size:11px;">
                      Track your order anytime at <a href="${orderTrackingUrl}" style="color:#38bdf8;text-decoration:none;">${baseUrl}/orders/lookup</a> with your Order ID: ${orderId}
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  }, smtp);

  try {
    await redis.set(lockKey, "1", { ex: 86400 }); // 24 hours TTL
    console.log(`[INITIATED EMAIL] ✅ Order initiated tracking email delivered to ${email} for #${orderId}`);
  } catch (err) {
    console.warn("Could not set email_initiated_sent lock:", err);
  }

  return info;
}

/**
 * Dedicated Merchant Notification Email
 * Sent directly to store owner (GMAIL_USER) so the owner immediately receives
 * payment received confirmation + full copy of delivered credentials.
 */
export async function sendMerchantSaleNotification({
  orderId,
  customerEmail,
  amount,
  utr,
  senderName,
  productName,
  credentials,
}: {
  orderId: string;
  customerEmail: string;
  amount: number | string;
  utr?: string;
  senderName?: string;
  productName?: string;
  credentials: Credential[];
}): Promise<void> {
  const smtp = await getAdminSmtpConfig();
  const adminEmail = smtp.user || (process.env.GMAIL_USER || "").trim().replace(/^["']|["']$/g, "");
  if (!adminEmail) return;

  try {
    const mailTransporter = createMailTransporter(smtp);
    const primaryTitle = productName || credentials[0]?.productName || "Digital Asset";
    const qty = credentials.length;

    const baseUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
      "https://get-me-account.vercel.app"
    ).replace(/\/+$/, "");

    // Resolve Admin Profile Pic
    const configuredPic = await getAdminProfilePic();
    const attachments: Array<{
      filename?: string;
      path?: string;
      content?: Buffer;
      contentType?: string;
      cid?: string;
    }> = [];

    let avatarImgSrc = "";
    const publicJpgPath = path.join(process.cwd(), "public", "admin-profile.jpg");

    if (configuredPic && configuredPic.startsWith("data:image/")) {
      const match = configuredPic.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        attachments.push({
          filename: "admin-avatar.png",
          content: Buffer.from(match[2], "base64"),
          contentType: match[1],
          cid: "merchant-admin-avatar",
        });
        avatarImgSrc = "cid:merchant-admin-avatar";
      }
    } else if (configuredPic && (configuredPic.startsWith("http://") || configuredPic.startsWith("https://"))) {
      avatarImgSrc = configuredPic;
    } else if (fs.existsSync(publicJpgPath)) {
      attachments.push({
        filename: "admin-profile.jpg",
        path: publicJpgPath,
        cid: "merchant-admin-avatar",
      });
      avatarImgSrc = "cid:merchant-admin-avatar";
    } else {
      avatarImgSrc = `${baseUrl}/admin-profile.jpg`;
    }

    const credentialsListHtml = credentials
      .map((cred, idx) => {
        const id = cred.fields?.id || cred.fields?.username || cred.fields?.login || cred.email;
        const pass = cred.fields?.password || cred.password || cred.emailPassword;
        const tok = cred.fields?.token || cred.token || cred.fields?.key;
        const pin = cred.fields?.pin || cred.twoFactorKey || cred.fields?.["2fa"];
        return `
          <div style="background:#090d16;border:1px solid #1e293b;border-left:4px solid #10b981;border-radius:10px;padding:14px 16px;margin:12px 0;font-family:'Courier New',Courier,monospace;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#38bdf8;text-transform:uppercase;font-family:'Segoe UI',sans-serif;">
              Unit #${idx + 1} &mdash; ${cred.productName || primaryTitle}
            </p>
            ${id ? `<p style="margin:4px 0;font-size:13px;color:#cbd5e1;"><strong style="color:#94a3b8;">Login / ID:</strong> <span style="color:#38bdf8;font-weight:700;">${id}</span></p>` : ""}
            ${pass ? `<p style="margin:4px 0;font-size:13px;color:#cbd5e1;"><strong style="color:#94a3b8;">Password:</strong> <span style="color:#4ade80;font-weight:700;">${pass}</span></p>` : ""}
            ${tok ? `<p style="margin:4px 0;font-size:13px;color:#cbd5e1;word-break:break-all;"><strong style="color:#94a3b8;">Token/Key:</strong> <span style="color:#c084fc;font-weight:700;">${tok}</span></p>` : ""}
            ${pin ? `<p style="margin:4px 0;font-size:13px;color:#cbd5e1;"><strong style="color:#94a3b8;">2FA / PIN:</strong> <span style="color:#fbbf24;font-weight:700;">${pin}</span></p>` : ""}
          </div>
        `;
      })
      .join("");

    await sendMailWithFallback(
      {
        from: `"Trinitymart Store" <${adminEmail}>`,
        to: adminEmail,
        subject: `💰 Money Received! ₹${amount} from ${customerEmail} (Order #${orderId})`,
        attachments,
        html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"/></head>
        <body style="font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;background:#0b0f19;padding:30px 10px;margin:0;color:#dfe2ee;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#111524;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);border:1px solid #232b42;">
                  
                  <!-- Gradient Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#065f46 0%,#047857 50%,#0f172a 100%);padding:32px 24px;text-align:center;border-bottom:1px solid #10b981;">
                      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px auto;">
                        <tr>
                          <td align="center">
                            <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#10b981,#34d399,#06b6d4);padding:3px;box-shadow:0 0 20px rgba(16,185,129,0.45);display:inline-block;">
                              <img src="${avatarImgSrc}" width="72" height="72" alt="Admin Profile" style="width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;background:#0f172a;" />
                            </div>
                          </td>
                        </tr>
                      </table>
                      <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:800;">💰 Money Received!</h1>
                      <p style="margin:6px 0 0;font-size:15px;color:#a7f3d0;">₹${amount} credited &amp; credentials dispatched to buyer</p>
                    </td>
                  </tr>

                  <!-- Order Summary -->
                  <tr>
                    <td style="padding:28px 28px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:14px;border-collapse:collapse;">
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Amount Received</td>
                          <td style="padding:10px 0;color:#34d399;font-weight:800;font-size:17px;text-align:right;">₹${amount}</td>
                        </tr>
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Customer Email</td>
                          <td style="padding:10px 0;color:#ffffff;font-weight:700;text-align:right;">${customerEmail}</td>
                        </tr>
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Order ID</td>
                          <td style="padding:10px 0;color:#38bdf8;font-weight:700;font-family:'Courier New',Courier,monospace;text-align:right;">${orderId}</td>
                        </tr>
                        ${utr ? `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Bank UTR / Ref</td>
                          <td style="padding:10px 0;color:#e2e8f0;font-weight:700;font-family:'Courier New',Courier,monospace;text-align:right;">${utr}</td>
                        </tr>` : ""}
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Product</td>
                          <td style="padding:10px 0;color:#ffffff;font-weight:700;text-align:right;">${primaryTitle} (${qty}x)</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#94a3b8;font-weight:600;">Time</td>
                          <td style="padding:10px 0;color:#cbd5e1;text-align:right;">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
                        </tr>
                      </table>

                      <div style="margin:24px 0 10px;">
                        <span style="font-size:12px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:1px;">
                          Delivered Credentials Copy:
                        </span>
                      </div>
                      ${credentialsListHtml}

                      <p style="margin:24px 0 0;font-size:12px;color:#64748b;text-align:center;">
                        This notification confirms that money was received and credentials were dispatched to customer.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      },
      smtp
    );
    console.log(`Merchant sale notification sent to ${adminEmail} for order ${orderId}`);
  } catch (err) {
    console.warn("Failed to send merchant sale notification:", err);
  }
}

/**
 * Fulfill an order: claim credentials from product database inventory, mark sent, send email, and save fulfillment info.
 * Returns { success, credential, credentials, alreadySent }
 */
export async function fulfillOrder({
  orderId,
  email,
  utr,
  senderName,
  amount = APP_CONFIG.price,
  quantity,
  productId,
  productName,
  cartItems,
}: {
  orderId: string;
  email: string;
  utr?: string;
  senderName?: string;
  amount?: number | string;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: CartOrderItem[];
}): Promise<{
  success: boolean;
  credential?: Credential;
  credentials?: Credential[];
  alreadySent?: boolean;
  error?: string;
}> {
  // Helper to wait for a concurrent in-flight fulfillment to complete and save credentials
  const waitForFulfilled = async (maxAttempts = 5): Promise<Credential[]> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const existing = await getFulfilledCredentials(orderId);
      if (existing && existing.length > 0) return existing;
      await new Promise((r) => setTimeout(r, 600));
    }
    return [];
  };

  // Check if credentials have already been delivered
  if (await isAlreadySent(orderId)) {
    const existingList = await waitForFulfilled(4);
    if (existingList.length > 0) {
      return {
        success: true,
        alreadySent: true,
        credential: existingList[0] ?? undefined,
        credentials: existingList,
      };
    }
  }

  // Acquire lock
  const isFirst = await markAsSent(orderId);
  if (!isFirst) {
    const existingList = await waitForFulfilled(6);
    if (existingList.length > 0) {
      return {
        success: true,
        alreadySent: true,
        credential: existingList[0] ?? undefined,
        credentials: existingList,
      };
    }
    // Prevent duplicate fulfillment race condition
    return {
      success: false,
      error: "Order fulfillment is already in progress. Please refresh in a moment.",
    };
  }

  // Determine requested quantity and product details
  const orderData = await getOrder(orderId);
  let orderMeta: Record<string, string> = {};
  try {
    orderMeta = (await redis.hgetall(`order_meta:${orderId}`)) || {};
  } catch {}

  let resolvedCartItems = cartItems || orderData?.cartItems;
  if (!resolvedCartItems && orderMeta?.cartItems) {
    try {
      resolvedCartItems = JSON.parse(orderMeta.cartItems);
    } catch {}
  }

  const totalCartQty = Array.isArray(resolvedCartItems) && resolvedCartItems.length > 0
    ? resolvedCartItems.reduce((acc, ci) => acc + Math.max(1, ci.quantity || 1), 0)
    : 0;

  const targetQty = totalCartQty > 0
    ? totalCartQty
    : Math.max(1, quantity || orderData?.quantity || Number(orderMeta?.quantity) || 1);
  const resolvedProductId = productId || orderData?.productId || (orderMeta?.productId as string) || "";
  const resolvedProductName = productName || orderData?.productName || (orderMeta?.productName as string) || "Trinitymart Digital Asset";

  const rawPassedAmount = Number(amount);
  const resolvedAmount =
    (orderData?.amount && orderData.amount > 0)
      ? orderData.amount
      : (orderMeta?.amountInr && Number(orderMeta.amountInr) > 0)
        ? Number(orderMeta.amountInr)
        : (Number.isFinite(rawPassedAmount) && rawPassedAmount > 20)
          ? rawPassedAmount
          : APP_CONFIG.price;

  const claimedList: Credential[] = [];

  // If order was a multi-product cart checkout, claim real credentials for each product
  if (Array.isArray(resolvedCartItems) && resolvedCartItems.length > 0) {
    for (const item of resolvedCartItems) {
      const itemQty = Math.max(1, item.quantity || 1);
      const itemCreds = await claimProductCredentials({
        productId: item.productId,
        quantity: itemQty,
        orderId,
        customerEmail: email,
        productName: item.productName,
      });
      claimedList.push(...itemCreds);
    }
  } else if (resolvedProductId && resolvedProductId !== "cart") {
    // Single product order: claim real credentials from that product's database inventory
    const creds = await claimProductCredentials({
      productId: resolvedProductId,
      quantity: targetQty,
      orderId,
      customerEmail: email,
      productName: resolvedProductName,
    });
    claimedList.push(...creds);

    // Nitro fallback: if product is nitro and stock was insufficient, check legacy credentials_pool for remainder
    const stillNeeded = targetQty - claimedList.length;
    if (stillNeeded > 0 && (resolvedProductId === "discord-nitro-booster" || resolvedProductId.includes("nitro"))) {
      const poolCreds = await claimCredentials(stillNeeded);
      if (poolCreds && poolCreds.length > 0) {
        claimedList.push(...poolCreds);
      }
    }
  } else {
    // Fallback: claim from legacy pool
    const poolCreds = await claimCredentials(targetQty);
    if (poolCreds && poolCreds.length > 0) {
      claimedList.push(...poolCreds);
    } else {
      // Fallback: check if discord-nitro-booster or digital-asset has stock
      const nitroCreds = await claimProductCredentials({
        productId: "discord-nitro-booster",
        quantity: targetQty,
        orderId,
        customerEmail: email,
        productName: resolvedProductName,
      });
      if (nitroCreds && nitroCreds.length > 0) {
        claimedList.push(...nitroCreds);
      } else {
        const fallbackCreds = await claimProductCredentials({
          productId: "digital-asset",
          quantity: targetQty,
          orderId,
          customerEmail: email,
          productName: resolvedProductName,
        });
        claimedList.push(...fallbackCreds);
      }
    }
  }

  if (!claimedList || claimedList.length === 0) {
    // Release the lock so it can be retried once restocked
    await redis.del(SENT_KEY(orderId));
    console.error("No credentials available for orderId:", orderId);
    return { success: false, error: "Stock is empty" };
  }

  // Store fulfilled credentials in Redis for client display
  await storeFulfilledCredentials(orderId, claimedList);

  // Mark confirmed in global orders history
  await markOrderConfirmedInHistory({
    orderId,
    utr,
    senderName,
    credential: claimedList[0],
    credentials: claimedList,
    quantity: targetQty,
  });

  // Send email to customer
  try {
    const sentInfo = await sendCredentialEmail({
      email,
      orderId,
      credential: claimedList[0],
      credentials: claimedList,
      utr,
      senderName,
      amount: resolvedAmount,
      productName: resolvedProductName,
    });
    console.log(`${claimedList.length} credentials delivered to ${email} for orderId=${orderId}`);
    await recordEmailSent(orderId, {
      messageId: sentInfo?.messageId,
      recipient: email,
      response: sentInfo?.response,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Failed to send email:", err);
    await recordEmailFailed(orderId, errMsg);
    Promise.allSettled([
      sendDiscordEmailFailureAlert({
        orderId,
        email,
        error: errMsg,
      }),
      sendTelegramEmailFailureAlert({
        orderId,
        email,
        error: errMsg,
      }),
    ]).catch(() => {});
  }

  // Also send merchant owner notification so the seller receives the sale & credentials alert
  try {
    await sendMerchantSaleNotification({
      orderId,
      customerEmail: email,
      amount: resolvedAmount,
      utr,
      senderName,
      productName: resolvedProductName,
      credentials: claimedList,
    });
  } catch (err) {
    console.warn("Failed to send merchant sale alert:", err);
  }

  // Also dispatch automated Discord announcement to channel (e.g., "#orders" or "#vouches")
  try {
    const isCryptoOrder =
      Boolean(utr && (utr.startsWith("CRYPTO:") || utr.startsWith("0x"))) ||
      orderId.startsWith("ORD-CR-") ||
      orderId.startsWith("crypto_") ||
      resolvedProductId === "crypto" ||
      orderData?.productId === "crypto" ||
      orderMeta?.paymentMethod === "crypto_atlos";
    const paymentType = isCryptoOrder ? "Crypto" : "UPI";
    const inrRate = APP_CONFIG.inrToUsdRate || 0.011;
    const usdAmount = (Number(resolvedAmount) * inrRate).toFixed(2);

    await sendDiscordPurchaseNotification({
      orderId,
      email,
      senderName,
      amount: resolvedAmount,
      usdAmount: isCryptoOrder ? usdAmount : undefined,
      productName: resolvedProductName,
      quantity: targetQty,
      utr,
      paymentType,
      cartItems: resolvedCartItems,
      deliveredCount: claimedList.length,
      credentialsDelivered: true,
    });
  } catch (err) {
    console.warn("Failed to dispatch Discord purchase notification:", err);
  }

  // Also dispatch automated Telegram notification to admin chat
  try {
    const inrRate = APP_CONFIG.inrToUsdRate || 0.011;
    const isCryptoOrder =
      Boolean(utr && (utr.startsWith("CRYPTO:") || utr.startsWith("0x"))) ||
      orderId.startsWith("ORD-CR-") ||
      orderId.startsWith("crypto_") ||
      resolvedProductId === "crypto" ||
      orderData?.productId === "crypto" ||
      orderMeta?.paymentMethod === "crypto_atlos";
    const paymentType = isCryptoOrder ? "Crypto" : "UPI";
    const usdAmount = (Number(resolvedAmount) * inrRate).toFixed(2);

    await sendTelegramPurchaseNotification({
      orderId,
      email,
      amount: resolvedAmount,
      usdAmount: isCryptoOrder ? usdAmount : undefined,
      productName: resolvedProductName,
      quantity: targetQty,
      utr,
      paymentType,
    });
  } catch (err) {
    console.warn("Failed to dispatch Telegram purchase notification:", err);
  }

  // Check inventory levels and trigger low-stock alerts if stock drops <= 3
  const productsToCheckStock: { id: string; name: string }[] = [];
  if (Array.isArray(resolvedCartItems) && resolvedCartItems.length > 0) {
    for (const item of resolvedCartItems) {
      if (item.productId && item.productId !== "cart") {
        productsToCheckStock.push({
          id: item.productId,
          name: item.productName || item.productId,
        });
      }
    }
  } else if (resolvedProductId && resolvedProductId !== "cart") {
    productsToCheckStock.push({
      id: resolvedProductId,
      name: resolvedProductName,
    });
  }

  for (const prod of productsToCheckStock) {
    try {
      const inv = (await redis.get<any[]>(`trinitymart_inventory_${prod.id}`)) || [];
      const remainingCount = Array.isArray(inv) ? inv.length : 0;
      if (remainingCount <= 3) {
        Promise.allSettled([
          sendDiscordLowStockAlert({
            productName: prod.name,
            productId: prod.id,
            remainingStock: remainingCount,
          }),
          sendTelegramLowStockAlert({
            productName: prod.name,
            productId: prod.id,
            remainingStock: remainingCount,
          }),
        ]).catch(() => {});
      }
    } catch (e) {
      console.warn(`Failed to check inventory for low-stock alert on ${prod.id}:`, e);
    }
  }

  // Increment coupon usage count if coupon was used
  const usedCoupon = orderData?.couponCode || orderMeta?.couponCode;
  if (usedCoupon) {
    try {
      await incrementCouponUsage(usedCoupon);
    } catch (e) {
      console.warn("Could not increment coupon usage:", e);
    }
  }

  return { success: true, credential: claimedList[0], credentials: claimedList };
}

export type EmailDeliveryStatus = "pending" | "sent" | "opened" | "failed";

export type StoredOrder = {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: CartOrderItem[];
  couponCode?: string;
  discountAmount?: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  createdAt: string;
  confirmedAt?: string;
  utr?: string;
  senderName?: string;
  paymentMethod?: "upi" | "crypto" | string;
  deliveredCredential?: {
    email: string;
    emailPassword?: string;
    discordPassword?: string;
    password?: string;
    token?: string;
    domain?: string;
    twoFactorKey?: string;
    keyweb?: string;
    productId?: string;
    productName?: string;
    fields?: Record<string, string>;
  };
  deliveredCredentials?: Credential[];
  // ── Email tracking & delivery confirmation fields ─────────────────────────
  emailStatus?: EmailDeliveryStatus;
  emailSentAt?: string;
  emailRecipient?: string;
  emailMessageId?: string;
  emailDeliveryResponse?: string;
  emailError?: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  emailLastOpenedAt?: string;
  emailOpenCount?: number;
  emailClientUserAgent?: string;
  emailClientIp?: string;
  emailConfirmedManually?: boolean;
  emailResentCount?: number;
  emailLastResentAt?: string;
  // ── Cart & Payment Recovery Reminders ──────────────────────────────────────
  recoveryEmailSentAt?: string;
  recoveryEmailCount?: number;
};

export const ORDERS_HISTORY_KEY = "orders_history";
export const EMAIL_TRACK_KEY = (orderId: string) => `email_track:${orderId}`;

/**
 * Check FamGateway status for a given orderId with timeout safety.
 */
export async function checkFamGatewayOrderStatus(orderId: string): Promise<{
  status: "success" | "pending" | "expired" | "not_found";
  utr?: string;
  senderName?: string;
  amount?: number;
}> {
  const apiKey = process.env.FAMGATEWAY_API_KEY;

  // 1. Fast authoritative check via live FamGateway checkout-status endpoint (responds in ~300ms)
  try {
    const res = await fetch(
      `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data) {
        const rawStatus = String(data.status || data.data?.status || "").toLowerCase();
        const isSuccess =
          rawStatus === "success" ||
          rawStatus === "completed" ||
          rawStatus === "paid" ||
          data.success === true ||
          data.paid === true;

        if (isSuccess) {
          return {
            status: "success",
            utr: data.utr || data.data?.utr || data.bank_utr,
            senderName: data.sender_name || data.data?.sender_name,
            amount: Number(data.amount || data.data?.amount) || undefined,
          };
        }
        if (rawStatus === "expired" || rawStatus === "failed") {
          return { status: "expired" };
        }
      }
    }
  } catch (err) {
    console.warn(`[FAMGATEWAY] checkout-status check failed for ${orderId}:`, err);
  }

  // 2. Check with Merchant API Key query param if available
  if (apiKey) {
    try {
      const res = await fetch(
        `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(
          orderId
        )}&api_key=${encodeURIComponent(apiKey)}`,
        {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        }
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          const rawStatus = String(data.status || data.data?.status || "").toLowerCase();
          const isSuccess =
            rawStatus === "success" ||
            rawStatus === "completed" ||
            rawStatus === "paid" ||
            data.success === true;

          if (isSuccess) {
            return {
              status: "success",
              utr: data.utr || data.data?.utr || data.bank_utr,
              senderName: data.sender_name || data.data?.sender_name,
              amount: Number(data.amount || data.data?.amount) || undefined,
            };
          }
        }
      }
    } catch (err) {
      console.warn(`[FAMGATEWAY] checkout-status with api_key failed for ${orderId}:`, err);
    }

    // 3. Optional fallback to verify-order.php
    try {
      const res = await fetch(
        `https://famgateway.in/api/verify-order.php?api_key=${encodeURIComponent(
          apiKey
        )}&order_id=${encodeURIComponent(orderId)}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": apiKey,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(2500),
        }
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          const rawStatus = String(data.status || data.data?.status || "").toLowerCase();
          const isSuccess =
            rawStatus === "success" ||
            rawStatus === "completed" ||
            rawStatus === "paid" ||
            data.success === true ||
            data.paid === true;

          if (isSuccess) {
            return {
              status: "success",
              utr: data.data?.utr || data.utr || data.data?.bank_utr || data.bank_utr,
              senderName: data.data?.sender_name || data.sender_name || data.data?.customer_name,
              amount: Number(data.data?.amount || data.amount) || undefined,
            };
          }
        }
      }
    } catch (err) {
      // Endpoint may not be active; catch silently
    }
  }

  return { status: "pending" };
}


/**
 * Check Atlos Crypto status for a given orderId with timeout safety.
 */
export async function checkAtlosOrderStatus(orderId: string): Promise<{
  status: "success" | "mempool_detected" | "pending";
  txid?: string;
  amount?: number;
}> {
  const atlosSecret = process.env.ATLOS_API_SECRET || "6UCqzHHDmb5f0NbXOGCmLKFc2PVIMEYB";
  const merchantId = process.env.ATLOS_MERCHANT_ID || "ADK7QABYR0";

  if (!atlosSecret) {
    return { status: "pending" };
  }

  try {
    const res = await fetch("https://api.atlos.io/gateway/rest/Transaction/List", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiSecret: atlosSecret,
      },
      body: JSON.stringify({ MerchantId: merchantId, OrderId: orderId }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const transactions = Array.isArray(data)
        ? data
        : data.Transactions || data.transactions || data.items || [];
      const match = transactions.find(
        (t: any) =>
          t.OrderId === orderId ||
          t.orderId === orderId ||
          t.order_id === orderId
      );

      if (match) {
        if (
          match.Status === 100 ||
          match.status === "success" ||
          String(match.Status) === "100"
        ) {
          return {
            status: "success",
            txid: match.BlockchainHash || match.Txid || match.txid || match.hash,
            amount: Number(match.PaidAmount || match.OrderAmount || match.amount),
          };
        }
        if (match.Status === 10 || match.status === "pending_mempool") {
          return {
            status: "mempool_detected",
          };
        }
      }
    }
  } catch (err) {}

  return { status: "pending" };
}

const activeWatchers = new Set<string>();

/**
 * Server-side background watcher:
 * Actively monitors an order even if the user cuts or closes the payment window.
 * The moment the payment gateway registers the payment, it fulfills and automatically emails the customer.
 */
export function startBackgroundOrderWatcher(
  orderId: string,
  email: string,
  method: "upi" | "crypto" = "upi"
) {
  if (!orderId || !email) return;
  if (activeWatchers.has(orderId)) return;

  activeWatchers.add(orderId);
  console.log(`[WATCHER] Active watcher registered for order: ${orderId} (${email})`);

  let attempts = 0;
  const maxAttempts = 120; // 120 checks = ~15 minutes

  const checkTick = async () => {
    attempts++;

    try {
      if (await isAlreadySent(orderId)) {
        activeWatchers.delete(orderId);
        return;
      }

      let isPaid = false;
      let utr: string | undefined = undefined;
      let senderName: string | undefined = undefined;
      let amount: number | undefined = undefined;

      if (method === "crypto") {
        const cryptoRes = await checkAtlosOrderStatus(orderId);
        if (cryptoRes.status === "success") {
          isPaid = true;
          utr = cryptoRes.txid ? `CRYPTO:${cryptoRes.txid}` : undefined;
          amount = cryptoRes.amount;
        }
      } else {
        const upiRes = await checkFamGatewayOrderStatus(orderId);
        if (upiRes.status === "success") {
          isPaid = true;
          utr = upiRes.utr;
          senderName = upiRes.senderName;
          amount = upiRes.amount;
        }
      }

      if (isPaid) {
        console.log(`[WATCHER] 💰 Payment confirmed in background for ${orderId}! Dispatching email...`);
        const orderData = await getOrder(orderId);
        await fulfillOrder({
          orderId,
          email,
          utr,
          senderName,
          amount: amount || orderData?.amount || APP_CONFIG.price,
          quantity: orderData?.quantity || 1,
          productId: orderData?.productId,
          productName: orderData?.productName,
          cartItems: orderData?.cartItems,
        });

        activeWatchers.delete(orderId);
        return;
      }
    } catch (err) {
      console.warn(`[WATCHER] Tick error for ${orderId}:`, err);
    }

    if (attempts >= maxAttempts) {
      activeWatchers.delete(orderId);
      return;
    }

    const delayMs = attempts < 30 ? 4000 : 10000;
    setTimeout(checkTick, delayMs);
  };

  setTimeout(checkTick, 3000);
}

/**
 * Reconcile pending orders:
 * Sweeps all pending orders from the last 2 hours and checks if any were paid while the user's window was closed.
 */
export async function reconcilePendingOrders(): Promise<{ checked: number; fulfilled: number }> {
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) || [];
    const now = Date.now();
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;

    const pendingOrders = history.filter((o) => {
      if (o.status !== "pending") return false;
      const createdTime = new Date(o.createdAt).getTime();
      return createdTime >= twoHoursAgo;
    });

    let fulfilledCount = 0;

    for (const ord of pendingOrders) {
      if (await isAlreadySent(ord.orderId)) {
        await markOrderConfirmedInHistory({
          orderId: ord.orderId,
          quantity: ord.quantity || 1,
        });
        fulfilledCount++;
        continue;
      }

      // 1. Check UPI status
      const upiStatus = await checkFamGatewayOrderStatus(ord.orderId);
      if (upiStatus.status === "success") {
        console.log(`[RECONCILE] Automatically fulfilling paid order ${ord.orderId} and sending email to ${ord.email}...`);
        const result = await fulfillOrder({
          orderId: ord.orderId,
          email: ord.email,
          utr: upiStatus.utr,
          senderName: upiStatus.senderName,
          amount: upiStatus.amount || ord.amount,
          quantity: ord.quantity || 1,
          productId: ord.productId,
          productName: ord.productName,
          cartItems: ord.cartItems,
        });
        if (result.success) fulfilledCount++;
        continue;
      }

      // 2. Check Crypto status
      const cryptoStatus = await checkAtlosOrderStatus(ord.orderId);
      if (cryptoStatus.status === "success") {
        console.log(`[RECONCILE] Automatically fulfilling paid crypto order ${ord.orderId} and sending email to ${ord.email}...`);
        const result = await fulfillOrder({
          orderId: ord.orderId,
          email: ord.email,
          utr: cryptoStatus.txid ? `CRYPTO:${cryptoStatus.txid}` : undefined,
          amount: cryptoStatus.amount || ord.amount,
          quantity: ord.quantity || 1,
          productId: ord.productId,
          productName: ord.productName,
          cartItems: ord.cartItems,
        });
        if (result.success) fulfilledCount++;
      }
    }

    return { checked: pendingOrders.length, fulfilled: fulfilledCount };
  } catch (err) {
    console.error("[RECONCILE] Error during reconciliation:", err);
    return { checked: 0, fulfilled: 0 };
  }
}

export async function recordNewOrder(data: {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: CartOrderItem[];
  couponCode?: string;
  discountAmount?: number;
  paymentMethod?: "upi" | "crypto" | string;
}): Promise<void> {
  const quantity = Math.max(1, data.quantity || 1);
  const resolvedPaymentMethod: "upi" | "crypto" =
    data.paymentMethod === "crypto" ||
    data.orderId.startsWith("ORD-CR-") ||
    data.orderId.startsWith("crypto_") ||
    data.productId === "crypto" ||
    data.productId?.includes("crypto")
      ? "crypto"
      : "upi";

  const newOrder: StoredOrder = {
    orderId: data.orderId,
    email: data.email,
    amount: data.amount,
    quantity,
    productId: data.productId,
    productName: data.productName,
    cartItems: data.cartItems,
    couponCode: data.couponCode,
    discountAmount: data.discountAmount,
    status: "pending",
    paymentMethod: resolvedPaymentMethod,
    createdAt: new Date().toISOString(),
    emailStatus: "pending",
  };

  await storeOrder(data.orderId, {
    email: data.email,
    amount: data.amount,
    orderId: data.orderId,
    quantity,
    productId: data.productId,
    productName: data.productName,
    cartItems: data.cartItems,
    couponCode: data.couponCode,
    discountAmount: data.discountAmount,
    createdAt: Date.now(),
  });

  // Also persist in order_meta for instant lookup
  try {
    await redis.hset(`order_meta:${data.orderId}`, {
      orderId: data.orderId,
      email: data.email,
      amount: String(data.amount),
      quantity: String(quantity),
      productId: data.productId || "",
      productName: data.productName || "Trinitymart Digital Asset",
      cartItems: JSON.stringify(data.cartItems || []),
      couponCode: data.couponCode || "",
      discountAmount: String(data.discountAmount || 0),
      paymentMethod: resolvedPaymentMethod,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not save to order_meta:", err);
  }

  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    // Deduplicate if already present
    const filtered = history.filter((o) => o.orderId !== data.orderId);
    filtered.unshift(newOrder);
    if (filtered.length > 500) filtered.length = 500;
    await redis.set(ORDERS_HISTORY_KEY, filtered);
  } catch (err) {
    console.warn("Could not save to orders_history:", err);
  }

  // ── AUTOMATIC BACKGROUND WATCHER ──
  // Immediately start server-side background monitoring so if the user closes
  // or cuts the browser window, payment completion automatically triggers fulfillment & email!
  try {
    startBackgroundOrderWatcher(
      data.orderId,
      data.email,
      resolvedPaymentMethod
    );
  } catch (e) {
    console.warn("Failed to launch background watcher:", e);
  }
}

export async function markOrderConfirmedInHistory({
  orderId,
  utr,
  senderName,
  credential,
  credentials,
  quantity,
  paymentMethod,
}: {
  orderId: string;
  utr?: string;
  senderName?: string;
  credential?: Credential;
  credentials?: Credential[];
  quantity?: number;
  paymentMethod?: "upi" | "crypto" | string;
}): Promise<void> {
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const idx = history.findIndex((o) => o.orderId === orderId);
    const now = new Date().toISOString();
    if (idx !== -1) {
      history[idx].status = "confirmed";
      history[idx].confirmedAt = now;
      if (utr) history[idx].utr = utr;
      if (senderName) history[idx].senderName = senderName;
      if (quantity) history[idx].quantity = quantity;
      if (paymentMethod) {
        history[idx].paymentMethod = paymentMethod;
      } else if (!history[idx].paymentMethod) {
        history[idx].paymentMethod =
          (utr && (utr.startsWith("CRYPTO:") || utr.startsWith("0x"))) ||
          orderId.startsWith("ORD-CR-") ||
          orderId.startsWith("crypto_")
            ? "crypto"
            : "upi";
      }
      if (credentials && credentials.length > 0) {
        history[idx].deliveredCredentials = credentials;
        history[idx].deliveredCredential = credentials[0];
      } else if (credential) {
        history[idx].deliveredCredential = credential;
        history[idx].deliveredCredentials = [credential];
      }
      await redis.set(ORDERS_HISTORY_KEY, history);
    }
  } catch (err) {
    console.warn("Could not update orders_history:", err);
  }
}

/**
 * Record that an email has been successfully sent to customer.
 */
export async function recordEmailSent(
  orderId: string,
  info: { messageId?: string; recipient?: string; response?: string }
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Fast individual track key in Redis
  try {
    await redis.hset(EMAIL_TRACK_KEY(orderId), {
      status: "sent",
      sentAt: now,
      messageId: info.messageId || "",
      recipient: info.recipient || "",
      response: info.response || "",
    });
  } catch (e) {
    console.warn("Could not update quick email_track key:", e);
  }

  // 2. Global orders history update
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const idx = history.findIndex((o) => o.orderId === orderId);
    if (idx !== -1) {
      if (history[idx].emailStatus !== "opened") {
        history[idx].emailStatus = "sent";
      }
      history[idx].emailSentAt = now;
      if (info.messageId) history[idx].emailMessageId = info.messageId;
      if (info.recipient) history[idx].emailRecipient = info.recipient;
      if (info.response) history[idx].emailDeliveryResponse = info.response;
      history[idx].emailError = undefined;
      await redis.set(ORDERS_HISTORY_KEY, history);
    }
  } catch (err) {
    console.warn("Could not update email sent in orders_history:", err);
  }
}

/**
 * Record that sending an email to customer failed.
 */
export async function recordEmailFailed(orderId: string, error: string): Promise<void> {
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const idx = history.findIndex((o) => o.orderId === orderId);
    let targetEmail = "";
    if (idx !== -1) {
      history[idx].emailStatus = "failed";
      history[idx].emailError = error;
      targetEmail = history[idx].email;
      await redis.set(ORDERS_HISTORY_KEY, history);
    }
    // Dispatch instant failure alerts to Discord & Telegram
    Promise.allSettled([
      sendDiscordEmailFailureAlert({
        orderId,
        email: targetEmail || "Customer",
        error,
      }),
      sendTelegramEmailFailureAlert({
        orderId,
        email: targetEmail || "Customer",
        error,
      }),
    ]).catch(() => {});
  } catch (err) {
    console.warn("Could not update email failure in orders_history:", err);
  }
}

/**
 * Triggered when customer opens the email (tracking pixel) or clicks web confirmation button.
 */
export async function markEmailOpened(
  orderId: string,
  meta?: { userAgent?: string; ip?: string; manual?: boolean }
): Promise<StoredOrder | null> {
  const now = new Date().toISOString();

  // Fast tracking record
  try {
    await redis.hset(EMAIL_TRACK_KEY(orderId), {
      status: "opened",
      opened: "1",
      lastOpenedAt: now,
      userAgent: meta?.userAgent || "",
      ip: meta?.ip || "",
      manual: meta?.manual ? "1" : "0",
    });
    await redis.hincrby(EMAIL_TRACK_KEY(orderId), "openCount", 1);
  } catch (e) {
    console.warn("Could not update quick email_track key:", e);
  }

  // Update orders history
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const idx = history.findIndex((o) => o.orderId === orderId);
    if (idx !== -1) {
      const order = history[idx];
      order.emailStatus = "opened";
      order.emailOpened = true;
      if (!order.emailOpenedAt) {
        order.emailOpenedAt = now;
      }
      order.emailLastOpenedAt = now;
      order.emailOpenCount = (order.emailOpenCount || 0) + 1;
      if (meta?.userAgent) order.emailClientUserAgent = meta.userAgent;
      if (meta?.ip) order.emailClientIp = meta.ip;
      if (meta?.manual) order.emailConfirmedManually = true;
      await redis.set(ORDERS_HISTORY_KEY, history);
      return order;
    }
  } catch (err) {
    console.warn("Could not update email opened in orders_history:", err);
  }
  return null;
}

/**
 * Manually toggle or set email receipt status by admin.
 */
export async function manuallySetEmailStatus(
  orderId: string,
  received: boolean
): Promise<StoredOrder | null> {
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const idx = history.findIndex((o) => o.orderId === orderId);
    if (idx !== -1) {
      const order = history[idx];
      const now = new Date().toISOString();
      if (received) {
        order.emailStatus = "opened";
        order.emailOpened = true;
        if (!order.emailOpenedAt) order.emailOpenedAt = now;
        order.emailLastOpenedAt = now;
        order.emailConfirmedManually = true;
      } else {
        order.emailStatus = "sent";
        order.emailOpened = false;
        order.emailConfirmedManually = false;
      }
      await redis.set(ORDERS_HISTORY_KEY, history);
      return order;
    }
  } catch (err) {
    console.warn("Could not manually set email status:", err);
  }
  return null;
}

/**
 * Admin action to resend the credential email to a customer.
 */
export async function resendOrderEmail(
  orderId: string,
  overrideEmail?: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  let credentials = await getFulfilledCredentials(orderId);
  const history = await getAllOrders();
  let order = history.find((o) => o.orderId === orderId);
  if (!order) {
    const fallback = await getOrder(orderId);
    if (fallback) {
      order = {
        orderId: fallback.orderId,
        email: fallback.email,
        amount: fallback.amount,
        quantity: fallback.quantity,
        productId: fallback.productId,
        productName: fallback.productName,
        cartItems: fallback.cartItems,
        status: "pending",
        createdAt: new Date(fallback.createdAt || Date.now()).toISOString(),
      };
    }
  }
  const targetEmail = overrideEmail?.trim() || order?.email;

  if (!targetEmail) {
    return { success: false, error: "No customer email address found for this order." };
  }

  // 1. If not found in FULFILLED_KEY, check if stored in order history
  if (!credentials || credentials.length === 0) {
    if (order?.deliveredCredentials && order.deliveredCredentials.length > 0) {
      credentials = order.deliveredCredentials;
    } else if (order?.deliveredCredential) {
      credentials = [order.deliveredCredential as Credential];
    }
  }

  // 2. If STILL no credentials and the order is in history, AUTO-FULFILL IT NOW!
  if (!credentials || credentials.length === 0) {
    if (order) {
      console.log(`[RESEND] No fulfilled credentials in database for ${orderId}. Auto-fulfilling order now...`);
      const fulfillRes = await fulfillOrder({
        orderId,
        email: targetEmail,
        utr: order.utr || "ADMIN_MANUAL_FULFILLMENT",
        senderName: order.senderName,
        amount: order.amount || APP_CONFIG.price,
        quantity: order.quantity || 1,
        productId: order.productId,
        productName: order.productName,
        cartItems: order.cartItems,
      });

      if (fulfillRes.success && (fulfillRes.credentials || fulfillRes.credential)) {
        return {
          success: true,
          messageId: "auto-fulfilled-and-sent",
        };
      } else {
        return {
          success: false,
          error: fulfillRes.error || "Could not claim credentials from database stock.",
        };
      }
    }
    return { success: false, error: "No credentials found for this order ID in database." };
  }

  try {
    const sentInfo = await sendCredentialEmail({
      email: targetEmail,
      orderId,
      credentials,
      credential: credentials[0],
      utr: order?.utr,
      senderName: order?.senderName,
      amount: order?.amount || APP_CONFIG.price,
      productName: order?.productName,
    });

    const now = new Date().toISOString();
    const idx = history.findIndex((o) => o.orderId === orderId);
    if (idx !== -1) {
      history[idx].email = targetEmail;
      history[idx].emailRecipient = targetEmail;
      history[idx].emailSentAt = now;
      history[idx].emailMessageId = sentInfo?.messageId;
      history[idx].emailResentCount = (history[idx].emailResentCount || 0) + 1;
      history[idx].emailLastResentAt = now;
      history[idx].emailError = undefined;
      await redis.set(ORDERS_HISTORY_KEY, history);
    }

    return { success: true, messageId: sentInfo?.messageId };
  } catch (err) {
    console.error("Resend email failed:", err);
    await recordEmailFailed(orderId, err instanceof Error ? err.message : String(err));
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to resend email",
    };
  }
}

/**
 * Manually fulfills an order from Admin panel:
 * Supports assigning credentials from stock OR assigning custom credentials entered by admin.
 */
export async function manualFulfillOrder({
  orderId,
  overrideEmail,
  customCredentials,
  utr,
}: {
  orderId: string;
  overrideEmail?: string;
  customCredentials?: Partial<Credential>[];
  utr?: string;
}): Promise<{
  success: boolean;
  error?: string;
  credentials?: Credential[];
  messageId?: string;
}> {
  const history = await getAllOrders();
  let order = history.find((o) => o.orderId === orderId);
  if (!order) {
    const fallback = await getOrder(orderId);
    if (fallback) {
      order = {
        orderId: fallback.orderId,
        email: fallback.email,
        amount: fallback.amount,
        quantity: fallback.quantity,
        productId: fallback.productId,
        productName: fallback.productName,
        cartItems: fallback.cartItems,
        status: "pending",
        createdAt: new Date(fallback.createdAt || Date.now()).toISOString(),
      };
    }
  }
  const targetEmail = overrideEmail?.trim() || order?.email;

  if (!targetEmail) {
    return { success: false, error: "No customer email address linked to this order." };
  }

  // 1. If custom credentials were provided by admin
  if (Array.isArray(customCredentials) && customCredentials.length > 0) {
    const fullCreds: Credential[] = customCredentials.map((c, idx) => ({
      id: c.id || `custom-${Date.now()}-${idx}`,
      email: c.email || c.fields?.id || targetEmail,
      password: c.password || c.fields?.password,
      emailPassword: c.emailPassword || c.fields?.emailPassword,
      discordPassword: c.discordPassword || c.fields?.discordPassword,
      token: c.token || c.fields?.token,
      domain: c.domain || c.fields?.domain,
      twoFactorKey: c.twoFactorKey || c.fields?.twoFactorKey || c.fields?.pin,
      keyweb: c.keyweb || c.fields?.keyweb,
      addedAt: c.addedAt || new Date().toISOString(),
      productId: order?.productId || c.productId,
      productName: order?.productName || c.productName || "TrinityMart Digital Asset",
      fields: (c.fields || {
        id: c.email || targetEmail,
        password: c.password || "",
        token: c.token || "",
      }) as Record<string, string>,
    }));

    await storeFulfilledCredentials(orderId, fullCreds);

    await markOrderConfirmedInHistory({
      orderId,
      utr: utr || order?.utr || "MANUAL_ADMIN_FULFILLMENT",
      senderName: order?.senderName,
      credential: fullCreds[0],
      credentials: fullCreds,
      quantity: fullCreds.length,
    });

    try {
      const sentInfo = await sendCredentialEmail({
        email: targetEmail,
        orderId,
        credential: fullCreds[0],
        credentials: fullCreds,
        utr: utr || order?.utr,
        senderName: order?.senderName,
        amount: order?.amount || APP_CONFIG.price,
        productName: order?.productName,
      });

      await recordEmailSent(orderId, {
        messageId: sentInfo?.messageId,
        recipient: targetEmail,
        response: sentInfo?.response,
      });

      // Also dispatch automated Discord announcement
      try {
        const isCryptoOrder =
          Boolean(utr && (utr.startsWith("CRYPTO:") || utr.startsWith("0x"))) ||
          orderId.startsWith("ORD-CR-") ||
          orderId.startsWith("crypto_") ||
          order?.productId === "crypto" ||
          order?.paymentMethod === "crypto";
        const inrRate = APP_CONFIG.inrToUsdRate || 0.011;
        const ordAmount = order?.amount || APP_CONFIG.price;
        await sendDiscordPurchaseNotification({
          orderId,
          email: targetEmail,
          senderName: order?.senderName,
          amount: ordAmount,
          usdAmount: isCryptoOrder ? (ordAmount * inrRate).toFixed(2) : undefined,
          productName: order?.productName || fullCreds[0]?.productName,
          quantity: fullCreds.length,
          utr: utr || order?.utr,
          paymentType: isCryptoOrder ? "Crypto" : "UPI",
          cartItems: order?.cartItems,
          deliveredCount: fullCreds.length,
          credentialsDelivered: true,
        });
      } catch (e) {
        console.warn("Failed to dispatch Discord purchase notification in manual fulfillment:", e);
      }

      return {
        success: true,
        credentials: fullCreds,
        messageId: sentInfo?.messageId,
      };
    } catch (err) {
      await recordEmailFailed(orderId, err instanceof Error ? err.message : String(err));
      return {
        success: false,
        error: `Credentials saved, but email delivery failed: ${err instanceof Error ? err.message : String(err)}`,
        credentials: fullCreds,
      };
    }
  }

  // 2. Otherwise auto-claim from inventory
  const fulfillRes = await fulfillOrder({
    orderId,
    email: targetEmail,
    utr: utr || order?.utr || "MANUAL_ADMIN_FULFILLMENT",
    senderName: order?.senderName,
    amount: order?.amount || APP_CONFIG.price,
    quantity: order?.quantity || 1,
    productId: order?.productId,
    productName: order?.productName,
    cartItems: order?.cartItems,
  });

  return {
    success: fulfillRes.success,
    error: fulfillRes.error,
    credentials: fulfillRes.credentials || (fulfillRes.credential ? [fulfillRes.credential] : undefined),
  };
}


export async function getAllOrders(): Promise<StoredOrder[]> {
  const history = await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY);
  return history ?? [];
}

/**
 * Fast lookup of a single order by its unique Order ID.
 */
export async function getOrderById(orderId: string): Promise<StoredOrder | null> {
  const cleanId = orderId.trim();
  const history = await getAllOrders();
  const match = history.find((o) => o.orderId.toLowerCase() === cleanId.toLowerCase());
  if (match) return match;

  // Fallback to individual redis key
  const fallback = await getOrder(cleanId);
  if (!fallback) return null;

  const delivered = await isAlreadySent(cleanId);
  const deliveredCreds = await getFulfilledCredentials(cleanId);

  return {
    orderId: fallback.orderId,
    email: fallback.email,
    amount: fallback.amount,
    quantity: fallback.quantity || 1,
    productId: fallback.productId,
    productName: fallback.productName,
    cartItems: fallback.cartItems,
    status: delivered ? "confirmed" : "pending",
    deliveredCredentials: deliveredCreds.length > 0 ? deliveredCreds : undefined,
    createdAt: new Date(fallback.createdAt || Date.now()).toISOString(),
  };
}

/**
 * Fast lookup of all orders placed by a specific customer email.
 */
export async function getOrdersByEmail(email: string): Promise<StoredOrder[]> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return [];
  const history = await getAllOrders();
  return history.filter((o) => o.email.toLowerCase() === cleanEmail);
}

/**
 * Retrieves abandoned orders eligible for payment recovery reminders.
 * Criteria:
 * - Status is 'pending'
 * - Created between 15 minutes and 48 hours ago
 * - Valid customer email provided
 */
export async function getAbandonedOrders(): Promise<StoredOrder[]> {
  try {
    const history = (await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY)) ?? [];
    const now = Date.now();
    const fifteenMinsAgo = now - 15 * 60 * 1000;
    const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

    return history.filter((o) => {
      if (o.status !== "pending") return false;
      if (!o.email || !o.email.includes("@")) return false;
      const createdTime = new Date(o.createdAt).getTime();
      if (isNaN(createdTime) || createdTime > fifteenMinsAgo || createdTime < fortyEightHoursAgo) {
        return false;
      }
      return true;
    });
  } catch (err) {
    console.warn("Error fetching abandoned orders:", err);
    return [];
  }
}

/**
 * Sends a high-converting, branded recovery reminder email to a customer with an abandoned cart/order.
 */
export async function sendRecoveryEmail({
  orderId,
  discountCode = "RECOVER5",
  customNote,
}: {
  orderId: string;
  discountCode?: string;
  customNote?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const history = await getAllOrders();
  const order = history.find((o) => o.orderId === orderId);
  if (!order) {
    return { success: false, error: "Order not found." };
  }
  if (!order.email || !order.email.includes("@")) {
    return { success: false, error: "No valid email address found for this order." };
  }

  const baseUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://get-me-account.vercel.app"
  ).replace(/\/+$/, "");

  const resumeUrl = `${baseUrl}/orders/lookup?orderId=${encodeURIComponent(orderId)}`;
  const prodName = order.productName || "TrinityMart Digital Asset";
  const amountStr = `₹${order.amount}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:24px 10px;background:#0a0e16;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,sans-serif;color:#dfe2ee;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111524;border-radius:18px;border:1px solid #232b42;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
              <!-- Top Banner -->
              <tr>
                <td style="background:linear-gradient(135deg, #4338ca 0%, #6366f1 100%);padding:28px 24px;text-align:center;">
                  <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:900;letter-spacing:-0.5px;">
                    Did something happen during checkout?
                  </h1>
                  <p style="margin:8px 0 0;font-size:13px;color:#e0e7ff;font-weight:500;">
                    We temporarily reserved your item so you don't lose your stock!
                  </p>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding:28px 24px;">
                  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;">
                    Hello <strong>${order.email.split("@")[0]}</strong>,
                  </p>
                  <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#94a3b8;">
                    We noticed you started an order on <strong>TrinityMart</strong>, but your payment was not finalized. Because high-demand virtual accounts sell out fast, we held your reservation:
                  </p>

                  <div style="background:#090d16;border:1px solid #1e293b;border-left:4px solid #6366f1;border-radius:10px;padding:16px;margin:16px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;font-family:'Segoe UI',sans-serif;">
                      <tr>
                        <td style="color:#94a3b8;padding-bottom:6px;">Order ID:</td>
                        <td align="right" style="color:#818cf8;font-weight:700;font-family:monospace;">#${order.orderId}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;padding-bottom:6px;">Reserved Product:</td>
                        <td align="right" style="color:#f8fafc;font-weight:600;">${prodName} (x${order.quantity || 1})</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;padding-bottom:6px;">Total Amount:</td>
                        <td align="right" style="color:#4ade80;font-weight:700;font-size:15px;">${amountStr}</td>
                      </tr>
                      <tr>
                        <td style="color:#94a3b8;">Payment Channel:</td>
                        <td align="right" style="color:#cbd5e1;text-transform:uppercase;font-size:11px;font-weight:600;">${order.paymentMethod || "UPI / Crypto"}</td>
                      </tr>
                    </table>
                  </div>

                  ${discountCode ? `
                  <div style="background:rgba(99,102,241,0.12);border:1px dashed #6366f1;border-radius:10px;padding:12px 16px;margin:18px 0;text-align:center;">
                    <span style="font-size:12px;color:#c7d2fe;display:block;margin-bottom:4px;">Special perk to complete your order today:</span>
                    <span style="font-size:15px;color:#a5b4fc;font-weight:800;letter-spacing:1px;background:#1e1b4b;padding:4px 12px;border-radius:6px;display:inline-block;">
                      Use Coupon: ${discountCode} (5% OFF)
                    </span>
                  </div>
                  ` : ""}

                  ${customNote ? `<p style="font-size:13px;color:#38bdf8;font-style:italic;margin:14px 0;">Note from Admin: ${customNote}</p>` : ""}

                  <div style="text-align:center;margin:28px 0 16px;">
                    <a href="${resumeUrl}" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;display:inline-block;box-shadow:0 4px 14px rgba(16,185,129,0.35);">
                      ⚡ Resume &amp; Complete My Order &rarr;
                    </a>
                  </div>

                  <p style="margin:20px 0 0;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
                    If you already paid or have questions, you can verify your payment on our <a href="${resumeUrl}" style="color:#818cf8;text-decoration:none;">Order Lookup Portal</a> or reach out on <a href="https://discord.gg/trinitymart" style="color:#818cf8;text-decoration:none;">Discord Support</a>.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const smtp = await getAdminSmtpConfig();
    const adminEmail = smtp.user || (process.env.GMAIL_USER || "support@trinitymart.store").trim().replace(/^["']|["']$/g, "");

    const info = await sendMailWithFallback(
      {
        from: `"TrinityMart Order Desk" <${adminEmail}>`,
        to: order.email,
        subject: `⚠️ Did you forget your order? We reserved your ${prodName} for you!`,
        html,
      },
      smtp
    );

    const nowIso = new Date().toISOString();
    const idx = history.findIndex((o) => o.orderId === orderId);
    if (idx !== -1) {
      history[idx].recoveryEmailSentAt = nowIso;
      history[idx].recoveryEmailCount = (history[idx].recoveryEmailCount || 0) + 1;
      await redis.set(ORDERS_HISTORY_KEY, history);
    }

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.warn("Failed to send recovery email:", err);
    return { success: false, error: err?.message || String(err) };
  }
}


