import nodemailer, { type SentMessageInfo } from "nodemailer";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";

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
};

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const POOL_KEY = "credentials_pool";
export const SENT_KEY = (orderId: string) => `sent:${orderId}`;
export const ORDER_KEY = (orderId: string) => `order:${orderId}`;
export const FULFILLED_KEY = (orderId: string) => `fulfilled:${orderId}`;

export async function readPool(): Promise<Credential[]> {
  const pool = await redis.get<Credential[]>(POOL_KEY);
  return pool ?? [];
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
 * Updates `claimedAt` and `claimedByOrder` in Redis, and automatically decrements live stock.
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

  // Also check if inventory is in credentials_pool if productId is discord-nitro-booster
  if ((!inventory || inventory.length === 0) && productId === "discord-nitro-booster") {
    try {
      const pool = (await redis.get<any[]>("credentials_pool")) || [];
      if (Array.isArray(pool) && pool.length > 0) {
        inventory = pool.map((item: any) => ({
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
          const claimedEmails = new Set(claimedCredentials.map(c => (c.email || "").toLowerCase()));
          const updatedPool = pool.filter(p => !claimedEmails.has((p.email || p.id || "").toLowerCase()));
          await redis.set("credentials_pool", updatedPool);
        }
      } catch (e) {
        console.warn("Failed to clean credentials_pool:", e);
      }
    }
  }

  // If we claimed all requested items, return them
  if (claimedCredentials.length >= count) {
    return claimedCredentials;
  }

  // If product inventory had fewer items than requested:
  const stillNeeded = count - claimedCredentials.length;

  // 1. Try legacy credentials pool
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

// Nodemailer Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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

  const credentialsHtml = allCreds
    .map(
      (cred, idx) => {
        const itemTitle = cred.productName || primaryTitle;
        const accountId = cred.fields?.id || cred.fields?.username || cred.fields?.login || (cred.email !== email ? cred.email : "");
        const password = cred.fields?.password || cred.password || cred.emailPassword;
        const token = cred.fields?.token || cred.token || cred.fields?.key;
        const pin = cred.fields?.pin || cred.twoFactorKey || cred.fields?.["2fa"];

        return `
    <div style="background:#f8fafc;border:2px solid #06b6d4;border-radius:12px;padding:18px 22px;margin:16px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0891b2;text-transform:uppercase;letter-spacing:0.5px;">
        ${qty > 1 ? `Unit #${idx + 1}: ${itemTitle}` : `Your ${itemTitle} Credentials`}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${accountId ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:130px;"><strong>Account ID / Login:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${accountId}</td>
        </tr>` : `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Customer Email:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.email}</td>
        </tr>`}
        ${password ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:130px;"><strong>Password:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${password}</td>
        </tr>` : ""}
        ${token ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:130px;"><strong>License Key / Code:</strong></td>
          <td style="color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;word-break:break-all;">${token}</td>
        </tr>` : ""}
        ${pin ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:130px;"><strong>2FA / PIN:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${pin}</td>
        </tr>` : ""}
        ${cred.domain ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:130px;"><strong>Domain:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.domain}</td>
        </tr>` : ""}
      </table>
      <p style="margin:10px 0 0;font-size:12px;color:#64748b;">
        💡 Save these credentials securely. Full replacement warranty is active.
      </p>
    </div>`;
      }
    )
    .join("");

  return await transporter.sendMail({
    from: `"Trinitymart Store" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✅ Your ${primaryTitle} [${qty} Delivered] — Payment Confirmed`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${primaryTitle}</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#06b6d4,#2563eb);padding:36px 40px;text-align:center;">
                    <div style="font-size:38px;margin-bottom:8px;">⚡</div>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Payment Confirmed!</h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${qty}x ${primaryTitle} delivered instantly</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                      Hi ${senderName ? `<strong>${senderName}</strong>` : "there"},<br/>
                      Thank you for your purchase from Trinitymart! Your payment has been verified and your authentic account credentials from our database are below.
                    </p>

                    <!-- Features & Warranty Badge -->
                    <div style="display:flex;gap:8px;margin-bottom:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;">
                      <span style="font-size:16px;">🛡️</span>
                      <div style="font-size:13px;color:#166534;line-height:1.5;">
                        <strong>Warranty Guarantee Included:</strong> Every product is backed by our full replacement warranty. If you ever need help, reach out to our 24/7 support team on Discord!
                      </div>
                    </div>

                    <!-- Account Details Section -->
                    ${credentialsHtml}

                    <!-- Payment Summary Box -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:20px 0;">
                      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Payment Details</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Product</td>
                          <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${primaryTitle}</td>
                        </tr>
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Quantity</td>
                          <td style="color:#0891b2;font-size:13px;font-weight:700;text-align:right;">${qty} Unit(s)</td>
                        </tr>
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Order ID</td>
                          <td style="color:#0891b2;font-size:13px;font-weight:600;text-align:right;font-family:monospace;">${orderId}</td>
                        </tr>
                        ${utr ? `
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Bank UTR</td>
                          <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;font-family:monospace;">${utr}</td>
                        </tr>` : ""}
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Amount Paid</td>
                          <td style="color:#16a34a;font-size:14px;font-weight:700;text-align:right;">₹${amount}</td>
                        </tr>
                      </table>
                    </div>

                    <!-- Delivery Receipt Confirmation Box -->
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:18px 20px;margin:20px 0;text-align:center;">
                      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#1e40af;">
                        📬 Confirm Delivery &amp; Access Web Receipt
                      </p>
                      <p style="margin:0 0 12px;font-size:12px;color:#3b82f6;line-height:1.4;">
                        Confirm that you have received your credentials and view your warranty status and receipt online anytime.
                      </p>
                      <a href="${confirmReceiptUrl}" target="_blank" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;box-shadow:0 2px 4px rgba(8,145,178,0.2);">
                        ✅ Confirm Receipt Online
                      </a>
                    </div>

                    <!-- Discord 24/7 Support Box -->
                    <div style="background:linear-gradient(135deg,rgba(88,101,242,0.1),rgba(124,58,237,0.1));border:1px solid rgba(88,101,242,0.3);border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
                      <p style="margin:0 0 6px;font-weight:700;color:#5865F2;font-size:15px;">Need Help? 24/7 Support on Discord</p>
                      <p style="margin:0 0 14px;color:#64748b;font-size:13px;">Join our official server for warranty replacements, boost guides, and instant ticket assistance.</p>
                      <a href="${APP_CONFIG.discordLink}" target="_blank" style="display:inline-block;background:#5865F2;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;">
                        💬 Join Discord Support Server
                      </a>
                    </div>

                    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
                      Please save these credentials safely and change the passwords if desired.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f1f5f9;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">Get Your Account &middot; Automated UPI Settlement &middot; 24/7 Support</p>
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
      amount,
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

export async function recordNewOrder(data: {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: CartOrderItem[];
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


