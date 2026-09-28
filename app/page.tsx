"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Headset,
  Lock,
  ArrowRight,
  Search,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
} from "lucide-react";
import {
  getClientInitialProducts,
  getAllProducts,
  Product,
  CATEGORIES,
  ACTIVE_PRODUCTS_CACHE_KEY,
  REMOVED_IDS_CACHE_KEY,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { ProductListScrollBar } from "@/components/ProductListScrollBar";
import { SearchBar } from "@/components/SearchBar";
import { ProductReviews } from "@/components/ProductReviews";
import { SupportSection } from "@/components/SupportSection";
import { APP_CONFIG } from "@/lib/config";

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [sortBy, setSortBy] = useState<string>("featured");
  const [allProducts, setAllProducts] = useState<Product[]>(getClientInitialProducts);

  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // Fetch updated custom products from server API
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
        console.warn("Could not fetch latest products, using default catalog:", e);
      }
    }
    fetchProducts();
  }, []);

  const featuredProducts = allProducts.filter(
    (p) => p.badge === "Best Seller" || p.badge === "Trending" || p.badge === "Hot Deal"
  );

  // GSAP Hero entrance animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(headlineRef.current, {
        y: 25,
        opacity: 0.2,
        duration: 0.7,
      })
        .from(
          subheadRef.current,
          {
            y: 15,
            opacity: 0.3,
            duration: 0.5,
          },
          "-=0.4"
        )
        .from(
          heroCtaRef.current,
          {
            y: 15,
            opacity: 0.4,
            duration: 0.5,
          },
          "-=0.3"
        );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Filter & Sort Logic
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      selectedCategory === "All" ||
      product.category.toLowerCase() === selectedCategory.toLowerCase();

    const cleanQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !cleanQuery ||
      product.name.toLowerCase().includes(cleanQuery) ||
      product.shortDescription.toLowerCase().includes(cleanQuery) ||
      product.tags.some((t) => t.toLowerCase().includes(cleanQuery));

    return matchesCategory && matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    if (sortBy === "rating") return b.rating - a.rating;
    return b.reviewsCount - a.reviewsCount;
  });

  const handleSupportClick = () => {
    const link = APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY";
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#050811] dark:bg-[#050811] light:bg-[#f1f5f9] text-white dark:text-white light:text-slate-900 transition-colors duration-300">
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative pt-10 pb-16 md:pt-16 md:pb-20 overflow-hidden border-b border-cyan-500/20"
      >
        {/* Ambient bluish-black background glows */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-to-tr from-cyan-500/15 via-blue-600/15 to-indigo-600/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-xs font-black tracking-wide shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin [animation-duration:6s]" />
            <span>INSTANT AUTOMATED DELIVERY • 100% REPLACEMENT WARRANTY</span>
          </div>

          {/* Main Headline */}
          <h1
            ref={headlineRef}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white dark:text-white light:text-slate-900 max-w-5xl mx-auto leading-[1.1] font-sans"
          >
            Buy{" "}
            <span className="bg-gradient-to-r from-red-400 via-rose-500 to-amber-400 bg-clip-text text-transparent">
              Netflix Keys
            </span>
            ,{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Steam ID Pass
            </span>
            , &amp;{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Discord Nitro
            </span>
          </h1>

          {/* Subheading */}
          <p
            ref={subheadRef}
            className="text-sm sm:text-base md:text-lg text-slate-300 dark:text-slate-300 light:text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            India&apos;s premier digital keys and accounts marketplace. Instant automated UPI delivery within 10 seconds, verified genuine products, full warranty coverage, and 24/7 Discord support.
          </p>

          {/* Live Search Bar in Hero */}
          <div className="pt-2 pb-2 flex justify-center">
            <SearchBar
              products={allProducts}
              onSearchChange={(q, c) => {
                setSearchQuery(q);
                if (c && c !== "All") setSelectedCategory(c);
              }}
            />
          </div>

          {/* Hero Action Buttons */}
          <div
            ref={heroCtaRef}
            className="flex flex-wrap items-center justify-center gap-3 pt-2"
          >
            <Link
              href="/products"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-105 active:scale-95 transition-all"
            >
              <span>Explore All Products</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href={APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-[#0b1222] border border-cyan-500/30 hover:border-cyan-400 text-white font-extrabold text-sm shadow-lg shadow-black/40 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Headset className="w-4 h-4 text-cyan-400" />
              <span>Join Discord Support</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-60" />
            </a>
          </div>

          {/* Stats Bar */}
          <div
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-cyan-500/20"
          >
            <div className="p-4 rounded-2xl bg-[#0a1120] border border-cyan-500/20 backdrop-blur-md shadow-md">
              <span className="block text-2xl sm:text-3xl font-black text-cyan-400">
                10,000+
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Digital Keys Delivered
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a1120] border border-cyan-500/20 backdrop-blur-md shadow-md">
              <span className="block text-2xl sm:text-3xl font-black text-emerald-400">
                &lt; 10 Sec
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Automated UPI Delivery
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a1120] border border-cyan-500/20 backdrop-blur-md shadow-md">
              <span className="block text-2xl sm:text-3xl font-black text-amber-400">
                4.9 / 5.0
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Buyer Satisfaction
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#0a1120] border border-cyan-500/20 backdrop-blur-md shadow-md">
              <span className="block text-2xl sm:text-3xl font-black text-blue-400">
                24/7 Live
              </span>
              <span className="text-xs text-slate-300 font-semibold">
                Discord Staff Support
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Product List Scroll Bar Section (Trending Picks) */}
      <section id="trending" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProductListScrollBar
          products={featuredProducts.length > 0 ? featuredProducts : allProducts.slice(0, 5)}
          title="Trending Hot Picks & Best Sellers"
          subtitle="Top customer favorites with instant automated delivery, 4K streaming, and original access"
        />
      </section>

      {/* Full Catalog Grid with Filter & Category Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
                <Layers className="w-4 h-4" />
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400">
                Trinitymart Store
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white dark:text-white light:text-slate-900 tracking-tight">
              All Available Keys &amp; Accounts
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 dark:text-slate-300 light:text-slate-600 mt-1">
              Select a category or sort by price to discover the perfect deal.
            </p>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-xs text-slate-300 font-bold">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#0b1222] border border-cyan-500/30 text-xs font-bold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="featured" className="bg-[#050811] text-white">
                Popular &amp; Best Selling
              </option>
              <option value="price-low" className="bg-[#050811] text-white">
                Price: Low to High
              </option>
              <option value="price-high" className="bg-[#050811] text-white">
                Price: High to Low
              </option>
              <option value="rating" className="bg-[#050811] text-white">
                Highest Rated
              </option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/30 border border-cyan-400/40"
                  : "bg-[#0a1120] border border-cyan-500/20 text-slate-300 hover:text-white hover:bg-[#111c33]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {sortedProducts.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-[#0a1120] border border-cyan-500/20 space-y-3">
            <p className="text-base font-extrabold text-white">
              No products found matching &ldquo;{searchQuery}&rdquo; in {selectedCategory}.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-black"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Why Choose Trinitymart Feature Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-cyan-500/20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-black mb-2 border border-cyan-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Guaranteed Security &amp; Speed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Why Gamers Trust Trinitymart
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Built from the ground up for seamless, automated digital delivery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl bg-[#0a1120] border border-cyan-500/20 shadow-xl space-y-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 w-fit border border-cyan-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">
              Instant Automated UPI Delivery
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              No manual waiting. Keys and account credentials appear on your screen and email within 10 seconds of payment.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#0a1120] border border-cyan-500/20 shadow-xl space-y-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">
              100% Replacement Warranty
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Every key and account comes with warranty coverage. Encounter any issue? Get an instant replacement on Discord.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#0a1120] border border-cyan-500/20 shadow-xl space-y-3">
            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 w-fit border border-indigo-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">
              256-Bit Encrypted Payments
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Pay securely via official UPI apps (GPay, PhonePe, Paytm, BHIM) with zero hidden fees and instant verification.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#0a1120] border border-cyan-500/20 shadow-xl space-y-3">
            <div className="p-3 rounded-2xl bg-[#5865F2]/20 text-cyan-300 w-fit border border-[#5865F2]/40">
              <Headset className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-base font-black text-white">
              24/7 Live Discord Helpdesk
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Real human support agents available around the clock. Average response time on our Discord server is under 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      <ProductReviews />

      {/* Support Section with Discord Redirection */}
      <SupportSection />
    </div>
  );
}
