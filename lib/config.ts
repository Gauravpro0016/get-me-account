export const APP_CONFIG = {
  // Account price in INR (reads server-side PRICE_INR or falls back to 1)
  price: Number(process.env.PRICE_INR || process.env.NEXT_PUBLIC_PRICE_INR || 1),
  currency: "INR",
  currencySymbol: "₹",

  // Product Details
  productName: "Nitro Booster ID [with 2 Boosts]",
  productCategory: "Discord Nitro Booster Account",
  warrantyText: "Full Replacement Warranty",
  supportText: "24/7 Live Support",

  // Discord 24/7 Support Server Link (reads server-side DISCORD_LINK)
  discordLink:
    process.env.DISCORD_LINK ||
    process.env.NEXT_PUBLIC_DISCORD_LINK ||
    "https://discord.gg/your-discord-link",

  // App production URL (reads server-side APP_URL or Vercel URL)
  appUrl:
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
};
