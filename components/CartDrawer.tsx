"use client";

import React, { useState } from "react";
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  ShieldCheck,
  Zap,
  Tag,
  Headset,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { ProductIcon } from "./ProductIcons";
import { APP_CONFIG } from "@/lib/config";
import Link from "next/link";

export function CartDrawer() {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    subtotal,
    discount,
    promoCode,
    promoError,
    applyPromo,
    removePromo,
    openCheckoutWithCart,
  } = useCart();

  const [inputCode, setInputCode] = useState("");

  if (!isCartOpen) return null;

  const rawSubtotal = items.reduce(
    (acc, curr) => acc + curr.product.price * curr.quantity,
    0
  );

  const hasOutOfStockItems = items.some(
    (item) =>
      !item.product.inStock ||
      (item.product.stockCount !== undefined && item.product.stockCount <= 0)
  );

  const handleApplyPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      applyPromo(inputCode);
      setInputCode("");
    }
  };

  const handleSupportRedirect = () => {
    const link = APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY";
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-[#070c18] dark:bg-[#070c18] light:bg-white shadow-2xl flex flex-col border-l border-cyan-500/30 transition-transform duration-300 animate-in slide-in-from-right text-white dark:text-white light:text-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-cyan-500/20 bg-[#050811]/90">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight text-white dark:text-white light:text-slate-900">
                  Your Shopping Cart
                </h2>
                <p className="text-xs text-cyan-300/80 font-medium">
                  {totalItems} {totalItems === 1 ? "item" : "items"} selected
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ShoppingCart className="w-10 h-10 stroke-1" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white dark:text-white light:text-slate-900">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                    Add Netflix keys, Steam accounts, Discord Nitro, or game keys to get started.
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/30 hover:scale-105 transition-all cursor-pointer"
                >
                  Explore Products
                </button>
              </div>
            ) : (
              items.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0b1222] dark:bg-[#0b1222] light:bg-slate-50 border border-cyan-500/20 hover:border-cyan-400/50 transition-all group"
                >
                  <ProductIcon
                    type={product.iconType}
                    customLogoUrl={product.customLogoUrl}
                    logoSize={product.logoSize}
                    className="w-14 h-14 shrink-0"
                    size={22}
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${product.id}`}
                      onClick={() => setIsCartOpen(false)}
                      className="text-sm font-extrabold text-white dark:text-white light:text-slate-900 hover:text-cyan-400 truncate block transition-colors"
                    >
                      {product.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black text-cyan-400">
                        {APP_CONFIG.currencySymbol}
                        {product.price}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="text-xs text-slate-400 line-through">
                          {APP_CONFIG.currencySymbol}
                          {product.originalPrice}
                        </span>
                      )}
                      {(!product.inStock || (product.stockCount !== undefined && product.stockCount <= 0)) ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                          Instant Delivery
                        </span>
                      )}
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center rounded-lg border border-cyan-500/30 bg-[#050811] overflow-hidden">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-black text-white">
                          {quantity}
                        </span>
                        <button
                          disabled={
                            product.stockCount !== undefined &&
                            quantity >= product.stockCount
                          }
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Remove from cart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Area */}
          {items.length > 0 && (
            <div className="p-6 border-t border-cyan-500/20 bg-[#050811]/95 space-y-4">
              {/* Promo code field */}
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Coupon (e.g. TRINITY10)"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-[#0b1222] border border-cyan-500/30 text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 uppercase font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  Apply
                </button>
              </form>

              {promoError && (
                <p className="text-xs text-rose-400 font-bold">{promoError}</p>
              )}

              {promoCode && (
                <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  <span>Coupon &apos;{promoCode}&apos; Applied!</span>
                  <button
                    onClick={removePromo}
                    className="underline text-slate-400 hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Subtotal calculation */}
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-extrabold text-white">
                    {APP_CONFIG.currencySymbol}
                    {rawSubtotal}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount</span>
                    <span className="font-extrabold">
                      -{APP_CONFIG.currencySymbol}
                      {discount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    Instant Automated (Free)
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-white pt-2 border-t border-cyan-500/20">
                  <span>Total Amount</span>
                  <span className="text-cyan-400">
                    {APP_CONFIG.currencySymbol}
                    {subtotal}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  disabled={hasOutOfStockItems}
                  onClick={openCheckoutWithCart}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm shadow-xl transition-all ${
                    hasOutOfStockItems
                      ? "bg-slate-900/90 text-rose-400 border border-rose-500/40 cursor-not-allowed opacity-85"
                      : "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-black shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  }`}
                >
                  {hasOutOfStockItems ? (
                    <span>Remove Out-of-Stock Items to Checkout</span>
                  ) : (
                    <>
                      <span>Proceed to Instant Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>256-Bit SSL Encrypted</span>
                  </div>
                  <a
                    href={APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    <Headset className="w-3.5 h-3.5" />
                    <span>24/7 Discord Support</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
