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
import { useCurrency } from "@/lib/currency-context";
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
    totalItems,
    subtotal,
    discount,
    promoCode,
    promoError,
    applyPromo,
    removePromo,
    openCheckoutWithCart,
  } = useCart();
  const { currency, formatPrice } = useCurrency();

  const [inputCode, setInputCode] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  if (!isCartOpen) return null;

  const validItems = items.filter((item) => item && item.product && item.product.id);

  const rawSubtotal = validItems.reduce(
    (acc, curr) => acc + (curr.product.price || 0) * (curr.quantity || 1),
    0
  );

  const hasOutOfStockItems = validItems.some(
    (item) =>
      !item.product.inStock ||
      (item.product.stockCount !== undefined && item.product.stockCount <= 0)
  );

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      setIsApplyingPromo(true);
      await applyPromo(inputCode);
      setIsApplyingPromo(false);
      setInputCode("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-[#0f131c] shadow-2xl flex flex-col border-l border-[#262a33] transition-transform duration-300 animate-in slide-in-from-right text-[#dfe2ee]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#262a33] bg-[#0a0e16]/95">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#262a33] text-[#8083ff] border border-[#31353e]">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-[#dfe2ee]">
                  Your Virtual Cart
                </h2>
                <p className="font-mono text-xs text-[#4edea3]">
                  {totalItems} {totalItems === 1 ? "item" : "items"} reserved
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 rounded-xl text-[#908fa0] hover:text-white hover:bg-[#1c2028] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {validItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-full bg-[#1c2028] border border-[#262a33] flex items-center justify-center text-[#908fa0]">
                  <ShoppingCart className="w-10 h-10 stroke-1" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#dfe2ee]">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-[#908fa0] mt-1 max-w-[260px] leading-relaxed">
                    Select any virtual assets, subscriptions, or gaming keys to initiate instant dispatch.
                  </p>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#8083ff] text-[#0d0096] font-bold text-xs hover:bg-[#6366f1] hover:text-white transition-all cursor-pointer"
                >
                  Explore Storefront
                </button>
              </div>
            ) : (
              validItems.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#181c24] border border-[#262a33] hover:border-[#8083ff]/40 transition-all group"
                >
                  <ProductIcon
                    type={product.iconType}
                    customLogoUrl={product.customLogoUrl}
                    logoSize={product.logoSize}
                    className="w-12 h-12 shrink-0"
                    size={22}
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${product.id}`}
                      onClick={() => setIsCartOpen(false)}
                      className="text-sm font-bold text-[#dfe2ee] hover:text-[#8083ff] truncate block transition-colors"
                    >
                      {product.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-sm font-bold text-[#dfe2ee]">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="font-mono text-xs text-[#908fa0] line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                      {!product.inStock || (product.stockCount !== undefined && product.stockCount <= 0) ? (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/30">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#00a572]/20 text-[#4edea3] border border-[#00a572]/30">
                          Instant Auto-Dispatch
                        </span>
                      )}
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center rounded-lg border border-[#262a33] bg-[#0a0e16] overflow-hidden">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="px-2 py-1 text-[#c7c4d7] hover:text-white hover:bg-[#1c2028] transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 font-mono text-xs font-bold text-white">
                          {quantity}
                        </span>
                        <button
                          disabled={
                            product.stockCount !== undefined &&
                            quantity >= product.stockCount
                          }
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="px-2 py-1 text-[#c7c4d7] hover:text-white hover:bg-[#1c2028] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="flex items-center gap-1 text-[11px] font-mono text-[#908fa0] hover:text-[#ffb4ab] px-2 py-1 rounded-lg transition-colors cursor-pointer"
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
          {validItems.length > 0 && (
            <div className="p-6 border-t border-[#262a33] bg-[#0a0e16]/95 space-y-4">
              {/* Promo code field */}
              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#908fa0]" />
                  <input
                    type="text"
                    placeholder="PROMO / COUPON CODE"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[#181c24] border border-[#262a33] text-[#dfe2ee] placeholder:text-[#908fa0] focus:outline-none focus:border-[#8083ff] uppercase font-mono font-bold"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isApplyingPromo || !inputCode.trim()}
                  className="px-4 py-2 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] font-mono text-xs font-bold transition-all cursor-pointer border border-[#31353e] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplyingPromo ? "Checking..." : "Apply"}
                </button>
              </form>

              {promoError && (
                <p className="font-mono text-xs text-[#ffb4ab]">{promoError}</p>
              )}

              {promoCode && (
                <div className="flex items-center justify-between font-mono text-xs py-1 px-2.5 rounded bg-[#00a572]/20 text-[#4edea3] border border-[#00a572]/30">
                  <span>PROMO &apos;{promoCode}&apos; APPLIED!</span>
                  <button
                    onClick={removePromo}
                    className="underline text-[#908fa0] hover:text-[#ffb4ab] cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Subtotal calculation */}
              <div className="space-y-1.5 font-mono text-xs text-[#c7c4d7]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#dfe2ee]">
                    {formatPrice(rawSubtotal)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#4edea3]">
                    <span>Discount</span>
                    <span className="font-bold">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Dispatch Fee</span>
                  <span className="text-[#4edea3] font-semibold">FREE</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#dfe2ee] pt-2 border-t border-[#262a33]">
                  <span>Total Payable</span>
                  <span className="text-[#8083ff] text-base">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  disabled={hasOutOfStockItems}
                  onClick={openCheckoutWithCart}
                  className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    hasOutOfStockItems
                      ? "bg-[#262a33] text-[#ffb4ab] border border-[#ffb4ab]/30 cursor-not-allowed opacity-80"
                      : "bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white shadow-lg hover:shadow-[0_0_16px_rgba(128,131,255,0.4)]"
                  }`}
                >
                  {hasOutOfStockItems ? (
                    <span>Remove Out-of-Stock Items</span>
                  ) : (
                    <>
                      <span>Proceed to Instant Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between font-mono text-[10px] text-[#908fa0] px-1 pt-1">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                    <span>256-Bit SSL Encrypted</span>
                  </div>
                  <a
                    href={APP_CONFIG.discordLink || "/discord"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#8083ff] hover:underline"
                  >
                    <Headset className="w-3.5 h-3.5" />
                    <span>Discord Support</span>
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

export default CartDrawer;
