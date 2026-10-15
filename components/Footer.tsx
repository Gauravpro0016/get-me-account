"use client";

import React from "react";
import Link from "next/link";
import { Lock, Zap, ShieldCheck, MessageSquare, Send, Terminal } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export function Footer() {
  const discordUrl = APP_CONFIG.discordLink || "/discord";

  return (
    <footer className="w-full bg-[#0a0e16] border-t border-[#262a33] py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Security Pillars & Support Quick Links */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 border-b border-[#262a33]">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-[#4edea3]">
              <Lock className="w-4 h-4 text-[#4edea3]" />
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">
                256-Bit Encrypted
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#4edea3]">
              <Zap className="w-4 h-4 text-[#4edea3]" />
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">
                Instant Auto-Delivery
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#4edea3]">
              <ShieldCheck className="w-4 h-4 text-[#4edea3]" />
              <span className="font-mono text-xs uppercase tracking-wider font-semibold">
                Zero KYC Required
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-xs text-[#c7c4d7] hover:text-[#6184d8] transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#6184d8]" />
              <span>Discord Support</span>
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-xs text-[#c7c4d7] hover:text-[#6184d8] transition-colors"
            >
              <Send className="w-4 h-4 text-[#4edea3]" />
              <span>Telegram Desk</span>
            </a>
            <Link
              href="/orders/lookup"
              className="flex items-center gap-1.5 font-mono text-xs text-[#c7c4d7] hover:text-[#6184d8] transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-[#6184d8]" />
              <span>Track Order</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 font-mono text-xs text-[#908fa0] hover:text-[#dfe2ee] transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>
          </div>
        </div>

        {/* Accepted Channels & Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-[#908fa0]">ACCEPTED CHANNELS:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {["UPI", "USDT", "BTC", "LTC", "ETH", "SOL"].map((channel) => (
                <span
                  key={channel}
                  className="px-2.5 py-0.5 rounded bg-[#1c2028] border border-[#262a33] font-mono text-[11px] text-[#dfe2ee]"
                >
                  {channel}
                </span>
              ))}
            </div>
          </div>

          <p className="font-mono text-xs text-[#908fa0]">
            © {new Date().getFullYear()} Trinitymart Platform Inc. High-velocity virtual dispatch system.
          </p>
        </div>
      </div>
    </footer>
  );
}
