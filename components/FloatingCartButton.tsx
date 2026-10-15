"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { APP_CONFIG } from "@/lib/config";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { totalItems, subtotal, openCheckoutWithCart, isCartOpen, isCheckoutOpen } = useCart();
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
      <div className="flex items-center gap-3.5 bg-[#0a0e16]/95 backdrop-blur-xl p-2 pl-4 rounded-xl border border-[#262a33] shadow-2xl shadow-black/80 hover:border-[#6184d8]/50 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="font-mono text-[10px] text-[#c7c4d7] uppercase tracking-wide">
              Active Cart:
            </span>
            <span className="font-mono text-xs text-[#dfe2ee] font-bold">
              {totalItems} {totalItems === 1 ? "item" : "items"} ({formattedPrimary} / {formattedSecondary})
            </span>
          </div>
        </div>

        <button
          onClick={openCheckoutWithCart}
          className="h-9 px-4 rounded-lg bg-[#6184d8] text-white hover:bg-[#4d6ec4] font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span>Checkout</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
