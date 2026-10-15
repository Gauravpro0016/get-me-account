"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, ShoppingBag, Terminal, ExternalLink, Menu, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
import { APP_CONFIG } from "@/lib/config";

export function Navbar() {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen, openCheckoutWithCart, items } = useCart();
  const { currency, setCurrency } = useCurrency();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hide Navbar completely on admin routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const handleInstantCheckout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (items.length > 0) {
      openCheckoutWithCart();
    } else {
      setIsCartOpen(true);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0e16]/90 backdrop-blur-xl border-b border-[#262a33] transition-all">
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Telemetry Indicator */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer select-none">
            <div className="w-9 h-9 rounded-lg bg-[#262a33] border border-[#464554] flex items-center justify-center group-hover:border-[#6184d8] group-hover:shadow-[0_0_12px_rgba(99,102,241,0.35)] transition-all">
              <Zap className="w-5 h-5 text-[#6184d8] fill-[#6184d8]" />
            </div>
            <span className="text-xl tracking-tight text-[#dfe2ee] font-black">
              Trinity<span className="text-[#6184d8]">mart</span>
            </span>
          </Link>

          {/* Automated Dispatch Active Badge */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded bg-[#1c2028] border border-[#262a33]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]" />
            </span>
            <span className="font-mono text-[10px] text-[#4edea3] uppercase tracking-wider font-semibold">
              Automated Dispatch Active
            </span>
          </div>
        </div>

        {/* Center Nav Pill */}
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-lg bg-[#181c24] border border-[#262a33]">
          <Link
            href="/"
            className={`px-3.5 py-1.5 rounded transition-all text-xs font-semibold ${
              pathname === "/"
                ? "bg-[#262a33] text-[#dfe2ee] border border-[#31353e] shadow-sm"
                : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#1c2028]"
            }`}
          >
            Storefront
          </Link>
          <Link
            href="/orders/lookup"
            className={`px-3.5 py-1.5 rounded transition-all text-xs font-semibold ${
              pathname?.startsWith("/orders/lookup")
                ? "bg-[#262a33] text-[#dfe2ee] border border-[#31353e] shadow-sm"
                : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#1c2028]"
            }`}
          >
            Track Order
          </Link>
          <button
            onClick={handleInstantCheckout}
            className="px-3.5 py-1.5 rounded text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#1c2028] transition-all text-xs font-semibold cursor-pointer"
          >
            Instant Checkout
          </button>
          <Link
            href="/admin"
            className="px-3.5 py-1.5 rounded text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#1c2028] transition-all text-xs font-semibold"
          >
            Admin: Stock Manager
          </Link>
        </nav>

        {/* Right Action Icons & Badges */}
        <div className="flex items-center gap-2.5">
          {/* Currency Switcher */}
          <div className="flex items-center bg-[#181c24] border border-[#262a33] rounded p-0.5">
            <button
              onClick={() => setCurrency("INR")}
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-all ${
                currency === "INR"
                  ? "bg-[#262a33] text-[#dfe2ee] font-bold shadow-sm"
                  : "text-[#908fa0] hover:text-[#dfe2ee]"
              }`}
            >
              INR ₹
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-2 py-0.5 rounded font-mono text-[10px] transition-all ${
                currency === "USD"
                  ? "bg-[#262a33] text-[#dfe2ee] font-bold shadow-sm"
                  : "text-[#908fa0] hover:text-[#dfe2ee]"
              }`}
            >
              USD $
            </button>
          </div>

          {/* Cart Trigger Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="View Shopping Cart"
            className="relative flex items-center gap-1.5 h-8 px-3 rounded bg-[#181c24] border border-[#262a33] text-[#dfe2ee] hover:border-[#6184d8]/60 hover:bg-[#1c2028] transition-all cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-[#c7c4d7]" />
            {totalItems > 0 && (
              <span className="font-mono text-[10px] font-bold bg-[#6184d8] text-white px-1.5 py-0.2 rounded-full">
                {totalItems}
              </span>
            )}
          </button>

          {/* Admin Terminal Link */}
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded bg-[#1c2028] border border-[#31353e] font-mono text-[11px] text-[#6184d8] hover:border-[#6184d8] hover:bg-[#262a33] transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded bg-[#181c24] border border-[#262a33] text-[#dfe2ee]"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0f131c] border-b border-[#262a33] px-4 py-4 space-y-2 animate-in fade-in">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg bg-[#181c24] text-sm font-semibold text-[#dfe2ee]"
          >
            Storefront
          </Link>
          <Link
            href="/orders/lookup"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg bg-[#181c24] text-sm font-semibold text-[#dfe2ee]"
          >
            Track Order
          </Link>
          <button
            onClick={(e) => {
              setMobileMenuOpen(false);
              handleInstantCheckout(e);
            }}
            className="w-full text-left block px-3 py-2 rounded-lg bg-[#181c24] text-sm font-semibold text-[#dfe2ee]"
          >
            Instant Checkout
          </button>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg bg-[#181c24] text-sm font-semibold text-[#c7c4d7]"
          >
            Admin: Stock Manager
          </Link>
        </div>
      )}
    </header>
  );
}
