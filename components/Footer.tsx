import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Headset,
  ShieldCheck,
  Zap,
  Lock,
  Heart,
  ExternalLink,
} from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070b13] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-[1.5px]">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                Trinity<span className="text-cyan-500">mart</span>
              </span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              India&apos;s premier automated marketplace for Netflix keys, Steam accounts, Discord Nitro, PC game codes, and software licenses. Instant automated delivery guaranteed.
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-500" />
                <span>Instant Delivery</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Full Warranty</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Secure UPI</span>
              </span>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Categories
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/products?category=Streaming" className="hover:text-cyan-500 transition-colors">
                  Netflix &amp; Streaming Keys
                </Link>
              </li>
              <li>
                <Link href="/products?category=Gaming" className="hover:text-cyan-500 transition-colors">
                  Steam IDs &amp; PC Games
                </Link>
              </li>
              <li>
                <Link href="/products?category=Discord" className="hover:text-cyan-500 transition-colors">
                  Discord Nitro &amp; Boosters
                </Link>
              </li>
              <li>
                <Link href="/products?category=Software%20%26%20Keys" className="hover:text-cyan-500 transition-colors">
                  Windows 11 &amp; VPN Keys
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular Products */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Hot Picks
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <Link href="/product/netflix-premium-key" className="hover:text-cyan-500 transition-colors">
                  Netflix 4K UHD Key
                </Link>
              </li>
              <li>
                <Link href="/product/steam-id-pass" className="hover:text-cyan-500 transition-colors">
                  Steam CS2 Prime Account
                </Link>
              </li>
              <li>
                <Link href="/product/discord-nitro-booster" className="hover:text-cyan-500 transition-colors">
                  Discord Nitro + 2 Boosts
                </Link>
              </li>
              <li>
                <Link href="/product/minecraft-java-bedrock" className="hover:text-cyan-500 transition-colors">
                  Minecraft Java &amp; Bedrock
                </Link>
              </li>
            </ul>
          </div>

          {/* Support & Community */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              24/7 Support
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Have questions or need warranty replacement? Reach us on Discord anytime.
            </p>
            <a
              href={APP_CONFIG.discordLink || "/discord"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold transition-all shadow-md shadow-[#5865F2]/20"
            >
              <Headset className="w-3.5 h-3.5" />
              <span>Join Discord Support</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-500">
          <p>© {new Date().getFullYear()} Trinitymart. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Built with precision for gamers &amp; creators</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
