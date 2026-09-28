export const APP_CONFIG = {
  storeName: "Trinitymart",
  storeTagline: "India's #1 Digital Keys & Gaming Marketplace",
  price: Number(process.env.PRICE_INR || process.env.NEXT_PUBLIC_PRICE_INR || 1),
  currency: "INR",
  currencySymbol: "₹",

  // Default Featured Product Details
  productName: "Discord Nitro Booster ID [with 2 Boosts]",
  productCategory: "Discord Nitro Booster Account",
  warrantyText: "Full Replacement Warranty",
  supportText: "24/7 Live Discord Support",

  // Discord 24/7 Support Server Link
  discordLink:
    process.env.DISCORD_LINK ||
    process.env.NEXT_PUBLIC_DISCORD_LINK,

  // App production URL
  appUrl:
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""),
};

