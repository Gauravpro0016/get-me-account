"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  ShoppingCart,
  Check,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Plus,
  Minus,
} from "lucide-react";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { ProductIcon } from "./ProductIcons";
import { APP_CONFIG } from "@/lib/config";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const { addToCart, openCheckoutWithProduct } = useCart();
  const { currency, formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const isOutOfStock =
    !product.inStock ||
    (product.stockCount !== undefined && product.stockCount <= 0);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleInstantBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    openCheckoutWithProduct(product, quantity);
  };

  const discountPercent =
    product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0;

  const usdPrice = (
    product.price * (APP_CONFIG.inrToUsdRate || 0.0118)
  ).toFixed(2);

  return (
    <div
      className={`product-card flex flex-col justify-between bg-[#181c24] rounded-xl p-5 hover:bg-[#1c2028] border border-[#262a33] hover:border-[#8083ff]/40 transition-all duration-300 shadow-md group ${
        featured ? "ring-1 ring-[#8083ff]/40" : ""
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Card Header: Visual Emblem + Stock State */}
        <div className="flex items-start justify-between gap-3">
          <ProductIcon
            type={product.iconType}
            customLogoUrl={product.customLogoUrl}
            logoSize={product.logoSize}
            className="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-xl border border-[#262a33] group-hover:border-[#8083ff]/60 group-hover:shadow-[0_0_15px_rgba(128,131,255,0.25)] transition-all shadow-md"
            size={28}
          />

          <div className="flex flex-col items-end gap-1">
            <span
              className={`px-2 py-0.5 rounded font-mono text-[11px] flex items-center gap-1.5 font-semibold ${
                !isOutOfStock
                  ? "bg-[#00a572]/20 text-[#4edea3]"
                  : "bg-[#93000a]/20 text-[#ffb4ab]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !isOutOfStock ? "bg-[#4edea3]" : "bg-[#ffb4ab]"
                }`}
              />
              {!isOutOfStock ? `${product.stockCount} in stock` : "Sold out"}
            </span>
            <span className="font-mono text-[10px] text-[#908fa0] uppercase tracking-wider">
              {product.tags?.[0] || product.category || "GLOBAL"}
            </span>
          </div>
        </div>

        {/* Title & Service Type */}
        <div>
          <div className="font-mono text-[11px] text-[#8083ff] uppercase tracking-wide font-medium">
            {product.deliveryType || "Instant Activation Link"}
          </div>
          <Link
            href={`/product/${product.id}`}
            className="block mt-0.5 font-bold text-lg text-[#dfe2ee] group-hover:text-[#8083ff] transition-colors line-clamp-1"
          >
            {product.name}
          </Link>
          <p className="text-xs text-[#c7c4d7] mt-1 line-clamp-2 leading-relaxed">
            {product.shortDescription}
          </p>
        </div>

        {/* Guarantee Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#262a33] text-[#c7c4d7] font-mono text-[10px] flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#4edea3]" />
            {product.warranty || "Replacement SLA"}
          </span>
          <span className="px-2 py-0.5 rounded bg-[#262a33] text-[#c7c4d7] font-mono text-[10px] flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#8083ff]" />
            Instant Delivery
          </span>
        </div>

        {/* Tech Parameters Grid */}
        <div className="grid grid-cols-2 gap-2 bg-[#0a0e16] p-2.5 rounded-lg font-mono text-[11px]">
          <div className="flex flex-col">
            <span className="text-[#908fa0] text-[10px]">DELIVERY</span>
            <span className="text-[#dfe2ee] font-semibold truncate">Automated / Email</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[#908fa0] text-[10px]">WARRANTY</span>
            <span className="text-[#dfe2ee] font-semibold truncate">100% Replacement</span>
          </div>
        </div>
      </div>

      {/* Card Footer: Pricing, Stepper & Primary Actions */}
      <div className="flex flex-col gap-3.5 mt-5 pt-4 bg-[#262a33]/40 -mx-5 -mb-5 p-5 rounded-b-xl border-t border-[#262a33]">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xl font-extrabold text-[#dfe2ee] font-mono">
              {currency === "USD" ? `$${usdPrice}` : `₹${product.price}`}
            </span>
            <span className="font-mono text-xs text-[#908fa0] ml-1.5">
              {currency === "USD" ? `/ ₹${product.price}` : `/ $${usdPrice}`}
            </span>
          </div>
          {discountPercent > 0 ? (
            <span className="font-mono text-[11px] text-[#4edea3] bg-[#1c2028] px-2 py-0.5 rounded font-bold border border-[#00a572]/30">
              -{discountPercent}% RETAIL
            </span>
          ) : (
            <span className="font-mono text-[11px] text-[#4edea3] bg-[#1c2028] px-2 py-0.5 rounded font-bold">
              BESTSELLER
            </span>
          )}
        </div>

        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="w-full h-10 rounded-lg bg-[#262a33] border border-[#ffb4ab]/30 text-[#ffb4ab] font-mono text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
          >
            <AlertCircle className="w-4 h-4" />
            <span>Restocking Soon</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {/* Inline Quantity Stepper */}
            <div className="flex items-center bg-[#0a0e16] rounded-lg p-0.5 border border-[#262a33]">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-8 rounded flex items-center justify-center text-[#c7c4d7] hover:text-white hover:bg-[#1c2028] transition-colors cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center font-mono text-xs text-[#dfe2ee] font-bold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(product.stockCount || 50, q + 1))}
                className="w-7 h-8 rounded flex items-center justify-center text-[#c7c4d7] hover:text-white hover:bg-[#1c2028] transition-colors cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Cart Button */}
            <button
              type="button"
              onClick={handleAddToCart}
              className={`h-9 px-3 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                added
                  ? "bg-[#00a572] text-white"
                  : "bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] border border-[#464554]"
              }`}
              title="Add to cart"
              aria-label="Add to cart"
            >
              {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
            </button>

            {/* Instant Buy CTA */}
            <button
              type="button"
              onClick={handleInstantBuy}
              className="flex-1 h-9 rounded-lg bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shadow-md hover:shadow-[0_0_12px_rgba(128,131,255,0.4)] cursor-pointer"
            >
              <span>Instant Buy</span>
              <Zap className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
