"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Terminal,
  Save,
  Bell,
} from "lucide-react";

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled?: boolean;
  notifyOnSale?: boolean;
  notifyOnLowStock?: boolean;
  notifyOnEmailError?: boolean;
  lowStockThreshold?: number;
}

export function AdminBotManager({ adminPassword }: { adminPassword: string }) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [notifyOnSale, setNotifyOnSale] = useState(true);
  const [notifyOnLowStock, setNotifyOnLowStock] = useState(true);
  const [notifyOnEmailError, setNotifyOnEmailError] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(3);
  const [discordConfigured, setDiscordConfigured] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBotSettings = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/bot/settings", {
        headers: { "x-admin-password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to load bot settings");
      const data = await res.json();
      const tg: TelegramConfig = data.telegram || {};
      setBotToken(tg.botToken || "");
      setChatId(tg.chatId || "");
      setEnabled(tg.enabled ?? true);
      setNotifyOnSale(tg.notifyOnSale ?? true);
      setNotifyOnLowStock(tg.notifyOnLowStock ?? true);
      setNotifyOnEmailError(tg.notifyOnEmailError ?? true);
      setLowStockThreshold(tg.lowStockThreshold ?? 3);
      setDiscordConfigured(Boolean(data.discordWebhookConfigured));
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to load settings." });
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    fetchBotSettings();
  }, [fetchBotSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/bot/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          botToken: botToken.trim(),
          chatId: chatId.trim(),
          enabled,
          notifyOnSale,
          notifyOnLowStock,
          notifyOnEmailError,
          lowStockThreshold: Number(lowStockThreshold) || 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setFeedback({ type: "success", text: "✅ Bot & Alert settings saved successfully!" });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (testType: "telegram" | "discord" | "low_stock") => {
    setTestingType(testType);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/bot/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ test: testType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test dispatch failed");
      setFeedback({ type: "success", text: `✅ ${data.message || "Test notification dispatched!"}` });
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Test dispatch failed." });
    } finally {
      setTestingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold text-[#dfe2ee] tracking-tight">
              Discord &amp; Telegram Bot Center
            </h2>
          </div>
          <p className="text-xs font-mono text-[#908fa0]">
            Get live alerts on Telegram &amp; Discord whenever items are purchased, stock is depleted, or an email fails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchBotSettings}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-mono text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-mono border flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Quick Test Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[#262a33] pb-2">
          <span className="font-bold text-[#dfe2ee] flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-[#8083ff]" />
            Live Alert Test Triggers
          </span>
          <span className="text-[11px] text-[#908fa0]">
            Verify your channel endpoints in 1 click
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleTest("discord")}
            disabled={testingType !== null}
            className="px-3.5 py-2 rounded-xl bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#8083ff] border border-[#5865F2]/40 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{testingType === "discord" ? "Sending…" : "Test Discord Purchase Alert"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTest("telegram")}
            disabled={testingType !== null || !botToken || !chatId}
            className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testingType === "telegram" ? "Sending…" : "Test Telegram Message"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTest("low_stock")}
            disabled={testingType !== null}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{testingType === "low_stock" ? "Sending…" : "Test Low Stock Warning"}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Telegram Configuration */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-5 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#262a33] pb-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-sm text-[#dfe2ee]">Telegram Bot Setup</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-[#0a0e16] border-[#262a33] text-[#8083ff] focus:ring-0"
              />
              <span className="text-xs text-[#dfe2ee] font-bold">Enabled</span>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-[#908fa0] uppercase">
                  Telegram Bot Token
                </label>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#8083ff] hover:underline flex items-center gap-0.5"
                >
                  <span>Create via @BotFather</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="e.g. 1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="w-full px-3 py-2.5 bg-[#0a0e16] border border-[#262a33] rounded-xl text-[#dfe2ee] placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-[#908fa0] uppercase">
                  Admin Telegram Chat ID
                </label>
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#8083ff] hover:underline flex items-center gap-0.5"
                >
                  <span>Get ID via @userinfobot</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 1928381920 or -1001928381920"
                className="w-full px-3 py-2.5 bg-[#0a0e16] border border-[#262a33] rounded-xl text-[#dfe2ee] placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#908fa0] uppercase block mb-1">
                Low Stock Warning Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-[#0a0e16] border border-[#262a33] rounded-xl text-amber-300 font-bold focus:outline-none focus:border-[#8083ff]"
                />
                <span className="text-[#908fa0] text-[11px]">
                  Alerts will trigger when product stock falls &le; this number
                </span>
              </div>
            </div>

            {/* Notification Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-[#262a33]">
              <span className="text-[10px] uppercase font-bold text-[#908fa0] block">
                Trigger Notifications On:
              </span>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0a0e16] border border-[#262a33]/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnSale}
                  onChange={(e) => setNotifyOnSale(e.target.checked)}
                  className="w-4 h-4 rounded text-[#8083ff] focus:ring-0"
                />
                <span className="text-[#dfe2ee]">
                  💰 <b>New Purchase &amp; Order Fulfillment</b>
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0a0e16] border border-[#262a33]/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnLowStock}
                  onChange={(e) => setNotifyOnLowStock(e.target.checked)}
                  className="w-4 h-4 rounded text-[#8083ff] focus:ring-0"
                />
                <span className="text-[#dfe2ee]">
                  ⚠️ <b>Low Inventory &amp; Out-of-Stock Warnings</b>
                </span>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0a0e16] border border-[#262a33]/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnEmailError}
                  onChange={(e) => setNotifyOnEmailError(e.target.checked)}
                  className="w-4 h-4 rounded text-[#8083ff] focus:ring-0"
                />
                <span className="text-[#dfe2ee]">
                  🚨 <b>Customer SMTP Email Delivery Failures</b>
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#8083ff] to-[#6366f1] hover:from-[#6d70ff] hover:to-[#5558e6] text-[#0d0096] hover:text-white font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-[#8083ff]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving…" : "Save Bot Configuration"}</span>
          </button>
        </div>

        {/* Right Column: Discord Webhook Status & Bot Commands Guide */}
        <div className="space-y-6">
          {/* Discord Status Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#262a33] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#8083ff]" />
                <h3 className="font-bold text-sm text-[#dfe2ee]">Discord Webhook Status</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  discordConfigured
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {discordConfigured ? "Connected" : "Check .env.local"}
              </span>
            </div>

            <p className="text-[#908fa0] leading-relaxed">
              Configured via <code className="text-[#8083ff]">DISCORD_SALES_WEBHOOK_URL</code> and{" "}
              <code className="text-[#8083ff]">DISCORD_RESTOCK_WEBHOOK_URL</code> in your <code className="text-[#dfe2ee]">.env.local</code>.
            </p>

            <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33] space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#908fa0] block">
                Active Features:
              </span>
              <p className="text-emerald-400 text-[11px]">
                ✓ Instant rich embed announcements on paid orders (#vouches/orders)
              </p>
              <p className="text-emerald-400 text-[11px]">
                ✓ Low stock warnings to merchant team
              </p>
              <p className="text-emerald-400 text-[11px]">
                ✓ SMTP delivery bounce / failure alerts
              </p>
            </div>
          </div>

          {/* Telegram Bot Commands Cheatsheet */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#262a33] pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-[#dfe2ee]">Telegram Bot Slash Commands</h3>
              </div>
              <span className="text-[10px] text-[#4edea3] font-bold">Live Remote Control</span>
            </div>

            <p className="text-[#908fa0]">
              You can message your Telegram bot directly to inspect or manage your store from anywhere:
            </p>

            <div className="space-y-2 pt-1">
              <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-[#262a33] flex items-center justify-between">
                <div>
                  <span className="text-sky-400 font-bold">/stock</span>
                  <span className="text-[#908fa0] block text-[11px]">Check inventory remaining for all products</span>
                </div>
                <span className="text-[10px] text-[#8083ff] bg-[#8083ff]/10 px-2 py-0.5 rounded">Inventory</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-[#262a33] flex items-center justify-between">
                <div>
                  <span className="text-emerald-400 font-bold">/orders</span>
                  <span className="text-[#908fa0] block text-[11px]">Today&apos;s revenue &amp; recent buyer list</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Sales</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-[#262a33] flex items-center justify-between">
                <div>
                  <span className="text-amber-400 font-bold">/pending</span>
                  <span className="text-[#908fa0] block text-[11px]">View pending customer checkout sessions</span>
                </div>
                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Queue</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-[#262a33] flex items-center justify-between">
                <div>
                  <span className="text-[#8083ff] font-bold">/fulfill &lt;orderId&gt;</span>
                  <span className="text-[#908fa0] block text-[11px]">Manually assign stock &amp; email credentials to buyer</span>
                </div>
                <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">Action</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
