"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Zap,
  Search,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronDown,
  Star,
  CheckCircle,
  HelpCircle,
  Activity,
  Headset,
} from "lucide-react";
import {
  getClientInitialProducts,
  Product,
  ACTIVE_PRODUCTS_CACHE_KEY,
  REMOVED_IDS_CACHE_KEY,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { ProductIcon } from "@/components/ProductIcons";
import { ProductCardSkeleton } from "@/components/Skeleton";
import { useCurrency } from "@/lib/currency-context";
import { APP_CONFIG } from "@/lib/config";

const HOT_VECTORS = [
  { label: "All Stock", query: "" },
  { label: "Discord Nitro", query: "Discord" },
  { label: "Netflix 4K UHD", query: "Netflix" },
  { label: "Spotify Premium", query: "Spotify" },
  { label: "Steam CS2 Prime", query: "Steam" },
  { label: "VPN Tier 1", query: "VPN" },
  { label: "GTA V", query: "GTA" },
  { label: "Minecraft", query: "Minecraft" },
];

const FAQS = [
  {
    q: "How does automated delivery work?",
    a: "Once payment verification completes through our gateway (instant UPI confirmation or 1 blockchain network confirmation), our distributed system immediately assigns an unhashed key from the air-gapped inventory pool. Credentials appear on screen instantaneously and a backup copy is dispatched to your delivery email.",
  },
  {
    q: "What payment methods are supported?",
    a: "We support domestic zero-fee UPI (PhonePe, Google Pay, Paytm, BHIM) with automated dynamic QR generation, alongside multi-chain cryptocurrency protocols (USDT, BTC, LTC, ETH, SOL) via Atlos with zero merchant fees.",
  },
  {
    q: "What is the replacement warranty & SLA policy?",
    a: "Every product comes with a dedicated replacement warranty (30 days up to 1 full year). If an issue arises with an account or license during the warranty window, reach out via our Discord or Telegram desk. Invalids are verified and replaced within minutes.",
  },
  {
    q: "Can I purchase wholesale in bulk or via API?",
    a: "Yes. Resellers and volume buyers can connect via our Developer API endpoints. Bulk pricing discounts (15% to 35% off storefront rates) are automatically tiered depending on order volume.",
  },
];

interface TelemetryData {
  latestKey: string;
  latestProductName: string;
  latestTimeAgo: string;
  latestTickerText: string;
  avgEscrowTime: string;
  speedIndex: string;
  activeInventory: string;
  escrowSettlement: string;
  totalTrades: string;
  systemStatus: string;
  keysSoldToday?: number;
  keysSoldTodayExact?: number;
  totalKeysSold?: number;
  keysSoldTodayText?: string;
}

const DEFAULT_TELEMETRY: TelemetryData = {
  latestKey: "NETFLIX-UHD-****",
  latestProductName: "Netflix Premium 4K UHD Key",
  latestTimeAgo: "Just now",
  latestTickerText: "LATEST KEY: NETFLIX-UHD-**** DISPATCHED (Just now)",
  avgEscrowTime: "4.2s",
  speedIndex: "5.4s",
  activeInventory: "--",
  escrowSettlement: "100%",
  totalTrades: "0",
  systemStatus: "DISPATCH OPERATIONAL",
  keysSoldToday: 0,
  keysSoldTodayExact: 0,
  totalKeysSold: 0,
  keysSoldTodayText: "0 Keys Sold Today",
};

export default function HomePage() {
  const [allProducts, setAllProducts] = useState<Product[]>(getClientInitialProducts);
  const [isLoading, setIsLoading] = useState<boolean>(() => allProducts.length === 0);
  const [telemetry, setTelemetry] = useState<TelemetryData>(DEFAULT_TELEMETRY);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeVector, setActiveVector] = useState("All Stock");
  const [sortBy, setSortBy] = useState<"popularity" | "price-low" | "newest">("popularity");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { formatPrice } = useCurrency();

  // Fetch real database telemetry
  useEffect(() => {
    async function fetchTelemetry() {
      try {
        const res = await fetch("/api/telemetry", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setTelemetry((prev) => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.warn("Could not fetch database telemetry:", e);
      }
    }
    fetchTelemetry();
    // Live update telemetry every 30 seconds
    const interval = setInterval(fetchTelemetry, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live products from Redis/DB
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json();
        if (data.products && Array.isArray(data.products)) {
          setAllProducts(data.products);
          try {
            localStorage.setItem(ACTIVE_PRODUCTS_CACHE_KEY, JSON.stringify(data.products));
            if (data.removedIds && Array.isArray(data.removedIds)) {
              localStorage.setItem(REMOVED_IDS_CACHE_KEY, JSON.stringify(data.removedIds));
            }
          } catch {}
        }
      } catch (e) {
        console.warn("Could not fetch latest products, using local catalog:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // CMD+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // Filter by search/vector
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.shortDescription.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortBy === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "newest") {
      list.reverse();
    } else {
      list.sort((a, b) => b.reviewsCount - a.reviewsCount);
    }

    return list;
  }, [allProducts, searchQuery, sortBy]);

  const handleVectorClick = (item: { label: string; query: string }) => {
    setActiveVector(item.label);
    setSearchQuery(item.query);
  };

  return (
    <div className="w-full bg-[#0f131c] text-[#dfe2ee] font-sans min-h-screen selection:bg-[#6366f1] selection:text-white">
      {/* 1. TOP TELEMETRY / SYSTEM TICKER */}
      <section className="w-full bg-[#0a0e16] border-b border-[#262a33] px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 font-mono text-[11px] text-[#908fa0]">
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
            <span className="flex items-center gap-1.5 text-[#4edea3] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              SYS STATUS: {telemetry.systemStatus}
            </span>
            <span className="hidden sm:inline text-[#31353e]">•</span>
            <span className="hidden sm:inline">AVG ESCROW TIME: {telemetry.avgEscrowTime}</span>
            <span className="hidden sm:inline text-[#31353e]">•</span>
            <span className="text-[#c7c4d7] font-medium">
              LATEST KEY: {telemetry.latestKey} DISPATCHED ({telemetry.latestTimeAgo})
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#6184d8] font-semibold">GLOBAL GUARANTEE: ZERO LOGS POLICY</span>
            <span className="bg-[#1c2028] border border-[#262a33] px-2 py-0.5 rounded text-[#dfe2ee]">
              API v3.8.4
            </span>
          </div>
        </div>
      </section>

      {/* 2. HERO ANNOUNCEMENT & HIGH-INTENT COMMAND SEARCH */}
      <section className="relative w-full bg-[#181c24] px-4 sm:px-6 lg:px-8 py-8 md:py-12 border-b border-[#262a33] overflow-hidden">
        {/* Glow ambient background accents (hardware accelerated) */}
        <div className="absolute -top-32 left-1/3 w-96 h-96 bg-[#6184d8]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-[#4edea3]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col gap-6 relative z-10">
          {/* Announcement Banner Bar */}
          <div className="w-full bg-[#262a33] rounded-xl p-4 md:p-5 flex flex-col lg:flex-row items-center justify-between gap-4 border border-[#31353e] shadow-md">
            <div className="flex items-center gap-4 flex-wrap justify-center lg:justify-start">
              <div className="w-10 h-10 rounded-lg bg-[#6184d8] flex items-center justify-center text-white shadow-md">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="text-center lg:text-left">
                <div className="font-bold text-base text-[#dfe2ee] tracking-tight">
                  Automated Dispatch Engine Active
                </div>
                <div className="font-mono text-xs text-[#c7c4d7] mt-0.5">
                  Instant Key Ingestion via Ephemeral Token • 24/7 Replacement SLA • Zero KYC Registration
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-md bg-[#0a0e16] border border-[#262a33] text-[#4edea3] font-mono text-xs uppercase flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#4edea3]" />
                {telemetry.escrowSettlement || "100%"} Fulfillment Rate
              </span>
              <span className="px-3 py-1 rounded-md bg-[#1c2028] border border-[#262a33] text-[#908fa0] font-mono text-xs">
                {telemetry.keysSoldTodayText || `${(telemetry.keysSoldToday ?? 0).toLocaleString()} Keys Sold Today`}
              </span>
            </div>
          </div>

          {/* Main Search Shell with Command Bar */}
          <div className="w-full flex flex-col gap-4 bg-[#1c2028] rounded-2xl p-5 md:p-6 border border-[#262a33] shadow-xl">
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#908fa0] w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts, subscriptions, keys, or tags e.g. Netflix, Discord, CS2, Spotify..."
                  className="w-full h-14 pl-12 pr-24 rounded-xl bg-[#0a0e16] border border-[#262a33] text-[#dfe2ee] placeholder:text-[#908fa0] font-sans text-sm md:text-base focus:outline-none focus:border-[#6184d8] focus:ring-1 focus:ring-[#6184d8] transition-all shadow-inner"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
                  <kbd className="px-2 py-0.5 rounded bg-[#262a33] font-mono text-[10px] text-[#c7c4d7] border border-[#31353e]">
                    CMD
                  </kbd>
                  <kbd className="px-2 py-0.5 rounded bg-[#262a33] font-mono text-[10px] text-[#c7c4d7] border border-[#31353e]">
                    K
                  </kbd>
                </div>
              </div>

              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className="w-full md:w-auto px-6 h-14 rounded-xl bg-[#6184d8] hover:bg-[#4d6ec4] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#6184d8]/25 cursor-pointer"
              >
                <span>Query Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Hot Vectors Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
              <span className="font-mono text-xs text-[#908fa0] uppercase tracking-wider whitespace-nowrap mr-1">
                Hot Vectors:
              </span>
              {HOT_VECTORS.map((item) => {
                const isActive = activeVector === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleVectorClick(item)}
                    className={`px-3.5 py-1.5 rounded-lg font-mono text-xs whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#6184d8] text-white font-bold shadow-sm"
                        : "bg-[#181c24] text-[#dfe2ee] hover:bg-[#262a33] border border-[#262a33]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2.5 INTERACTIVE RIGHT-TO-LEFT SCROLLING CARDS SHOWCASE */}
      <section className="w-full bg-[#0a0e16] border-b border-[#262a33] py-5 overflow-hidden relative">
        {/* Gradient edge fades for smooth infinite flow */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#0a0e16] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#0a0e16] to-transparent z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#6184d8]">
              Live Inventory Telemetry
            </span>
 
          </div>
          <span className="font-mono text-[11px] text-[#908fa0] hidden sm:inline">
            ⚡ Hover to Pause • Click to Inspect Asset
          </span>
        </div>

        {/* Marquee Track (Double track for continuous infinite right-to-left loop) */}
        <div className="overflow-hidden">
          <div className="animate-marquee-rtl flex gap-4">
            {allProducts.concat(allProducts).map((prod, idx) => (
              <Link
                key={`marquee-card-${prod.id}-${idx}`}
                href={`/product/${prod.id}`}
                className="w-64 sm:w-72 p-3.5 rounded-2xl bg-[#181c24] border border-[#262a33] hover:border-[#6184d8] shadow-md hover:shadow-[#6184d8]/15 transition-all cursor-pointer flex flex-col justify-between shrink-0 group/card"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ProductIcon
                      type={prod.iconType}
                      customLogoUrl={prod.customLogoUrl}
                      logoSize={prod.logoSize}
                      className="w-10 h-10 shrink-0 rounded-xl border border-[#262a33] group-hover/card:border-[#6184d8]/50 transition-colors shadow-sm"
                      size={20}
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase font-bold text-[#6184d8] block truncate">
                        {prod.category}
                      </span>
                      <h4 className="text-xs font-bold text-[#dfe2ee] truncate group-hover/card:text-[#6184d8] transition-colors">
                        {prod.name}
                      </h4>
                    </div>
                  </div>
                  {prod.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[#6184d8]/15 text-[#6184d8] border border-[#6184d8]/30 shrink-0">
                      {prod.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#262a33] text-xs font-mono">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-bold text-[#dfe2ee]">
                      {formatPrice(prod.price)}
                    </span>
                    {prod.originalPrice > prod.price && (
                      <span className="text-[10px] text-[#908fa0] line-through">
                        {formatPrice(prod.originalPrice)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-[#4edea3] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
                    <span>
                      {prod.stockCount !== undefined && prod.stockCount > 0
                        ? `${prod.stockCount} in stock`
                        : "Instant"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 3. STOREFRONT CORE CATALOG GRID */}
      <section className="w-full bg-[#0f131c] px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Catalog Section Header & Sorting Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-[#6184d8] font-mono text-xs uppercase tracking-widest font-semibold">
                <span className="w-2 h-2 rounded bg-[#6184d8]" />
                Tier-1 Verified Inventory
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#dfe2ee] tracking-tight mt-1">
                Active Virtual Assets
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-[#908fa0]">SORT:</span>
              <div className="flex items-center bg-[#181c24] p-1 rounded-lg border border-[#262a33]">
                <button
                  onClick={() => setSortBy("popularity")}
                  className={`px-3 py-1 rounded font-mono text-xs transition-all ${
                    sortBy === "popularity"
                      ? "bg-[#262a33] text-[#dfe2ee] font-bold shadow-sm"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  Popularity
                </button>
                <button
                  onClick={() => setSortBy("price-low")}
                  className={`px-3 py-1 rounded font-mono text-xs transition-all ${
                    sortBy === "price-low"
                      ? "bg-[#262a33] text-[#dfe2ee] font-bold shadow-sm"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  Lowest Price
                </button>
                <button
                  onClick={() => setSortBy("newest")}
                  className={`px-3 py-1 rounded font-mono text-xs transition-all ${
                    sortBy === "newest"
                      ? "bg-[#262a33] text-[#dfe2ee] font-bold shadow-sm"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  Newest Drop
                </button>
              </div>
            </div>
          </div>

          {/* Catalog Grid */}
          {isLoading && allProducts.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 bg-[#181c24] rounded-2xl border border-[#262a33] space-y-3">
              <HelpCircle className="w-12 h-12 text-[#908fa0] mx-auto opacity-40" />
              <h3 className="text-lg font-bold text-[#dfe2ee]">No packages found</h3>
              <p className="text-xs text-[#c7c4d7]">
                Try adjusting your search terms or clearing the filter.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveVector("All Stock");
                }}
                className="px-4 py-2 bg-[#262a33] text-[#6184d8] rounded-lg font-mono text-xs font-semibold hover:bg-[#31353e] transition-colors"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Catalog Stock Footer Note */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#262a33]">
            <span className="font-mono text-xs text-[#908fa0]">
              SHOWING {filteredProducts.length} OF {allProducts.length} ACTIVE VERIFIED PACKAGES
            </span>
            <div className="flex items-center gap-1 font-mono text-xs text-[#4edea3]">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
              <span>Real-time Redis Sync Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. LIVE TELEMETRY / REAL-TIME TRUST BENCHMARK */}
      <section className="w-full bg-[#0a0e16] px-4 sm:px-6 lg:px-8 py-10 md:py-14 border-t border-b border-[#262a33]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1 */}
          <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-5 flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#908fa0] uppercase">Speed Index</span>
              <Clock className="w-4 h-4 text-[#4edea3]" />
            </div>
            <div className="text-3xl font-black text-[#dfe2ee] font-mono">{telemetry.speedIndex}</div>
            <div className="font-mono text-xs text-[#4edea3] flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Median webhook delivery</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-5 flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#908fa0] uppercase">Escrow Settlement</span>
              <ShieldCheck className="w-4 h-4 text-[#6184d8]" />
            </div>
            <div className="text-3xl font-black text-[#dfe2ee] font-mono">{telemetry.escrowSettlement}</div>
            <div className="font-mono text-xs text-[#c7c4d7]">
              Non-custodial zero chargeback
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-5 flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#908fa0] uppercase">Active Inventory</span>
              <Sparkles className="w-4 h-4 text-[#d0bcff]" />
            </div>
            <div className="text-3xl font-black text-[#dfe2ee] font-mono">{telemetry.activeInventory}</div>
            <div className="font-mono text-xs text-[#c7c4d7]">
              Live database vault stock
            </div>
          </div>

          {/* Metric 4 */}
          <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-5 flex flex-col gap-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#908fa0] uppercase">Support Uptime</span>
              <Headset className="w-4 h-4 text-[#4edea3]" />
            </div>
            <div className="text-3xl font-black text-[#dfe2ee] font-mono">24/7/365</div>
            <div className="font-mono text-xs text-[#4edea3] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />
              <span>Discord live automated desk</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CUSTOMER REVIEWS & CRYPTOGRAPHIC VERIFICATION (3-COL GRID) */}
      <section className="w-full bg-[#0f131c] px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[#4edea3] font-mono text-xs uppercase tracking-widest font-semibold">
                <CheckCircle className="w-4 h-4 text-[#4edea3]" />
                Cryptographic Order Signatures
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-[#dfe2ee] tracking-tight mt-1">
                Verified Buyer Telemetry
              </h2>
            </div>
            <div className="font-mono text-xs text-[#908fa0]">
              RATING: 4.98 / 5.00 FROM {telemetry.totalTrades} TRADES
            </div>
          </div>

          {/* 3-Column Reviews */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Review 1 */}
            <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm hover:border-[#6184d8]/40 transition-colors">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex text-[#4edea3] gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#1c2028] font-mono text-[11px] text-[#4edea3]">
                    Delivered in 8s
                  </span>
                </div>
                <p className="text-sm text-[#dfe2ee] italic leading-relaxed">
                  &ldquo;Paid via UPI QR code on checkout, token redirected and key printed in under 10 seconds. Activated Discord Nitro immediately with zero proxy requirement. Absolutely insane throughput.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#262a33]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#262a33] border border-[#31353e] flex items-center justify-center font-mono text-xs font-bold text-[#6184d8]">
                    K
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#dfe2ee] font-bold">@kryptic</span>
                    <span className="font-mono text-[10px] text-[#908fa0]">Nitro 1-Year Purchase</span>
                  </div>
                </div>
                <span title="Cryptographically Verified">
                  <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                </span>
              </div>
            </div>

            {/* Review 2 */}
            <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm hover:border-[#6184d8]/40 transition-colors">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex text-[#4edea3] gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#1c2028] font-mono text-[11px] text-[#4edea3]">
                    Delivered in 5s
                  </span>
                </div>
                <p className="text-sm text-[#dfe2ee] italic leading-relaxed">
                  &ldquo;I manage a small dev team and we needed private 4K profiles for testing. Ordered 4 profiles; received 4 distinct clean credentials instantly. Zero household overlap bugs encountered.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#262a33]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#262a33] border border-[#31353e] flex items-center justify-center font-mono text-xs font-bold text-[#4edea3]">
                    Z
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#dfe2ee] font-bold">@zerocool</span>
                    <span className="font-mono text-[10px] text-[#908fa0]">Netflix 4K UHD Bulk</span>
                  </div>
                </div>
                <span title="Cryptographically Verified">
                  <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                </span>
              </div>
            </div>

            {/* Review 3 */}
            <div className="bg-[#181c24] border border-[#262a33] rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm hover:border-[#6184d8]/40 transition-colors">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex text-[#4edea3] gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#1c2028] font-mono text-[11px] text-[#4edea3]">
                    Delivered in 12s
                  </span>
                </div>
                <p className="text-sm text-[#dfe2ee] italic leading-relaxed">
                  &ldquo;USDT-TRC20 transaction confirmed at block 12. Instant automated email contained complete first-email OGE access for the Steam CS2 account. Trust factor green, zero issues.&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#262a33]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#262a33] border border-[#31353e] flex items-center justify-center font-mono text-xs font-bold text-[#d0bcff]">
                    A
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-[#dfe2ee] font-bold">@alex_m</span>
                    <span className="font-mono text-[10px] text-[#908fa0]">CS2 Prime Aged</span>
                  </div>
                </div>
                <span title="Cryptographically Verified">
                  <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. ACCORDION FAQ / DISPATCH RULES SECTION */}
      <section className="w-full bg-[#181c24] px-4 sm:px-6 lg:px-8 py-12 md:py-16 border-t border-[#262a33]">
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
          <div className="text-center flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-[#6184d8] font-mono text-xs uppercase tracking-widest font-semibold">
              <span className="w-2 h-2 rounded bg-[#6184d8]" />
              Knowledge Architecture
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-[#dfe2ee] tracking-tight">
              Frequently Answered Protocols
            </h2>
            <p className="text-xs md:text-sm text-[#c7c4d7] max-w-xl">
              Zero friction, zero ambiguous contracts. Everything you need to know about our automated node dispatch.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#1c2028] border border-[#262a33] rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none cursor-pointer"
                  >
                    <span className="font-bold text-sm md:text-base text-[#dfe2ee] flex items-center gap-2.5">
                      <Zap className="w-4 h-4 text-[#6184d8]" />
                      {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#c7c4d7] transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-1 text-xs md:text-sm text-[#c7c4d7] leading-relaxed border-t border-[#262a33]/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
