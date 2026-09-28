"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import {
  ShoppingCart,
  Sun,
  Moon,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  Headset,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { useCart } from "@/lib/cart-context";
import { APP_CONFIG } from "@/lib/config";

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { totalItems, subtotal, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);

  // Safe GSAP animation and mount flag
  useEffect(() => {
    setMounted(true);
    const ctx = gsap.context(() => {
      if (logoRef.current) {
        gsap.from(logoRef.current, {
          scale: 0.9,
          duration: 0.6,
          ease: "back.out(1.7)",
        });
      }
    }, navRef);

    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);

    return () => {
      ctx.revert();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "All Products", href: "/products" },
    { name: "Hot Deals", href: "/#trending" },
    { name: "Reviews", href: "/#reviews" },
  ];

  const discordUrl = APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY";

  const handleSupportClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.open(discordUrl, "_blank", "noopener,noreferrer");
  };

  // Hide Navbar completely on admin routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <header
      ref={navRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#050811]/90 dark:bg-[#050811]/95 light:bg-white/95 backdrop-blur-xl border-b border-cyan-500/20 shadow-lg shadow-black/40 py-3"
          : "bg-[#050811]/70 dark:bg-[#050811]/80 light:bg-white/80 backdrop-blur-md border-b border-white/5 py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo: Trinitymart */}
          <Link
            ref={logoRef}
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer select-none"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 p-[1.5px] shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-400/50 transition-all">
              <div className="w-full h-full bg-[#050811] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white dark:text-white light:text-slate-900 font-sans">
                  Trinity
                </span>
                <span className="text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  mart
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-400/90 -mt-1 hidden sm:block">
                Digital Marketplace
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 dark:bg-[#0b1222]/90 light:bg-slate-100 border border-cyan-500/20 dark:border-white/10 shadow-inner">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-4 py-1.5 text-xs sm:text-sm font-bold rounded-full transition-all duration-200 ${
                    isActive
                      ? "text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/25"
                      : "text-slate-300 dark:text-slate-200 light:text-slate-700 hover:text-white dark:hover:text-white hover:bg-white/10"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}

            {/* Support link that redirects to Discord server */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-full text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all cursor-pointer group"
              title="Join 24/7 Discord Support Server"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Support</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a>
          </nav>

          {/* Right Action Icons (Cart, Theme, Discord, Hamburger) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Prominent Cart Trigger Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              aria-label="View Shopping Cart"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <div className="relative">
                <ShoppingCart className="w-4 h-4" />
                {mounted && totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="hidden xs:inline">Cart</span>
              {mounted && totalItems > 0 && (
                <span className="text-[11px] bg-black/30 px-1.5 py-0.5 rounded-md text-cyan-200">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle Dark and Light Mode"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 dark:bg-white/5 light:bg-slate-200 border border-cyan-500/20 dark:border-white/10 text-white dark:text-white light:text-slate-900 hover:border-cyan-400 transition-all cursor-pointer"
              title="Toggle theme"
            >
              {mounted && theme === "light" ? (
                <Moon className="w-4 h-4 text-cyan-500 hover:-rotate-12 transition-transform" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              )}
            </button>

            {/* Discord CTA on large screens */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2] text-white border border-[#5865F2]/40 hover:border-transparent transition-all cursor-pointer"
            >
              <Headset className="w-3.5 h-3.5 text-cyan-300" />
              <span>Discord</span>
            </a>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="md:hidden p-2 rounded-xl text-white dark:text-white light:text-slate-900 bg-slate-900/80 dark:bg-white/5 border border-cyan-500/20 transition-all cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[65px] bg-[#050811]/98 dark:bg-[#050811]/98 light:bg-white/98 backdrop-blur-2xl border-b border-cyan-500/20 shadow-2xl px-6 py-6 transition-all duration-300">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  pathname === link.href
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/40"
                    : "text-slate-200 dark:text-slate-200 light:text-slate-800 hover:bg-white/5"
                }`}
              >
                <span>{link.name}</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
              </Link>
            ))}

            {/* Mobile Cart Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setIsCartOpen(true);
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <span>Open Cart</span>
              </div>
              <span className="bg-black/30 px-2 py-0.5 rounded-full text-xs">
                {mounted ? totalItems : 0} items ({APP_CONFIG.currencySymbol}{mounted ? subtotal : 0})
              </span>
            </button>

            {/* Mobile Support Link redirecting to Discord */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#5865F2]/20 border border-[#5865F2]/40 text-cyan-300 text-sm font-bold"
            >
              <div className="flex items-center gap-2.5">
                <Headset className="w-5 h-5 text-white" />
                <span>24/7 Discord Support</span>
              </div>
              <ExternalLink className="w-4 h-4 text-white" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
