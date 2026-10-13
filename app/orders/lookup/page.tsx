"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Download,
  Mail,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

type OrderItem = {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  productId?: string;
  productName?: string;
  cartItems?: Array<{ productId: string; productName?: string; quantity: number; price?: number }>;
  status: "pending" | "confirmed" | "failed" | "expired";
  createdAt: string;
  confirmedAt?: string;
  utr?: string;
  paymentMethod?: string;
  deliveredCredentials?: Array<{
    email: string;
    emailPassword?: string;
    discordPassword?: string;
    password?: string;
    token?: string;
    domain?: string;
    twoFactorKey?: string;
    keyweb?: string;
  }>;
  emailStatus?: "pending" | "sent" | "opened" | "failed";
  emailSentAt?: string;
  emailOpened?: boolean;
};

function OrderLookupContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("query") || searchParams.get("orderId") || searchParams.get("email") || "";

  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [order, setOrder] = useState<OrderItem | null>(null);
  const [ordersList, setOrdersList] = useState<OrderItem[]>([]);
  const [copiedKey, setCopiedKey] = useState("");
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const performSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) {
      setErrorMsg("Please enter an Order ID or Email address.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setOrder(null);
    setOrdersList([]);
    setResendFeedback(null);

    try {
      const res = await fetch(`/api/orders/lookup?query=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Order not found. Please verify the ID or email entered.");
        return;
      }

      if (data.type === "email") {
        if (data.orders.length === 0) {
          setErrorMsg(`No orders found associated with ${q}.`);
        } else if (data.orders.length === 1) {
          setOrder(data.orders[0]);
        } else {
          setOrdersList(data.orders);
        }
      } else if (data.type === "order") {
        setOrder(data.order);
      }
    } catch {
      setErrorMsg("Network error while looking up order. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(inputQuery);
  };

  const copyText = (text: string, key: string) => {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDownloadCredentials = (ord: OrderItem) => {
    const creds = ord.deliveredCredentials || [];
    if (creds.length === 0) return;

    let content = `=========================================\n`;
    content += `TRINITYMART ORDER #${ord.orderId}\n`;
    content += `Product: ${ord.productName || "Digital Asset"}\n`;
    content += `Date: ${new Date(ord.createdAt).toLocaleString()}\n`;
    content += `Amount: ₹${ord.amount}\n`;
    content += `Customer: ${ord.email}\n`;
    content += `=========================================\n\n`;

    creds.forEach((c, idx) => {
      content += `--- ACCOUNT #${idx + 1} ---\n`;
      content += `Email / Username: ${c.email}\n`;
      const pass = c.password || c.emailPassword || c.discordPassword;
      if (pass) content += `Password: ${pass}\n`;
      if (c.emailPassword && c.discordPassword) {
        content += `Email Password: ${c.emailPassword}\n`;
        content += `Discord Password: ${c.discordPassword}\n`;
      }
      if (c.domain) content += `Domain / Webmail: ${c.domain}\n`;
      if (c.token) content += `License Token: ${c.token}\n`;
      if (c.twoFactorKey) content += `2FA Key: ${c.twoFactorKey}\n`;
      if (c.keyweb) content += `Webmail URL: ${c.keyweb}\n`;
      content += `\n`;
    });

    content += `Need assistance? Join our 24/7 Discord: ${APP_CONFIG.discordLink || "https://discord.gg/trinitymart"}\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trinitymart_order_${ord.orderId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResendCredentials = async (ord: OrderItem) => {
    setResendingEmail(true);
    setResendFeedback(null);
    try {
      const res = await fetch("/api/orders/lookup/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: ord.orderId, email: ord.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResendFeedback({ type: "error", text: data.error || "Failed to resend credentials." });
      } else {
        setResendFeedback({ type: "success", text: data.message || "Credentials resent successfully!" });
      }
    } catch {
      setResendFeedback({ type: "error", text: "Network error. Please try again later." });
    } finally {
      setResendingEmail(false);
    }
  };

  const discordUrl = APP_CONFIG.discordLink || "https://discord.gg/trinitymart";

  return (
    <div className="min-h-screen bg-[#0a0e16] text-[#dfe2ee] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono font-medium text-[#908fa0] hover:text-[#dfe2ee] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-[#4edea3]">
            <ShieldCheck className="w-4 h-4" />
            <span>256-Bit Encrypted Portal</span>
          </div>
        </div>

        {/* Hero Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8083ff]/10 border border-[#8083ff]/30 text-[#8083ff] text-xs font-mono font-bold tracking-wider uppercase">
            <Zap className="w-3.5 h-3.5" />
            <span>Customer Self-Service</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#dfe2ee]">
            Order Lookup &amp; Credential Tracking
          </h1>
          <p className="text-xs sm:text-sm text-[#908fa0] max-w-xl mx-auto font-mono">
            Enter your Order ID (e.g. <span className="text-[#8083ff]">ORD-1729...</span>) or your email address to verify real-time payment status and retrieve your accounts.
          </p>
        </div>

        {/* Search Input Box */}
        <div className="p-4 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-xl">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#908fa0]" />
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Enter Order ID or Email address..."
                className="w-full pl-11 pr-4 py-3 bg-[#0a0e16] border border-[#262a33] focus:border-[#8083ff] rounded-xl text-sm font-mono text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8083ff] to-[#6366f1] hover:from-[#6d70ff] hover:to-[#5558e6] text-[#0d0096] hover:text-white font-mono font-bold text-sm tracking-wide transition-all shadow-lg shadow-[#8083ff]/20 disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Track Order</span>
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-300 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Case 1: Multiple Orders Found for Email */}
        {ordersList.length > 0 && !order && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold font-mono text-[#dfe2ee]">
                Orders associated with {inputQuery} ({ordersList.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {ordersList.map((ord) => (
                <div
                  key={ord.orderId}
                  onClick={() => setOrder(ord)}
                  className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] hover:border-[#8083ff] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-[#8083ff]">#{ord.orderId}</span>
                      <span className="text-[#908fa0]">•</span>
                      <span className="text-[#908fa0]">
                        {new Date(ord.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="font-semibold text-sm text-[#dfe2ee]">
                      {ord.productName || "TrinityMart Digital Asset"}{" "}
                      <span className="text-xs font-mono text-[#908fa0]">
                        (x{ord.quantity || 1})
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 font-mono">
                    <div className="text-right">
                      <span className="text-sm font-bold text-emerald-400">₹{ord.amount}</span>
                      <span className="block text-[10px] text-[#908fa0] uppercase">
                        {ord.paymentMethod || "UPI"}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        ord.status === "confirmed"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : ord.status === "pending"
                          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Case 2: Single Order Dossier View */}
        {order && (
          <div className="space-y-6">
            {ordersList.length > 1 && (
              <button
                type="button"
                onClick={() => setOrder(null)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#8083ff] hover:underline cursor-pointer"
              >
                &larr; Back to all orders for this email
              </button>
            )}

            {/* Order Status & Progress Tracker */}
            <div className="p-5 sm:p-7 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262a33] pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-lg font-extrabold text-[#8083ff]">
                      #{order.orderId}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(order.orderId, "hero-order-id")}
                      className="p-1 rounded text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#262a33] transition-colors"
                      title="Copy Order ID"
                    >
                      {copiedKey === "hero-order-id" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-[#908fa0]">
                    Placed on {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {order.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Payment Confirmed &amp; Dispatched
                    </span>
                  ) : order.status === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      Awaiting Payment Verification
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      {order.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Milestones Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33] text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                    1. Order Placed
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                  <span className="text-[11px] font-mono text-[#908fa0] block">Recorded</span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33] text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-emerald-400">
                    2. Payment
                  </span>
                  {order.status === "confirmed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 mx-auto animate-pulse" />
                  )}
                  <span className="text-[11px] font-mono text-[#908fa0] block">
                    {order.status === "confirmed" ? "Verified" : "Pending Check"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33] text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-emerald-400">
                    3. Credentials
                  </span>
                  {order.status === "confirmed" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#908fa0]/60 mx-auto" />
                  )}
                  <span className="text-[11px] font-mono text-[#908fa0] block">
                    {order.status === "confirmed" ? "Assigned" : "Queued"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33] text-center space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider block text-emerald-400">
                    4. Email Delivery
                  </span>
                  {order.emailOpened ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                  ) : order.emailStatus === "sent" ? (
                    <Mail className="w-4 h-4 text-sky-400 mx-auto" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#908fa0]/60 mx-auto" />
                  )}
                  <span className="text-[11px] font-mono text-[#908fa0] block">
                    {order.emailOpened
                      ? "Opened & Received"
                      : order.emailStatus === "sent"
                      ? "Sent to Inbox"
                      : "Pending Dispatch"}
                  </span>
                </div>
              </div>

              {/* Order Key Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33]">
                  <span className="text-[#908fa0] text-[10px] uppercase font-bold block mb-1">
                    Product
                  </span>
                  <span className="font-bold text-[#dfe2ee] text-sm block truncate">
                    {order.productName || "Digital Asset"}
                  </span>
                  <span className="text-[#908fa0]">Quantity: {order.quantity || 1}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33]">
                  <span className="text-[#908fa0] text-[10px] uppercase font-bold block mb-1">
                    Amount Paid
                  </span>
                  <span className="font-bold text-emerald-400 text-base block">
                    ₹{order.amount}
                  </span>
                  <span className="text-[#908fa0]">
                    ~${((Number(order.amount) || 0) * (APP_CONFIG.inrToUsdRate || 0.011)).toFixed(2)} USD
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33]">
                  <span className="text-[#908fa0] text-[10px] uppercase font-bold block mb-1">
                    Payment Method
                  </span>
                  <span className="font-bold text-[#8083ff] text-sm block uppercase">
                    {order.paymentMethod === "crypto" ? "🪙 Atlos Crypto" : "💳 UPI Gateway"}
                  </span>
                  <span className="text-[#908fa0] truncate block">
                    {order.utr ? `Ref: ${order.utr}` : "Awaiting confirmation"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0a0e16] border border-[#262a33]">
                  <span className="text-[#908fa0] text-[10px] uppercase font-bold block mb-1">
                    Delivery Mailbox
                  </span>
                  <span className="font-bold text-[#dfe2ee] text-xs block truncate select-all">
                    {order.email}
                  </span>
                  <span className="text-emerald-400 text-[10px]">Encrypted Dispatch</span>
                </div>
              </div>
            </div>

            {/* Delivered Credentials Card (if confirmed) */}
            {order.status === "confirmed" && (
              <div className="p-5 sm:p-7 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262a33] pb-4">
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-[#dfe2ee] flex items-center gap-2">
                      <span>📦</span>
                      <span>Delivered Account Credentials</span>
                    </h2>
                    <p className="text-xs font-mono text-[#908fa0]">
                      Your accounts are active and ready for use. Copy or download them below.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadCredentials(order)}
                      className="px-3 py-1.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-mono text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .TXT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResendCredentials(order)}
                      disabled={resendingEmail}
                      className="px-3 py-1.5 rounded-lg bg-[#8083ff]/20 hover:bg-[#8083ff]/30 text-[#8083ff] border border-[#8083ff]/40 font-mono text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{resendingEmail ? "Sending…" : "Resend Email"}</span>
                    </button>
                  </div>
                </div>

                {resendFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-mono border ${
                      resendFeedback.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-red-500/10 border-red-500/30 text-red-300"
                    }`}
                  >
                    {resendFeedback.text}
                  </div>
                )}

                {/* Credentials Items List */}
                <div className="space-y-3">
                  {(order.deliveredCredentials || []).map((cred, cIdx) => {
                    const credKey = `${order.orderId}-${cIdx}`;
                    const isPassVisible = revealedPasswords.has(credKey);
                    const effectivePass = cred.password || cred.emailPassword || cred.discordPassword;

                    return (
                      <div
                        key={cIdx}
                        className="p-4 rounded-xl bg-[#0a0e16] border border-[#262a33] space-y-3 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-[#262a33]/60 pb-2">
                          <span className="font-bold text-[#8083ff] uppercase text-[11px]">
                            Unit #{cIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const credText = `Email/User: ${cred.email}\nPassword: ${effectivePass || "N/A"}${cred.token ? `\nToken: ${cred.token}` : ""}${cred.twoFactorKey ? `\n2FA: ${cred.twoFactorKey}` : ""}`;
                              copyText(credText, `all-${credKey}`);
                            }}
                            className="text-[11px] font-semibold text-[#908fa0] hover:text-[#dfe2ee] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `all-${credKey}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedKey === `all-${credKey}` ? "Copied" : "Copy Account"}</span>
                          </button>
                        </div>

                        {/* Email / Username */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#908fa0] text-[11px] w-20 shrink-0">Email / ID:</span>
                          <span className="text-[#dfe2ee] font-semibold truncate select-all flex-1">
                            {cred.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(cred.email, `em-${credKey}`)}
                            className="p-1 text-[#908fa0] hover:text-[#dfe2ee] rounded cursor-pointer"
                          >
                            {copiedKey === `em-${credKey}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        {effectivePass && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#908fa0] text-[11px] w-20 shrink-0">Password:</span>
                            <span className="text-emerald-400 font-semibold truncate select-all flex-1">
                              {isPassVisible ? effectivePass : "••••••••••••"}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(credKey)}
                                className="p-1 text-[#908fa0] hover:text-[#dfe2ee] rounded cursor-pointer"
                                title={isPassVisible ? "Hide password" : "Show password"}
                              >
                                {isPassVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyText(effectivePass, `pw-${credKey}`)}
                                className="p-1 text-[#908fa0] hover:text-[#dfe2ee] rounded cursor-pointer"
                              >
                                {copiedKey === `pw-${credKey}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Token / Key */}
                        {cred.token && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#908fa0] text-[11px] w-20 shrink-0">Token / Key:</span>
                            <span className="text-[#8083ff] font-semibold truncate select-all flex-1">
                              {cred.token}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(cred.token || "", `tok-${credKey}`)}
                              className="p-1 text-[#908fa0] hover:text-[#dfe2ee] rounded cursor-pointer"
                            >
                              {copiedKey === `tok-${credKey}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* 2FA Key */}
                        {cred.twoFactorKey && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#908fa0] text-[11px] w-20 shrink-0">2FA Secret:</span>
                            <span className="text-amber-400 font-semibold truncate select-all flex-1">
                              {cred.twoFactorKey}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(cred.twoFactorKey || "", `2fa-${credKey}`)}
                              className="p-1 text-[#908fa0] hover:text-[#dfe2ee] rounded cursor-pointer"
                            >
                              {copiedKey === `2fa-${credKey}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending Payment Action Banner */}
            {order.status === "pending" && (
              <div className="p-5 sm:p-7 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-amber-300">
                      Payment Verification in Progress
                    </h3>
                    <p className="text-xs font-mono text-amber-200/80">
                      If you already transferred funds via UPI or Atlos Crypto, our background gateway reconciler typically detects and fulfills orders within 15–60 seconds.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => performSearch(order.orderId)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-mono font-bold text-xs tracking-wider uppercase transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Check Payment Status Now</span>
                  </button>
                  <a
                    href={discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-mono text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#8083ff]" />
                    <span>Need Help on Discord?</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Support Card */}
        <div className="p-6 rounded-2xl bg-[#181c24]/50 border border-[#262a33] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#dfe2ee]">
              Can&apos;t find your Order ID or experiencing issues?
            </h4>
            <p className="text-xs text-[#908fa0] font-mono">
              Our automated Discord staff and support agents are available 24/7.
            </p>
          </div>
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] hover:text-white font-mono text-xs font-bold border border-[#8083ff]/30 transition-all flex items-center gap-2 shrink-0"
          >
            <span>💬 Open Discord Ticket</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0e16] flex items-center justify-center text-[#908fa0] font-mono text-sm">
          Loading Order Lookup Portal…
        </div>
      }
    >
      <OrderLookupContent />
    </Suspense>
  );
}
