import nodemailer from "nodemailer";
import { Redis } from "@upstash/redis";
import { APP_CONFIG } from "@/lib/config";

export type Credential = {
  id: string;
  email: string;
  password: string;
  token?: string;
  domain?: string;
  twoFactorKey?: string;
  keyweb?: string;
  addedAt: string;
};

export type OrderData = {
  email: string;
  amount: number;
  orderId: string;
  createdAt: number;
  quantity?: number;
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
}: {
  email: string;
  orderId: string;
  credential?: Credential;
  credentials?: Credential[];
  utr?: string;
  senderName?: string;
  amount?: number | string;
}): Promise<void> {
  const allCreds = credentials && credentials.length > 0 ? credentials : (credential ? [credential] : []);
  const qty = allCreds.length;

  const credentialsHtml = allCreds
    .map(
      (cred, idx) => `
    <div style="background:#f8fafc;border:2px solid #5865F2;border-radius:12px;padding:18px 22px;margin:16px 0;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#5865F2;text-transform:uppercase;letter-spacing:0.5px;">
        ${qty > 1 ? `Account #${idx + 1}` : "Your Nitro Booster Credentials"}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Email:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.email}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Password:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.password}</td>
        </tr>
        ${cred.domain ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Domain:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.domain}</td>
        </tr>` : ""}
        ${cred.token ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Token:</strong></td>
          <td style="color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;word-break:break-all;">${cred.token}</td>
        </tr>` : ""}
        ${cred.twoFactorKey ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>2FA Key:</strong></td>
          <td style="color:#0f172a;font-size:14px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;">${cred.twoFactorKey}</td>
        </tr>` : ""}
        ${cred.keyweb ? `
        <tr>
          <td style="color:#64748b;font-size:14px;padding:5px 0;width:105px;"><strong>Keyweb:</strong></td>
          <td style="color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;background:#ffffff;padding:7px 12px;border-radius:6px;border:1px solid #cbd5e1;word-break:break-all;">${cred.keyweb}</td>
        </tr>` : ""}
      </table>
      <p style="margin:10px 0 0;font-size:12px;color:#64748b;">
        💡 Log into Discord with these details to claim your <strong>2 Server Boosts</strong>.
      </p>
    </div>`
    )
    .join("");

  await transporter.sendMail({
    from: `"Get Your Account" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✅ Your Nitro Booster Account(s) [${qty} Delivered] — Payment Confirmed`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Nitro Booster Account</title>
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#5865F2,#7c3aed);padding:36px 40px;text-align:center;">
                    <div style="font-size:38px;margin-bottom:8px;">🚀</div>
                    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Payment Confirmed!</h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${qty}x Nitro Booster Account [with 2 Boosts each] delivered</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 36px;">
                    <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
                      Hi ${senderName ? `<strong>${senderName}</strong>` : "there"},<br/>
                      Thank you for your purchase! Your payment has been verified and your account credentials are below.
                    </p>

                    <!-- Features & Warranty Badge -->
                    <div style="display:flex;gap:8px;margin-bottom:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;">
                      <span style="font-size:16px;">🛡️</span>
                      <div style="font-size:13px;color:#166534;line-height:1.5;">
                        <strong>Warranty Guarantee Included:</strong> Every account is backed by our full replacement warranty. If you ever need help, reach out to our 24/7 support team on Discord!
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
                          <td style="color:#0f172a;font-size:13px;font-weight:600;text-align:right;">Nitro Booster ID [with 2 Boosts]</td>
                        </tr>
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Quantity</td>
                          <td style="color:#5865F2;font-size:13px;font-weight:700;text-align:right;">${qty} Account(s)</td>
                        </tr>
                        <tr>
                          <td style="color:#64748b;font-size:13px;padding:4px 0;">Order ID</td>
                          <td style="color:#5865F2;font-size:13px;font-weight:600;text-align:right;font-family:monospace;">${orderId}</td>
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

                    <!-- Discord 24/7 Support Box -->
                    <div style="background:linear-gradient(135deg,rgba(88,101,242,0.1),rgba(124,58,237,0.1));border:1px solid rgba(88,101,242,0.3);border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
                      <p style="margin:0 0 6px;font-weight:700;color:#5865F2;font-size:15px;">Need Help? 24/7 Support on Discord</p>
                      <p style="margin:0 0 14px;color:#64748b;font-size:13px;">Join our official server for warranty replacements, boost guides, and instant ticket assistance.</p>
                      <a href="${APP_CONFIG.discordLink}" target="_blank" style="display:inline-block;background:#5865F2;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-weight:600;font-size:13px;">
                        💬 Join Discord Support Server
                      </a>
                    </div>

                    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">
                      Please save these credentials safely and change the password if desired.
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
      </body>
      </html>
    `,
  });
}

/**
 * Fulfill an order: claim credentials, mark sent, send email, and save fulfillment info.
 * Returns { success, credential, credentials, alreadySent }
 */
export async function fulfillOrder({
  orderId,
  email,
  utr,
  senderName,
  amount = APP_CONFIG.price,
  quantity,
}: {
  orderId: string;
  email: string;
  utr?: string;
  senderName?: string;
  amount?: number | string;
  quantity?: number;
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

  // Determine requested quantity
  const orderData = await getOrder(orderId);
  const targetQty = Math.max(1, quantity || orderData?.quantity || 1);

  // Claim credentials from pool
  const claimedList = await claimCredentials(targetQty);
  if (!claimedList || claimedList.length === 0) {
    // Release the lock so it can be retried once restocked
    await redis.del(SENT_KEY(orderId));
    console.error("Credential pool is empty for orderId:", orderId);
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
    await sendCredentialEmail({
      email,
      orderId,
      credential: claimedList[0],
      credentials: claimedList,
      utr,
      senderName,
      amount,
    });
    console.log(`${claimedList.length} credentials delivered to ${email} for orderId=${orderId}`);
  } catch (err) {
    console.error("Failed to send email:", err);
  }

  return { success: true, credential: claimedList[0], credentials: claimedList };
}

export type StoredOrder = {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  createdAt: string;
  confirmedAt?: string;
  utr?: string;
  senderName?: string;
  deliveredCredential?: {
    email: string;
    password?: string;
    token?: string;
    domain?: string;
    twoFactorKey?: string;
    keyweb?: string;
  };
  deliveredCredentials?: Credential[];
};

export const ORDERS_HISTORY_KEY = "orders_history";

export async function recordNewOrder(data: {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
}): Promise<void> {
  const quantity = Math.max(1, data.quantity || 1);
  const newOrder: StoredOrder = {
    orderId: data.orderId,
    email: data.email,
    amount: data.amount,
    quantity,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await storeOrder(data.orderId, {
    email: data.email,
    amount: data.amount,
    orderId: data.orderId,
    quantity,
    createdAt: Date.now(),
  });

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

export async function getAllOrders(): Promise<StoredOrder[]> {
  const history = await redis.get<StoredOrder[]>(ORDERS_HISTORY_KEY);
  return history ?? [];
}

