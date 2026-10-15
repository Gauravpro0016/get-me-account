"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { APP_CONFIG } from "@/lib/config";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { totalItems, subtotal, openCheckoutWithCart, setIsCartOpen, isCartOpen, isCheckoutOpen } = useCart();
  const { currency, formatPrice } = useCurrency();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || pathname?.startsWith("/admin") || isCartOpen || isCheckoutOpen) return null;
  if (totalItems === 0) return null;

  const usdValue = (subtotal * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2);
  const formattedPrimary = currency === "USD" ? `$${usdValue}` : `₹${subtotal}`;
  const formattedSecondary = currency === "USD" ? `₹${subtotal}` : `$${usdValue}`;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-5">
      <div 
        onClick={() => setIsCartOpen(true)}
        className="flex items-center gap-3 bg-[#0a0e16]/95 backdrop-blur-xl p-2 pl-3.5 rounded-xl border border-[#262a33] shadow-2xl shadow-black/80 hover:border-[#6184d8]/60 transition-all cursor-pointer group"
        title="Click to view cart"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] text-[#c7c4d7] group-hover:text-[#8083ff] uppercase tracking-wide transition-colors">
              Active Cart:
            </span>
            <span className="font-mono text-xs text-[#dfe2ee] font-bold">
              {totalItems} {totalItems === 1 ? "item" : "items"} ({formattedPrimary})
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCartOpen(true);
          }}
          className="h-8.5 px-3 rounded-lg bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] hover:text-white font-mono text-xs font-semibold transition-all border border-[#31353e] flex items-center gap-1.5 cursor-pointer"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-[#8083ff]" />
          <span>Cart</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCheckoutWithCart();
          }}
          className="h-8.5 px-3.5 rounded-lg bg-[#6184d8] text-white hover:bg-[#4d6ec4] font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span>Checkout</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
