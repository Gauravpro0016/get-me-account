"use client";

import React, { useState } from "react";
import {
  Headset,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  ChevronDown,
  Clock,
  Users,
  CheckCircle2,
} from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

const FAQS = [
  {
    q: "How does the instant automated delivery work?",
    a: "Immediately upon completing payment via UPI QR code or gateway, your digital activation keys or account credentials (login, password, access info) are automatically displayed on your screen and dispatched to your email within 5 to 15 seconds.",
  },
  {
    q: "What is the warranty policy if a key or account doesn't work?",
    a: "Every product sold on Trinitymart is covered under our 100% Replacement Warranty. If you encounter any issue, simply open a ticket on our Discord server with your order ID, and our staff will provide a fresh replacement or instant resolution.",
  },
  {
    q: "Can I change the email and password of Steam & Game accounts?",
    a: "Yes! Accounts marked as 'Full Access' (such as our Steam CS2 Prime ID and Game Accounts) come with original mail access allowing you to bind your own personal email, phone number, and password permanently.",
  },
  {
    q: "What payment methods are supported on Trinitymart?",
    a: "We support all major Indian UPI apps including Google Pay, PhonePe, Paytm, BHIM, CRED, and mobile banking. Payments are verified automatically in real-time.",
  },
  {
    q: "How can I contact staff if I need custom assistance?",
    a: "Our primary support channel is our official 24/7 Discord server. Click any Support button on Trinitymart to join, go to the #create-ticket channel, and an admin will assist you within minutes.",
  },
];

export function SupportSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleDiscordRedirect = () => {
    window.open(APP_CONFIG.discordLink, "_blank", "noopener,noreferrer");
  };

  return (
    <section id="support" className="py-14 relative">
      <div className="max-w-6xl mx-auto px-4">
        {/* Support Banner / Discord CTA Card */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#5865F2] via-[#4752C4] to-[#2B3172] p-8 sm:p-12 text-white shadow-2xl shadow-[#5865F2]/25 mb-14">
          {/* Ambient circles */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>24/7 LIVE SUPPORT COMMUNITY</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Need Help or Have a Question?
              </h2>

              <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-xl">
                Our support team and gaming community are active around the clock on Discord.
                Get instant ticket resolution, replacement assistance, order tracking, and member-exclusive giveaways.
              </p>

              {/* Stats pills */}
              <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
                  <Clock className="w-4 h-4 mx-auto text-cyan-300 mb-1" />
                  <span className="block text-base font-extrabold">&lt; 5 Mins</span>
                  <span className="text-[10px] text-white/80">Avg Response</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
                  <Users className="w-4 h-4 mx-auto text-emerald-300 mb-1" />
                  <span className="block text-base font-extrabold">1,500+</span>
                  <span className="text-[10px] text-white/80">Active Members</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
                  <CheckCircle2 className="w-4 h-4 mx-auto text-amber-300 mb-1" />
                  <span className="block text-base font-extrabold">99.9%</span>
                  <span className="text-[10px] text-white/80">Solved Tickets</span>
                </div>
              </div>

              {/* Main Discord Action Button */}
              <div className="pt-4 flex flex-wrap gap-4 items-center">
                <button
                  onClick={handleDiscordRedirect}
                  className="flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-[#5865F2] hover:bg-slate-100 font-extrabold text-sm sm:text-base shadow-xl shadow-black/20 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
                >
                  <Headset className="w-5 h-5 text-[#5865F2] group-hover:rotate-12 transition-transform" />
                  <span>Join Trinitymart Discord Server</span>
                  <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>

            {/* Right illustration / feature preview */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ticket System Guarantee</span>
                </div>
                <p className="text-xs text-white/80">
                  Dedicated private ticket channels for order verification and credentials replacement.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                  <Zap className="w-4 h-4" />
                  <span>Automated Stock Drops</span>
                </div>
                <p className="text-xs text-white/80">
                  Be the first to know when new Netflix, Steam, and Discord Nitro batches are restocked.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="space-y-4">
          <div className="text-center max-w-xl mx-auto mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold mb-2">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Got Questions?</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl bg-[#0a1120] dark:bg-[#0a1120] light:bg-white border border-cyan-500/20 overflow-hidden transition-all shadow-md"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm sm:text-base text-white dark:text-white light:text-slate-900 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-cyan-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-300 dark:text-slate-300 light:text-slate-600 leading-relaxed border-t border-cyan-500/15 pt-3 animate-in fade-in font-medium">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
