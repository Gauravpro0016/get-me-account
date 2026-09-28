"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { APP_CONFIG } from "@/lib/config";

export function FloatingCartButton() {
  const pathname = usePathname();
  const { totalItems, subtotal, setIsCartOpen, isCartOpen, isCheckoutOpen } =
    useCart();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Return null if not mounted yet or on admin routes, or cart/checkout is already open
  if (!mounted || pathname?.startsWith("/admin") || isCartOpen || isCheckoutOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-5">
      <button
        onClick={() => setIsCartOpen(true)}
        className="group flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-black text-sm shadow-2xl shadow-cyan-500/40 hover:shadow-cyan-400/60 hover:scale-105 active:scale-95 transition-all border border-cyan-300/30 cursor-pointer"
        aria-label="Open Cart"
      >
        <div className="relative">
          <ShoppingCart className="w-5 h-5 text-white group-hover:rotate-6 transition-transform" />
          {totalItems > 0 && (
            <span className="absolute -top-2.5 -right-2.5 min-w-[20px] h-[20px] px-1 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center animate-bounce shadow-md">
              {totalItems}
            </span>
          )}
        </div>

        <div className="flex flex-col text-left">
          <span className="text-xs uppercase tracking-wider font-extrabold text-cyan-200 leading-none">
            {totalItems > 0 ? `${totalItems} Items` : "View Cart"}
          </span>
          <span className="text-sm font-black text-white leading-tight">
            {APP_CONFIG.currencySymbol}
            {subtotal}
          </span>
        </div>

        <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>
    </div>
  );
}
