"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Layers,
  Filter,
  SlidersHorizontal,
  Sparkles,
  ArrowUpDown,
  CheckCircle2,
} from "lucide-react";
import {
  getClientInitialProducts,
  getAllProducts,
  CATEGORIES,
  Product,
  ACTIVE_PRODUCTS_CACHE_KEY,
  REMOVED_IDS_CACHE_KEY,
} from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { SearchBar } from "@/components/SearchBar";
import { ProductListScrollBar } from "@/components/ProductListScrollBar";
import { ProductsCatalogSkeleton } from "@/components/Skeleton";

function ProductsContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "All";
  const initialQuery = searchParams.get("search") || "";

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [sortBy, setSortBy] = useState<string>("featured");
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [allProducts, setAllProducts] = useState<Product[]>(getClientInitialProducts);

  // Fetch live products including any added by admin
  useEffect(() => {
    async function fetchLiveProducts() {
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
        console.warn("Could not fetch latest products catalog:", e);
      }
    }
    fetchLiveProducts();
  }, []);

  const filtered = useMemo(() => {
    return allProducts.filter((product) => {
      const matchesCat =
        selectedCategory === "All" ||
        product.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.shortDescription.toLowerCase().includes(q) ||
        product.tags.some((t) => t.toLowerCase().includes(q));

      const matchesStock =
        !inStockOnly ||
        (product.inStock &&
          (product.stockCount === undefined || product.stockCount > 0));

      return matchesCat && matchesQuery && matchesStock;
    });
  }, [allProducts, selectedCategory, searchQuery, inStockOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "price-low") return a.price - b.price;
      if (sortBy === "price-high") return b.price - a.price;
      if (sortBy === "rating") return b.rating - a.rating;
      return b.reviewsCount - a.reviewsCount;
    });
  }, [filtered, sortBy]);

  return (
    <div className="min-h-screen bg-[#0f131c] text-[#dfe2ee] py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#1c2028] text-[#8083ff] border border-[#262a33] font-mono text-xs font-bold shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GENUINE DIGITAL LICENSES &amp; ACCOUNTS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#dfe2ee]">
            Digital Keys &amp; Accounts Store
          </h1>
          <p className="text-xs sm:text-sm text-[#c7c4d7] font-medium">
            Browse our full catalog of Netflix keys, Steam accounts, Discord Nitro, Xbox Game Pass, and software keys with instant automated delivery.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-xl">
          <SearchBar
            className="flex-1 max-w-xl"
            products={allProducts}
            onSearchChange={(q, c) => {
              setSearchQuery(q);
              if (c && c !== "All") setSelectedCategory(c);
            }}
          />

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* In stock toggle */}
            <label className="flex items-center gap-2 font-mono text-xs font-semibold text-[#dfe2ee] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#8083ff] focus:ring-[#8083ff] accent-[#8083ff]"
              />
              <span>In Stock Only</span>
            </label>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#8083ff]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-[#0a0e16] border border-[#262a33] text-xs font-bold text-[#dfe2ee] focus:outline-none focus:border-[#8083ff] cursor-pointer"
              >
                <option value="featured" className="bg-[#0f131c] text-[#dfe2ee]">
                  Popular &amp; Best Selling
                </option>
                <option value="price-low" className="bg-[#0f131c] text-[#dfe2ee]">
                  Price: Low to High
                </option>
                <option value="price-high" className="bg-[#0f131c] text-[#dfe2ee]">
                  Price: High to Low
                </option>
                <option value="rating" className="bg-[#0f131c] text-[#dfe2ee]">
                  Highest Rated
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl font-mono text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#8083ff] text-[#0d0096] shadow-sm"
                  : "bg-[#181c24] text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33] border border-[#262a33]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-300 px-1">
          <span>
            Showing <strong className="text-white font-extrabold">{sorted.length}</strong> products
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Instant Automated UPI Fulfillment
          </span>
        </div>

        {/* Products Grid */}
        {sorted.length === 0 ? (
          <div className="text-center py-20 p-8 rounded-3xl bg-[#0a1120] border border-cyan-500/20 space-y-3">
            <p className="text-base font-extrabold text-white">
              No products found matching your search.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setInStockOnly(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-black cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sorted.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Scroll Bar Showcase at bottom */}
        <div className="pt-8">
          <ProductListScrollBar
            products={allProducts.slice(0, 6)}
            title="Recommended For You"
            subtitle="Verified authentic digital keys popular with other buyers"
          />
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsCatalogSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
