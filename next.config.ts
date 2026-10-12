import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ATLOS_MERCHANT_ID:
      process.env.ATLOS_MERCHANT_ID ||
      process.env.ATLOS_MERCHANT_ID ||
      "ADK7QABYR0",
    INR_TO_USD_RATE:
      process.env.INR_TO_USD_RATE ||
      process.env.NEXT_PUBLIC_INR_TO_USD_RATE ||
      "0.0118",
    DISCORD_LINK:
      process.env.DISCORD_LINK ||
      process.env.NEXT_PUBLIC_DISCORD_LINK ||
      "https://discord.com/invite/grrSJENXR",
    APP_URL:
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://get-me-account.vercel.app/",
    PRICE_INR:
      process.env.PRICE_INR ||
      process.env.NEXT_PUBLIC_PRICE_INR ||
      "1",
  },
};

export default nextConfig;
