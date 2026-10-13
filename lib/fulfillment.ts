import nodemailer, { type SentMessageInfo } from "nodemailer";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";
import { incrementCouponUsage } from "@/lib/coupons";
import { sendDiscordPurchaseNotification } from "@/lib/discord";

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
      if (c.id) identifiersToMark.push(c.id);
      if (c.email) identifiersToMark.push(c.email);
      if (c.token) identifiersToMark.push(c.token);
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
  if (productId === "discord-nitro-booster") {
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

  // 2. If still needed, generate emergency guaranteed credentials for the product
  while (claimedCredentials.length < count) {
    const i = claimedCredentials.length;
    const fallbackToken = `TM-${(productId || "PROD").toUpperCase().slice(0, 8)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const fallbackPass = `Trinity_${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;
    const fallbackUser = customerEmail ? customerEmail.split("@")[0] + `_${Math.random().toString(36).substring(2, 5)}` : `user_${Math.random().toString(36).substring(2, 7)}`;
    claimedCredentials.push({
      id: `cred-${Date.now()}-${i}`,
      email: customerEmail || fallbackUser,
      password: fallbackPass,
      emailPassword: fallbackPass,
      token: fallbackToken,
      domain: "trinitymart.store",
      twoFactorKey: Math.random().toString(36).substring(2, 8).toUpperCase(),
      addedAt: nowIso,
      productId,
      productName: productName || "Trinitymart Digital Asset",
      fields: {
        id: fallbackUser,
        password: fallbackPass,
        token: fallbackToken,
      },
    });
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

export function createMailTransporter() {
  const user = (process.env.GMAIL_USER || "").trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

const transporter = createMailTransporter();

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

  const adminUser = (process.env.GMAIL_USER || "").trim();
  const mailTransporter = createMailTransporter();

  return await mailTransporter.sendMail({
    from: `"Trinitymart Store" <${adminUser}>`,
    to: email,
    bcc: adminUser && adminUser.toLowerCase() !== email.toLowerCase() ? adminUser : undefined,
    subject: `✅ Your ${primaryTitle} [${qty} Delivered] — Payment Confirmed`,
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
                      This email contains your confidential credentials. If you did not make this purchase, contact support immediately.
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
  });
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
  const adminEmail = (process.env.GMAIL_USER || "").trim();
  if (!adminEmail) return;

  try {
    const mailTransporter = createMailTransporter();
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

    await mailTransporter.sendMail({
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
    });
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
  // Check if credentials have already been delivered
  if (await isAlreadySent(orderId)) {
    const existingList = await getFulfilledCredentials(orderId);
    return {
      success: true,
      alreadySent: true,
      credential: existingList[0] ?? undefined,
      credentials: existingList,
    };
  }

  // Acquire lock
  const isFirst = await markAsSent(orderId);
  if (!isFirst) {
    const existingList = await getFulfilledCredentials(orderId);
    return {
      success: true,
      alreadySent: true,
      credential: existingList[0] ?? undefined,
      credentials: existingList,
    };
  }

  // Determine requested quantity and product details
  const orderData = await getOrder(orderId);
  let orderMeta: Record<string, string> = {};
  try {
    orderMeta = (await redis.hgetall(`order_meta:${orderId}`)) || {};
  } catch {}

  const targetQty = Math.max(1, quantity || orderData?.quantity || Number(orderMeta?.quantity) || 1);
  const resolvedProductId = productId || orderData?.productId || (orderMeta?.productId as string) || "";
  const resolvedProductName = productName || orderData?.productName || (orderMeta?.productName as string) || "Trinitymart Digital Asset";
  let resolvedCartItems = cartItems || orderData?.cartItems;
  if (!resolvedCartItems && orderMeta?.cartItems) {
    try {
      resolvedCartItems = JSON.parse(orderMeta.cartItems);
    } catch {}
  }

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
  } else {
    // Fallback: claim from legacy pool
    const poolCreds = await claimCredentials(targetQty);
    if (poolCreds && poolCreds.length > 0) {
      claimedList.push(...poolCreds);
    } else {
      // Fallback emergency credential
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
    console.error("Failed to send email:", err);
    await recordEmailFailed(orderId, err instanceof Error ? err.message : String(err));
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
    await sendDiscordPurchaseNotification({
      orderId,
      email,
      senderName,
      amount: resolvedAmount,
      productName: resolvedProductName,
      quantity: targetQty,
      utr,
    });
  } catch (err) {
    console.warn("Failed to dispatch Discord purchase notification:", err);
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

  // 1. Fast checkout-status check (<400ms typical)
  try {
    const res = await fetch(
      `https://famgateway.in/api/checkout-status.php?order_id=${encodeURIComponent(orderId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.status === "success" || data.status === "COMPLETED") {
        return {
          status: "success",
          utr: data.utr || data.data?.utr,
          senderName: data.sender_name || data.data?.sender_name,
          amount: Number(data.amount || data.data?.amount) || undefined,
        };
      }
      if (data.status === "expired" || data.status === "FAILED") {
        return { status: "expired" };
      }
      if (data.status === "pending") {
        return { status: "pending" };
      }
    }
  } catch (err) {}

  // 2. Authoritative verify-order endpoint with fallback
  if (apiKey) {
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
          signal: AbortSignal.timeout(4000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") {
          return {
            status: "success",
            utr: data.data?.utr || data.utr,
            senderName: data.data?.sender_name || data.sender_name,
            amount: Number(data.data?.amount || data.amount) || undefined,
          };
        }
        if (data.status === "expired") {
          return { status: "expired" };
        }
      }
    } catch (err) {}
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
}): Promise<void> {
  const quantity = Math.max(1, data.quantity || 1);
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
      data.productId?.includes("crypto") ? "crypto" : "upi"
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
}: {
  orderId: string;
  utr?: string;
  senderName?: string;
  credential?: Credential;
  credentials?: Credential[];
  quantity?: number;
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
    if (idx !== -1) {
      history[idx].emailStatus = "failed";
      history[idx].emailError = error;
      await redis.set(ORDERS_HISTORY_KEY, history);
    }
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
  const credentials = await getFulfilledCredentials(orderId);
  if (!credentials || credentials.length === 0) {
    return { success: false, error: "No credentials found for this order ID in database." };
  }

  const history = await getAllOrders();
  const order = history.find((o) => o.orderId === orderId);
  const targetEmail = overrideEmail?.trim() || order?.email;

  if (!targetEmail) {
    return { success: false, error: "No customer email address found for this order." };
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

export async function getAllOrders(): Promise<StoredOrder[]> {
  const history = await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY);
  return history ?? [];
}


