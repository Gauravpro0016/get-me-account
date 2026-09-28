export interface Review {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1 to 5
  date: string;
  comment: string;
  verified: boolean;
  productName?: string;
  productId?: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  type: string;
}

export interface InventoryItem {
  id: string;
  fields: Record<string, string>;
  addedAt: string;
  claimedAt?: string;
  claimedByOrder?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  badge?: "Best Seller" | "Hot Deal" | "Instant Key" | "Trending" | "Limited Stock" | string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  shortDescription: string;
  description: string;
  features: string[];
  deliveryType: "Instant Automated Delivery" | "Instant Activation Key" | "Instant Account ID + Pass" | string;
  warranty: string;
  inStock: boolean;
  stockCount: number;
  tags: string[];
  bannerGradient: string;
  iconType: string;
  customLogoUrl?: string;
  logoSize?: "small" | "medium" | "large" | "xl" | string;
  customBgUrl?: string;
  bgSize?: "cover" | "contain" | "auto" | "100% 100%" | string;
  reviews: Review[];
  customFields?: CustomFieldDefinition[];
  inventory?: InventoryItem[];
  isCustom?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "netflix-premium-key",
    name: "Netflix Premium 4K UHD Key (1 Month Private Profile)",
    category: "Streaming",
    badge: "Best Seller",
    price: 199,
    originalPrice: 649,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Ultra HD 4K streaming key with private PIN-locked profile. Instant activation.",
    description: "Get genuine 1-Month access to Netflix Premium with 4K UHD HDR streaming, spatial audio, and your own dedicated private profile protected by a PIN. Works on Smart TVs, PC, iOS, Android, and consoles. Instant automated delivery right after payment with replacement guarantee.",
    features: [
      "Ultra HD 4K & Dolby Atmos Audio",
      "Private 1-Screen Profile with Personal PIN",
      "Works on Smart TVs, PC, Phone & Consoles",
      "Download videos for offline viewing",
      "30 Days Full Replacement Warranty"
    ],
    deliveryType: "Instant Automated Delivery",
    warranty: "30-Day Instant Replacement Warranty",
    inStock: true,
    stockCount: 42,
    tags: ["netflix", "movies", "4k", "streaming", "shows"],
    bannerGradient: "from-red-600/20 via-black to-zinc-900",
    iconType: "netflix",
    reviews: []
  },
  {
    id: "steam-id-pass",
    name: "Steam ID + Password (CS2 Prime + Level 10+ Included)",
    category: "Gaming",
    badge: "Trending",
    price: 349,
    originalPrice: 1499,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Original Steam Account with CS2 Prime Status, Level 10+, and original email access.",
    description: "Ready-to-play Steam Account featuring Counter-Strike 2 Prime Status, Level 10+ badge, unlocked community market, and zero bans. Comes with full credentials (Steam Login, Steam Password, First Mail Access) enabling you to change all security details to your own.",
    features: [
      "Counter-Strike 2 Prime Status Enabled",
      "Steam Level 10+ with Custom Profile URL",
      "Clean Record: No VAC Bans, No Community Bans",
      "Full Email & Password Changeable",
      "Instant Credentials Delivery with 2FA Guide"
    ],
    deliveryType: "Instant Account ID + Pass",
    warranty: "Lifetime Legitimacy Warranty",
    inStock: true,
    stockCount: 19,
    tags: ["steam", "cs2", "prime", "gaming", "pc"],
    bannerGradient: "from-blue-600/20 via-cyan-900/30 to-zinc-900",
    iconType: "steam",
    reviews: []
  },
  {
    id: "discord-nitro-booster",
    name: "Discord Nitro Booster ID [with 2 Boosts Included]",
    category: "Discord",
    badge: "Best Seller",
    price: 199,
    originalPrice: 799,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Full Discord Nitro account with 2 Server Boosts, custom banner, 500MB uploads.",
    description: "Full Discord Nitro Booster account loaded with 2 active Server Boosts, 500MB file upload limits, custom emojis anywhere, animated avatars, server banners, and HD streaming at 4K 60FPS. Instant automated credential delivery via UPI.",
    features: [
      "2 Active Server Boosts included",
      "500MB Upload Limit & HD 4K 60FPS Streaming",
      "Custom Emojis & Animated Stickers anywhere",
      "Custom Profile Theme & Animated Banner",
      "Full Replacement Warranty & Discord Support"
    ],
    deliveryType: "Instant Automated Delivery",
    warranty: "Full Replacement Warranty",
    inStock: true,
    stockCount: 65,
    tags: ["discord", "nitro", "boost", "community", "gaming"],
    bannerGradient: "from-indigo-600/25 via-purple-900/30 to-zinc-900",
    iconType: "discord",
    reviews: []
  },
  {
    id: "steam-wallet-code-500",
    name: "Steam Wallet Digital Gift Code ₹500",
    category: "Gaming",
    badge: "Instant Key",
    price: 469,
    originalPrice: 500,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Official Steam Wallet digital redeem code worth ₹500. Zero region lock for India.",
    description: "Official Steam Wallet Digital Code valued at ₹500 INR. Instantly redeem on your own personal Steam account to purchase any games, DLCs, in-game skins, or battle passes on the Steam Store.",
    features: [
      "100% Genuine Digital Steam Code",
      "Instant Balance Credit of ₹500 INR",
      "Redeem on any Indian Steam Account",
      "No Expiry Date on Unredeemed Codes",
      "Instant Delivery to Screen & Email"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "Guaranteed Valid Key Warranty",
    inStock: true,
    stockCount: 28,
    tags: ["steam", "wallet", "gift card", "games", "inr"],
    bannerGradient: "from-sky-600/20 via-blue-900/30 to-zinc-900",
    iconType: "steam",
    reviews: []
  },
  {
    id: "spotify-premium-key",
    name: "Spotify Premium Individual (3 Months Activation Key)",
    category: "Streaming",
    badge: "Hot Deal",
    price: 149,
    originalPrice: 389,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Ad-free music with high quality audio and offline downloads for 3 full months.",
    description: "Experience music without boundaries. Ad-free streaming, offline song downloads, unlimited skips, and ultra-high fidelity audio on all your mobile devices, PCs, and smart speakers.",
    features: [
      "Ad-Free Listening with Unlimited Skips",
      "Download Music for Offline Mode",
      "Highest Quality 320kbps Audio",
      "Works on Phone, PC, Smart TV & Alexa",
      "Works with Your Existing or New Account"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "Full Term Replacement Warranty",
    inStock: true,
    stockCount: 50,
    tags: ["spotify", "music", "songs", "audio", "streaming"],
    bannerGradient: "from-emerald-600/20 via-green-900/30 to-zinc-900",
    iconType: "spotify",
    reviews: []
  },
  {
    id: "xbox-game-pass-ultimate",
    name: "Xbox Game Pass Ultimate (2 Months Access Key)",
    category: "Gaming",
    badge: "Best Seller",
    price: 279,
    originalPrice: 1099,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Access 400+ AAA PC & Console games, EA Play included, and Cloud Gaming.",
    description: "Play hundreds of high-quality games including new releases on day one, plus online multiplayer, EA Play membership, and exclusive in-game perks across PC and Xbox consoles.",
    features: [
      "400+ High Quality Games (Halo, Forza, Starfield)",
      "Day One Access to New Releases",
      "EA Play Membership Included",
      "PC + Xbox Console + Cloud Gaming",
      "Instant Digital Key Delivery"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "Active Term Guarantee",
    inStock: true,
    stockCount: 31,
    tags: ["xbox", "game pass", "halo", "forza", "ea play"],
    bannerGradient: "from-green-600/25 via-emerald-950/40 to-zinc-900",
    iconType: "xbox",
    reviews: []
  },
  {
    id: "minecraft-java-bedrock",
    name: "Minecraft: Java & Bedrock Edition Official Key (PC)",
    category: "Gaming",
    badge: "Trending",
    price: 499,
    originalPrice: 1999,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Official Microsoft Minecraft key containing both Java Edition and Bedrock Edition.",
    description: "Get the complete Minecraft experience with both Java and Bedrock editions. Play with friends across platforms, access multiplayer servers, install custom shaders and mods, and enjoy limitless creativity.",
    features: [
      "Includes BOTH Java Edition & Bedrock Edition",
      "Redeem directly on Microsoft / Minecraft.net",
      "Permanent Ownership tied to your Microsoft Account",
      "Multiplayer & Hypixel Server Access",
      "Official License Key with Instant Delivery"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "Permanent Lifetime License",
    inStock: true,
    stockCount: 15,
    tags: ["minecraft", "java", "bedrock", "hypixel", "microsoft"],
    bannerGradient: "from-amber-600/20 via-orange-950/40 to-zinc-900",
    iconType: "minecraft",
    reviews: []
  },
  {
    id: "gta-v-premium-key",
    name: "Grand Theft Auto V: Premium Edition Key (PC)",
    category: "Gaming",
    badge: "Hot Deal",
    price: 399,
    originalPrice: 1999,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Full GTA V Story Mode + GTA Online + Criminal Enterprise Starter Pack ($10M value).",
    description: "Complete GTA V PC key including the critically acclaimed Story Mode, GTA Online access, and the Criminal Enterprise Starter Pack with $1,000,000 bonus cash and luxury properties in GTA Online.",
    features: [
      "Full Story Mode + GTA Online Access",
      "Criminal Enterprise Starter Pack Included",
      "$1,000,000 Bonus Cash in GTA Online",
      "Direct Rockstar Games Launcher Activation",
      "Permanent License Key"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "Permanent Ownership Guarantee",
    inStock: true,
    stockCount: 22,
    tags: ["gta", "gta v", "rockstar", "grand theft auto", "online"],
    bannerGradient: "from-yellow-600/20 via-amber-950/40 to-zinc-900",
    iconType: "gta",
    reviews: []
  },
  {
    id: "youtube-premium-key",
    name: "YouTube Premium 6 Months Individual Family Invite",
    category: "Streaming",
    badge: "Instant Key",
    price: 249,
    originalPrice: 774,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Ad-free YouTube, background play, YouTube Music Premium, and video downloads.",
    description: "Enjoy YouTube without annoying interruptions. Zero ads across smart TVs, phones, and laptops, background play while using other apps or with screen turned off, and full YouTube Music Premium access.",
    features: [
      "Completely Ad-Free Videos across all devices",
      "Background Play with Screen Off",
      "YouTube Music Premium Included",
      "Offline Video & Song Downloads",
      "6-Month Guaranteed Term"
    ],
    deliveryType: "Instant Automated Delivery",
    warranty: "6-Month Full Replacement Guarantee",
    inStock: true,
    stockCount: 35,
    tags: ["youtube", "music", "ad free", "streaming", "video"],
    bannerGradient: "from-rose-600/20 via-red-950/40 to-zinc-900",
    iconType: "youtube",
    reviews: []
  },
  {
    id: "windows-11-pro-key",
    name: "Windows 11 Pro OEM Lifetime Activation Key",
    category: "Software & Keys",
    badge: "Best Seller",
    price: 299,
    originalPrice: 14999,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Genuine 25-digit OEM product key for Windows 11 Professional. Lifetime activation.",
    description: "Activate Windows 11 Professional permanently with an official Microsoft digital key. Unlock BitLocker encryption, Remote Desktop, Windows Sandbox, Hyper-V, and full official Microsoft updates.",
    features: [
      "100% Genuine 25-Digit Microsoft Activation Key",
      "Lifetime Activation tied to your PC motherboard",
      "Full BitLocker Encryption & Remote Desktop",
      "Supports Clean Install & Upgrade from Win 11 Home",
      "All Official Microsoft Updates & Security Patches"
    ],
    deliveryType: "Instant Activation Key",
    warranty: "100% Activation Guarantee or Full Refund",
    inStock: true,
    stockCount: 55,
    tags: ["windows", "windows 11", "software", "keys", "microsoft", "pc"],
    bannerGradient: "from-cyan-600/20 via-blue-950/40 to-zinc-900",
    iconType: "windows",
    reviews: []
  },
  {
    id: "nordvpn-1year-key",
    name: "NordVPN 1-Year Ultra Secure Key / Account Access",
    category: "Software & Keys",
    badge: "Hot Deal",
    price: 349,
    originalPrice: 3999,
    rating: 5.0,
    reviewsCount: 0,
    shortDescription: "Ultra-fast VPN with 6000+ servers worldwide, Threat Protection, and zero logs.",
    description: "Safeguard your internet privacy, bypass geo-restrictions, stream content from 60+ countries, and block malicious ads & malware with the world's leading high-speed VPN provider.",
    features: [
      "6000+ Ultra-Fast Servers in 111 Countries",
      "Double Encryption & Zero Log Privacy Policy",
      "Built-in Threat Protection & Ad Blocker",
      "Connect up to 6 Devices simultaneously",
      "Full 1-Year Replacement Warranty"
    ],
    deliveryType: "Instant Account ID + Pass",
    warranty: "1-Year Warranty & Discord Support",
    inStock: true,
    stockCount: 18,
    tags: ["vpn", "nordvpn", "privacy", "security", "streaming"],
    bannerGradient: "from-blue-600/25 via-indigo-950/40 to-zinc-900",
    iconType: "vpn",
    reviews: []
  }
];

export const CATEGORIES = [
  "All",
  "Streaming",
  "Gaming",
  "Discord",
  "Software & Keys"
] as const;

export type CategoryType = (typeof CATEGORIES)[number];

export const ACTIVE_PRODUCTS_CACHE_KEY = "trinitymart_active_products_cache";
export const REMOVED_IDS_CACHE_KEY = "trinitymart_removed_product_ids_cache";

/**
 * Returns the client-side initial product catalog.
 * Uses cached live products or filtered defaults from localStorage if available,
 * preventing removed products from momentarily showing on page reload.
 */
export function getClientInitialProducts(): Product[] {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(ACTIVE_PRODUCTS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      const removed = localStorage.getItem(REMOVED_IDS_CACHE_KEY);
      if (removed) {
        const removedIds = JSON.parse(removed);
        if (Array.isArray(removedIds) && removedIds.length > 0) {
          return PRODUCTS.filter((p) => !removedIds.includes(p.id));
        }
      }
    } catch {}
  }
  return PRODUCTS;
}

export function getAllProducts(): Product[] {
  return PRODUCTS;
}

export function getProductById(id: string): Product | undefined {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(ACTIVE_PRODUCTS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const found = parsed.find((p: Product) => p.id === id);
          if (found) return found;
        }
      }
    } catch {}
  }
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  if (category === "All" || !category) return PRODUCTS;
  return PRODUCTS.filter((p) => p.category.toLowerCase() === category.toLowerCase());
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.badge === "Best Seller" || p.badge === "Trending" || p.badge === "Hot Deal");
}

export function searchProducts(query: string, category?: string, sourceList?: Product[]): Product[] {
  let list = sourceList && Array.isArray(sourceList) ? sourceList : PRODUCTS;
  if (category && category !== "All") {
    list = list.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }
  if (!query || query.trim() === "") return list;

  const clean = query.trim().toLowerCase();
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(clean) ||
      p.shortDescription.toLowerCase().includes(clean) ||
      p.category.toLowerCase().includes(clean) ||
      p.tags.some((t) => t.toLowerCase().includes(clean))
  );
}
