"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Flame } from "lucide-react";
import { Product } from "@/lib/products";
import { ProductCard } from "./ProductCard";

interface ProductListScrollBarProps {
  products: Product[];
  title?: string;
  subtitle?: string;
}

export function ProductListScrollBar({
  products,
  title = "Trending Digital Keys & Hot Picks",
  subtitle = "Handpicked best sellers with instant automated delivery and full warranty",
}: ProductListScrollBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const offset = direction === "left" ? -340 : 340;
      scrollContainerRef.current.scrollBy({
        left: offset,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative py-8">
      {/* Header with Title and Scroll Arrows */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-500">
              <Flame className="w-4 h-4 fill-amber-500" />
            </span>
            <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-500">
              Hot Deals
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            {subtitle}
          </p>
        </div>

        {/* Scroll navigation buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll Left"
            className="p-2.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-cyan-500 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll Right"
            className="p-2.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-cyan-500 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Container with Custom Scrollbar */}
      <div
        ref={scrollContainerRef}
        className="flex gap-5 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scroll-smooth scrollbar-custom [scrollbar-gutter:stable]"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[280px] sm:w-[320px] shrink-0 snap-start"
          >
            <ProductCard product={product} featured={product.badge === "Best Seller"} />
          </div>
        ))}
      </div>
    </section>
  );
}
