"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Sparkles, ShoppingCart, ArrowRight } from "lucide-react";
import { Product, searchProducts, CATEGORIES } from "@/lib/products";
import { ProductIcon } from "./ProductIcons";
import { useCart } from "@/lib/cart-context";
import { APP_CONFIG } from "@/lib/config";
import Link from "next/link";

interface SearchBarProps {
  onSearchChange?: (query: string, category: string) => void;
  className?: string;
  showDropdown?: boolean;
  products?: Product[];
}

export function SearchBar({
  onSearchChange,
  className = "",
  showDropdown = true,
  products: propProducts,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [results, setResults] = useState<Product[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<Product[]>(propProducts || []);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToCart } = useCart();

  // Keep catalog up to date with active unremoved products
  useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setActiveCatalog(propProducts);
      return;
    }

    let isMounted = true;
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (isMounted && data.products && Array.isArray(data.products)) {
          setActiveCatalog(data.products);
        }
      })
      .catch((e) => console.warn("Search catalog error:", e));

    return () => {
      isMounted = false;
    };
  }, [propProducts]);

  useEffect(() => {
    if (query.trim()) {
      const found = searchProducts(query, category, activeCatalog);
      setResults(found);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
    if (onSearchChange) {
      onSearchChange(query, category);
    }
  }, [query, category, activeCatalog, onSearchChange]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    if (onSearchChange) onSearchChange("", category);
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-2xl ${className}`}>
      {/* Search Input Container */}
      <div className="relative flex items-center rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-cyan-950/20 focus-within:border-cyan-500 dark:focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all overflow-hidden p-1.5">
        {/* Category Pill Dropdown */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl border-none outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              {cat}
            </option>
          ))}
        </select>

        {/* Input */}
        <div className="relative flex-1 flex items-center pl-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && setIsOpen(true)}
            placeholder="Search Netflix keys, Steam accounts, Discord Nitro, games..."
            className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Instant Search Results Dropdown */}
      {showDropdown && isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/10 shadow-2xl shadow-black/20 overflow-hidden max-h-[380px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Found {results.length} matching products</span>
            <span className="font-semibold text-cyan-500">Instant Delivery</span>
          </div>

          <div className="p-2 space-y-1">
            {results.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              >
                <Link
                  href={`/product/${product.id}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <ProductIcon
                    type={product.iconType}
                    className="w-10 h-10 shrink-0"
                    size={18}
                  />
                  <div className="truncate">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-cyan-500 truncate transition-colors">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                        {APP_CONFIG.currencySymbol}
                        {product.price}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                        {product.category}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2 pl-3">
                  <button
                    onClick={() => {
                      addToCart(product, 1);
                    }}
                    className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500 hover:text-white transition-all cursor-pointer"
                    title="Add to cart"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    href={`/product/${product.id}`}
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 text-center bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
            <Link
              href={`/products?search=${encodeURIComponent(query)}`}
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              View all results in product catalog &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
