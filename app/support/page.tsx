"use client";

import React, { useEffect } from "react";
import { SupportSection } from "@/components/SupportSection";
import { APP_CONFIG } from "@/lib/config";
import { Headset, ExternalLink, ShieldCheck, Clock, Users } from "lucide-react";

export default function SupportPage() {
  const handleDiscordClick = () => {
    const link = APP_CONFIG.discordLink || "https://discord.com/invite/shwWe3uqY";
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-white py-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#5865F2]/10 text-[#5865F2] text-xs font-bold">
            <Headset className="w-3.5 h-3.5" />
            <span>24/7 TRINITYMART DISCORD HELPDESK</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
            Customer Support &amp; Community
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Get instant assistance, report key or account issues, or chat with our verified community on Discord.
          </p>
        </div>

        {/* Support Section with FAQs and Discord redirect */}
        <SupportSection />
      </div>
    </div>
  );
}
