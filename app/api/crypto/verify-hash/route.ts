import { NextRequest, NextResponse } from "next/server";
import {
  fulfillOrder,
  getOrder,
  getFulfilledCredentials,
  isAlreadySent,
  redis,
} from "@/lib/fulfillment";
import { APP_CONFIG } from "@/lib/config";

export const maxDuration = 45;

/**
 * Validates whether a string matches common blockchain transaction hash patterns:
 * - EVM (Ethereum, Polygon, BSC, Arbitrum, Base, Optimism): 0x followed by 64 hex characters
 * - Bitcoin, Litecoin, Tron: 64 hex characters
 * - Solana: Base58 string between 64 and 88 characters
 */
function isValidBlockchainTxHash(hash: string): boolean {
  if (!hash || typeof hash !== "string") return false;
  const clean = hash.trim();

  // EVM hash (0x + 64 hex chars = 66 chars)
  const isEvm = /^0x[a-fA-F0-9]{64}$/.test(clean);
  if (isEvm) return true;

  // BTC / LTC / TRX / Monero (64 hex characters)
  const isHex64 = /^[a-fA-F0-9]{64}$/.test(clean);
  if (isHex64) return true;

  // Solana (Base58, typically 87-88 chars, at least 64 chars)
  const isSolana = /^[1-9A-HJ-NP-za-km-z]{64,88}$/.test(clean);
  if (isSolana) return true;

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const txHash = typeof body.txHash === "string" ? body.txHash.trim() : "";

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    if (!txHash) {
      return NextResponse.json(
        { error: "Please enter your blockchain Transaction Hash (TxID)." },
        { status: 400 }
      );
    }

    // 1. Validate hash format
    if (!isValidBlockchainTxHash(txHash)) {
      return NextResponse.json(
        {
          error:
            "Invalid Transaction Hash format. Please enter a valid 66-character EVM (0x...), 64-character Bitcoin/TRX, or Solana TxID.",
        },
        { status: 400 }
      );
    }

    const cleanHash = txHash.toLowerCase();

    // 2. Prevent replay attacks & duplicate redemption
    try {
      const isClaimed = await redis.sismember("used_crypto_hashes", cleanHash);
      if (isClaimed) {
        return NextResponse.json(
          {
            error: `This Transaction Hash (${txHash.slice(0, 10)}...) has already been claimed for another order. Duplicate redemptions are rejected.`,
          },
          { status: 400 }
        );
      }
    } catch (e) {
      console.warn("Redis used_crypto_hashes check error:", e);
    }

    // 3. Resolve order data & email
    const orderData = await getOrder(orderId);
    if (!email && orderData?.email) {
      email = orderData.email.trim().toLowerCase();
    }
    if (!email) {
      return NextResponse.json(
        { error: "No customer email associated with this order. Please specify your delivery email." },
        { status: 400 }
      );
    }

    // 4. Check if already fulfilled
    const alreadySent = await isAlreadySent(orderId);
    if (alreadySent) {
      const credentialsList = await getFulfilledCredentials(orderId);
      if (credentialsList && credentialsList.length > 0) {
        return NextResponse.json({
          success: true,
          already_sent: true,
          credential: credentialsList[0] || undefined,
          credentials: credentialsList,
          txHash,
        });
      }
    }

    // 5. Verify transaction with Atlos REST API if API Secret is configured
    const atlosSecret =
      process.env.ATLOS_API_SECRET || "6UCqzHHDmb5f0NbXOGCmLKFc2PVIMEYB";
    const merchantId =
      process.env.ATLOS_MERCHANT_ID ||
      process.env.ATLOS_MERCHANT_ID ||
      "ADK7QABYR0";
    let gatewayVerified = false;

    if (atlosSecret) {
      try {
        const atlosRes = await fetch("https://api.atlos.io/gateway/rest/Transaction/FindByHash", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ApiSecret: atlosSecret,
          },
          body: JSON.stringify({ MerchantId: merchantId, BlockchainHash: txHash }),
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });

        if (atlosRes.ok) {
          const atlosData = await atlosRes.json();
          // Atlos returns { IsFound: true, Transaction: { ... } }
          if (
            atlosData &&
            (atlosData.IsFound ||
              atlosData.Transaction ||
              atlosData.Id ||
              atlosData.TransactionId ||
              atlosData.Txid)
          ) {
            gatewayVerified = true;
          }
        } else {
          console.warn("Atlos Transaction/FindByHash non-OK response:", atlosRes.status);
        }
      } catch (err) {
        console.warn("Atlos Transaction/FindByHash fetch error:", err);
      }
    } else {
      // In development / demo mode without ATLOS_API_SECRET set,
      // allow valid hash format check so merchants can test fulfillment smoothly
      gatewayVerified = true;
    }

    if (!gatewayVerified) {
      return NextResponse.json(
        {
          error:
            "Transaction could not be verified on the blockchain yet. If you just sent the payment, please allow 30-60 seconds for block confirmation and try again.",
        },
        { status: 400 }
      );
    }

    // 6. Record transaction hash to prevent double usage
    try {
      await redis.sadd("used_crypto_hashes", cleanHash);
    } catch (e) {
      console.warn("Failed to save to used_crypto_hashes in Redis:", e);
    }

    // 7. Fulfill order, claim credentials atomically, and send delivery email
    const result = await fulfillOrder({
      orderId,
      email,
      utr: `CRYPTO:${txHash}`,
      amount: orderData?.amount || APP_CONFIG.price,
      quantity: orderData?.quantity || 1,
      productId: orderData?.productId,
      productName: orderData?.productName,
      cartItems: orderData?.cartItems,
    });

    if (!result.success && result.error) {
      return NextResponse.json(
        { error: "Payment verified, but stock is currently low. Support has been notified." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      credential: result.credential || undefined,
      credentials: result.credentials || (result.credential ? [result.credential] : []),
      txHash,
    });
  } catch (err) {
    console.error("Crypto verify-hash endpoint error:", err);
    return NextResponse.json(
      { error: "Internal server error while verifying cryptocurrency transaction hash." },
      { status: 500 }
    );
  }
}
