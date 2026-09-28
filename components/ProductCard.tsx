"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Star, ShoppingCart, Zap, Check, ArrowRight, Eye, AlertCircle } from "lucide-react";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { ProductIcon } from "./ProductIcons";
import { APP_CONFIG } from "@/lib/config";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const { addToCart, openCheckoutWithProduct, setIsCartOpen } = useCart();
  const [added, setAdded] = useState(false);

  const isOutOfStock =
    !product.inStock ||
    (product.stockCount !== undefined && product.stockCount <= 0);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    openCheckoutWithProduct(product);
  };

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  return (
    <div
      className={`group relative flex flex-col rounded-3xl bg-[#0a1120] dark:bg-[#0a1120] light:bg-white border border-cyan-500/20 dark:border-cyan-500/20 light:border-slate-200 overflow-hidden shadow-lg shadow-black/40 hover:shadow-2xl hover:shadow-cyan-500/20 hover:border-cyan-400/60 transition-all duration-300 ${
        featured ? "ring-1 ring-cyan-400/40" : ""
      }`}
    >
      {/* Top Banner & Visual */}
      <div
        className={`relative h-44 w-full p-5 flex flex-col justify-between overflow-hidden ${
          !product.customBgUrl
            ? `bg-gradient-to-br ${product.bannerGradient || "from-blue-600/25 via-cyan-950/40 to-zinc-900"}`
            : "bg-slate-900"
        }`}
        style={
          product.customBgUrl
            ? {
                backgroundImage: `url(${product.customBgUrl})`,
                backgroundSize: product.bgSize || "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      >
        {/* Subtle dark gradient overlay if custom background image exists to guarantee high-contrast readability */}
        {product.customBgUrl && (
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1120] via-black/40 to-black/30 pointer-events-none" />
        )}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />

        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#050811]/70 text-cyan-300 backdrop-blur-md border border-cyan-500/30">
            {product.category}
          </span>
          {product.badge && (
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wide shadow-md ${
                product.badge === "Best Seller"
                  ? "bg-amber-400 text-black shadow-amber-500/40"
                  : product.badge === "Hot Deal"
                  ? "bg-rose-500 text-white shadow-rose-500/40"
                  : "bg-cyan-400 text-black shadow-cyan-400/40"
              }`}
            >
              {product.badge}
            </span>
          )}
        </div>

        {/* Product Visual Icon & Stock */}
        <div className="relative z-10 flex items-end justify-between mt-auto">
          <ProductIcon
            type={product.iconType}
            customLogoUrl={product.customLogoUrl}
            logoSize={product.logoSize}
            className="w-16 h-16 transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300"
            size={30}
          />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#050811]/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Instant Delivery</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Rating & Database Stock Units */}
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
              </div>
              <span className="text-xs font-black text-white dark:text-white light:text-slate-900">
                {product.reviewsCount > 0 ? product.rating : "5.0"}
              </span>
              <span className="text-xs text-slate-400">
                ({product.reviewsCount} {product.reviewsCount === 1 ? "review" : "reviews"})
              </span>
            </div>

            {/* Live Database Stock Units */}
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border tracking-wide uppercase ${
                !isOutOfStock
                  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                  : "text-rose-400 bg-rose-500/10 border-rose-500/30"
              }`}
            >
              {!isOutOfStock
                ? `${product.stockCount} in stock`
                : "Out of Stock"}
            </span>
          </div>

          {/* Product Name - High Contrast White Font */}
          <Link
            href={`/product/${product.id}`}
            className="text-base font-extrabold text-white dark:text-white light:text-slate-900 group-hover:text-cyan-400 line-clamp-2 transition-colors font-sans"
          >
            {product.name}
          </Link>

          {/* Short description */}
          <p className="text-xs text-slate-300 dark:text-slate-300 light:text-slate-600 line-clamp-2 mt-1.5 leading-relaxed font-medium">
            {product.shortDescription}
          </p>
        </div>

        {/* Features Preview */}
        <div className="space-y-1.5 pt-1">
          {product.features.slice(0, 2).map((feat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-slate-200 dark:text-slate-200 light:text-slate-700 font-medium"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">{feat}</span>
            </div>
          ))}
        </div>

        {/* Pricing & CTA */}
        <div className="pt-3 border-t border-cyan-500/20 dark:border-white/10 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white dark:text-white light:text-slate-900">
                  {APP_CONFIG.currencySymbol}
                  {product.price}
                </span>
                {product.originalPrice > product.price && (
                  <span className="text-xs text-slate-400 line-through">
                    {APP_CONFIG.currencySymbol}
                    {product.originalPrice}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                100% Replacement Warranty
              </span>
            </div>

            {discountPercent > 0 && (
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                SAVE {discountPercent}%
              </span>
            )}
          </div>

          {/* Action Buttons: If out of stock, block Buy Now and Add to Cart with disabled UI */}
          {isOutOfStock ? (
            <div className="pt-1">
              <button
                type="button"
                disabled
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900/80 dark:bg-white/5 border border-rose-500/40 text-rose-400 text-xs font-black cursor-not-allowed opacity-85 select-none shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Out of Stock (Restocking Soon)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleAddToCart}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md ${
                  added
                    ? "bg-emerald-500 text-white shadow-emerald-500/30"
                    : "bg-[#0f1a30] hover:bg-[#18284c] text-white border border-cyan-400/40 hover:border-cyan-400 shadow-cyan-900/20 hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Added!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Add to Cart</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Buy Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
