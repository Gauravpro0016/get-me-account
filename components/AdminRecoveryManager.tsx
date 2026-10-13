"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Zap,
  Clock,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Tag,
  DollarSign,
  Users,
} from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

interface AbandonedOrder {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  paymentMethod?: string;
  createdAt: string;
  recoveryEmailSentAt?: string;
  recoveryEmailCount?: number;
}

interface RecoveryStats {
  count: number;
  totalPending: number;
  sentCount: number;
  recoverableRevenue: number;
}

export function AdminRecoveryManager({ adminPassword }: { adminPassword: string }) {
  const [orders, setOrders] = useState<AbandonedOrder[]>([]);
  const [stats, setStats] = useState<RecoveryStats>({
    count: 0,
    totalPending: 0,
    sentCount: 0,
    recoverableRevenue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [discountCode, setDiscountCode] = useState("RECOVER5");
  const [customNote, setCustomNote] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const fetchAbandonedOrders = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/recovery", {
        headers: { "x-admin-password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to fetch recovery data");
      const data = await res.json();
      setOrders(data.abandonedOrders || []);
      setStats({
        count: data.count || 0,
        totalPending: data.totalPending || 0,
        sentCount: data.sentCount || 0,
        recoverableRevenue: data.recoverableRevenue || 0,
      });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to load abandoned orders." });
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    fetchAbandonedOrders();
  }, [fetchAbandonedOrders]);

  const copyVal = (text: string, key: string) => {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }
  };

  const handleSendSingle = async (orderId: string) => {
    setSendingId(orderId);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          orderId,
          discountCode: discountCode.trim() || undefined,
          customNote: customNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      setStatusMsg({
        type: "success",
        text: `✅ Recovery reminder sent to order #${orderId}!`,
      });
      await fetchAbandonedOrders();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to send recovery email." });
    } finally {
      setSendingId(null);
    }
  };

  const handleSendAll = async () => {
    const unsentCount = orders.filter((o) => !o.recoveryEmailSentAt).length;
    if (unsentCount === 0) {
      alert("All eligible abandoned orders have already received a recovery reminder!");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to dispatch recovery emails to ${unsentCount} customers who abandoned their checkout?`
      )
    ) {
      return;
    }

    setSendingAll(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          sendAll: true,
          discountCode: discountCode.trim() || undefined,
          customNote: customNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk send failed");

      setStatusMsg({
        type: "success",
        text: data.message || `Dispatched ${data.sentCount} recovery emails!`,
      });
      await fetchAbandonedOrders();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to dispatch recovery emails." });
    } finally {
      setSendingAll(false);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const inrToUsdRate = APP_CONFIG.inrToUsdRate || 0.011;
  const unsentEligibleCount = orders.filter((o) => !o.recoveryEmailSentAt).length;

  return (
    <div className="space-y-6">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧲</span>
            <h2 className="text-lg font-bold text-[#dfe2ee] tracking-tight">
              Abandoned Checkout &amp; Payment Recovery
            </h2>
          </div>
          <p className="text-xs font-mono text-[#908fa0]">
            Automatically detects customers who initiated a checkout session but didn&apos;t complete payment within 15–48 hours.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchAbandonedOrders}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-mono text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleSendAll}
            disabled={sendingAll || unsentEligibleCount === 0}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-mono font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sendingAll ? "Dispatching…" : `Send All (${unsentEligibleCount})`}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-mono border flex items-center gap-2.5 ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Metric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
          <span className="text-[10px] text-[#908fa0] uppercase font-bold block flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#8083ff]" />
            Recoverable Orders
          </span>
          <span className="text-2xl font-black text-[#dfe2ee] block">
            {stats.count}
          </span>
          <span className="text-[11px] text-[#908fa0]">
            {unsentEligibleCount} unsent reminders
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
          <span className="text-[10px] text-[#908fa0] uppercase font-bold block flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Recoverable Revenue
          </span>
          <span className="text-2xl font-black text-emerald-400 block">
            ₹{stats.recoverableRevenue}
          </span>
          <span className="text-[11px] text-[#908fa0]">
            ~${(stats.recoverableRevenue * inrToUsdRate).toFixed(2)} USD in lost carts
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
          <span className="text-[10px] text-[#908fa0] uppercase font-bold block flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-sky-400" />
            Reminders Sent
          </span>
          <span className="text-2xl font-black text-sky-400 block">
            {stats.sentCount}
          </span>
          <span className="text-[11px] text-[#908fa0]">
            Dispatched via Gmail SMTP
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
          <span className="text-[10px] text-[#908fa0] uppercase font-bold block flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Recovery Perk
          </span>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="font-bold text-amber-300 text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              {discountCode || "None"}
            </span>
            <span className="text-[11px] text-[#908fa0]">5% Incentive</span>
          </div>
        </div>
      </div>

      {/* Recovery Campaign Configuration Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-[#262a33] pb-2">
          <span className="font-bold text-[#dfe2ee] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#8083ff]" />
            Recovery Email Campaign Settings
          </span>
          <span className="text-[11px] text-[#908fa0]">
            Included automatically in recovery template
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[#908fa0] font-bold uppercase mb-1">
              Incentive Discount Coupon Code
            </label>
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="e.g. RECOVER5"
              className="w-full px-3 py-2 bg-[#0a0e16] border border-[#262a33] rounded-lg text-amber-300 font-bold focus:outline-none focus:border-[#8083ff]"
            />
          </div>

          <div>
            <label className="block text-[11px] text-[#908fa0] font-bold uppercase mb-1">
              Custom Admin Note (Optional)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. We reserved your account for 2 hours only."
              className="w-full px-3 py-2 bg-[#0a0e16] border border-[#262a33] rounded-lg text-[#dfe2ee] focus:outline-none focus:border-[#8083ff]"
            />
          </div>
        </div>
      </div>

      {/* Abandoned Orders Table */}
      <div className="rounded-2xl bg-[#181c24] border border-[#262a33] overflow-hidden">
        <div className="p-4 border-b border-[#262a33] flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-[#dfe2ee]">
            Abandoned Sessions ({orders.length})
          </span>
          <span className="font-mono text-[11px] text-[#908fa0]">
            Orders older than 15 minutes
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[#908fa0] font-mono text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8083ff]" />
            <span>Scanning abandoned sessions…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-[#908fa0] font-mono text-xs space-y-2">
            <div className="text-3xl">🎉</div>
            <p className="font-bold text-[#dfe2ee]">No abandoned orders detected!</p>
            <p>All recent customers either completed their payments or haven&apos;t passed the 15-minute threshold.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0a0e16] border-b border-[#262a33] text-[#908fa0] font-mono font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer Email</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Abandoned</th>
                  <th className="py-3 px-4">Recovery Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262a33]/60 bg-[#181c24]/50 font-mono">
                {orders.map((ord) => {
                  const isSent = !!ord.recoveryEmailSentAt;
                  const isBusy = sendingId === ord.orderId;

                  return (
                    <tr key={ord.orderId} className="hover:bg-[#262a33]/30 transition-colors">
                      {/* Order ID */}
                      <td className="py-3.5 px-4 font-bold text-[#8083ff] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>#{ord.orderId}</span>
                          <button
                            type="button"
                            onClick={() => copyVal(ord.orderId, `rec-ord-${ord.orderId}`)}
                            className="p-1 rounded text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#262a33] cursor-pointer"
                          >
                            {copiedKey === `rec-ord-${ord.orderId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer Email */}
                      <td className="py-3.5 px-4 text-[#dfe2ee] max-w-[180px] truncate select-all">
                        {ord.email}
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-4 text-[#dfe2ee] max-w-[200px] truncate">
                        {ord.productName || "Digital Asset"} (x{ord.quantity || 1})
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-emerald-400">₹{ord.amount}</span>
                        <span className="text-[10px] text-[#908fa0] block">
                          ~${((Number(ord.amount) || 0) * inrToUsdRate).toFixed(2)}
                        </span>
                      </td>

                      {/* Time Ago */}
                      <td className="py-3.5 px-4 text-[#908fa0] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{formatTimeAgo(ord.createdAt)}</span>
                        </div>
                      </td>

                      {/* Recovery Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isSent ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              Sent ({ord.recoveryEmailCount || 1}x)
                            </span>
                            <span className="text-[10px] text-[#908fa0] block">
                              {formatTimeAgo(ord.recoveryEmailSentAt!)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            Ready for Recovery
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSendSingle(ord.orderId)}
                          disabled={isBusy}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-auto ${
                            isSent
                              ? "bg-[#262a33] hover:bg-[#31353e] text-[#908fa0] hover:text-[#dfe2ee]"
                              : "bg-[#8083ff]/20 hover:bg-[#8083ff]/30 text-[#8083ff] hover:text-white border border-[#8083ff]/40"
                          } disabled:opacity-50`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{isBusy ? "Sending…" : isSent ? "Resend Reminder" : "Send Reminder"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
