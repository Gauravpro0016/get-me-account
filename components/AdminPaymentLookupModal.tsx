"use client";

import React, { useState } from "react";
import {
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Coins,
  CreditCard,
  RefreshCw,
} from "lucide-react";

interface AdminPaymentLookupModalProps {
  adminPassword: string;
  isOpen: boolean;
  onClose: () => void;
  onOrderFulfilled?: () => void;
  initialQuery?: string;
}

export function AdminPaymentLookupModal({
  adminPassword,
  isOpen,
  onClose,
  onOrderFulfilled,
  initialQuery = "",
}: AdminPaymentLookupModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [gateway, setGateway] = useState<"auto" | "crypto" | "upi">("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [fulfilling, setFulfilling] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [fulfillMsg, setFulfillMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const copyVal = (val: string, key: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setError("Please enter an Order ID, Blockchain TxID, or UPI UTR.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setFulfillMsg(null);

    try {
      const res = await fetch("/api/admin/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          query: query.trim(),
          gateway,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Verification query failed");
      }

      setResult(data);
      if (data.matchedOrder?.email) {
        setCustomerEmail(data.matchedOrder.email);
      } else if (data.orderData?.email) {
        setCustomerEmail(data.orderData.email);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to connect to verification gateway.");
    } finally {
      setLoading(false);
    }
  };

  const handleFulfillVerified = async () => {
    if (!result || !result.isPaid) return;
    setFulfilling(true);
    setFulfillMsg(null);

    const orderId = result.matchedOrder?.orderId || result.query.trim();
    const finalEmail = customerEmail.trim() || result.matchedOrder?.email || result.orderData?.email;

    if (!finalEmail) {
      setFulfillMsg({
        type: "error",
        text: "Please provide a customer email address to deliver the credentials.",
      });
      setFulfilling(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/orders/fulfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          orderId,
          email: finalEmail,
          action: result.gateway === "crypto" ? "check_crypto" : "check_upi",
          method: result.gateway,
          txHash: result.detectedTxid,
          utr: result.detectedUtr || (result.detectedTxid ? `CRYPTO:${result.detectedTxid}` : undefined),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFulfillMsg({
          type: "success",
          text: "✅ Order successfully fulfilled! Credentials sent to customer email & Discord notified.",
        });
        if (onOrderFulfilled) onOrderFulfilled();
        // Update local result to fulfilled
        setResult((prev: any) => ({ ...prev, alreadyFulfilled: true }));
      } else {
        throw new Error(data.message || data.error || "Fulfillment failed.");
      }
    } catch (err: any) {
      setFulfillMsg({
        type: "error",
        text: err?.message || "Fulfillment error.",
      });
    } finally {
      setFulfilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0f131c] border border-[#262a33] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#262a33] bg-[#0a0e16]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8083ff]/15 border border-[#8083ff]/30 flex items-center justify-center text-[#8083ff]">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#dfe2ee] flex items-center gap-2">
                <span>Check Payment Status</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#8083ff]/15 text-[#8083ff] border border-[#8083ff]/30">
                  Live Gateway
                </span>
              </h2>
              <p className="font-mono text-xs text-[#908fa0]">
                Authoritatively inspect Crypto (Atlos/Blockchain) or UPI (FamGateway)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <form onSubmit={handleVerify} className="space-y-3">
            {/* Gateway selection tabs */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#908fa0] mr-1">Gateway:</span>
              <div className="inline-flex p-1 bg-[#181c24] rounded-xl border border-[#262a33] gap-1">
                <button
                  type="button"
                  onClick={() => setGateway("auto")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    gateway === "auto"
                      ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-xs"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  Auto-Detect
                </button>
                <button
                  type="button"
                  onClick={() => setGateway("crypto")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    gateway === "crypto"
                      ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-xs"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Crypto (Atlos)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGateway("upi")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    gateway === "upi"
                      ? "bg-[#00a572] text-[#003822] font-bold shadow-xs"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee]"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>UPI (FamGateway)</span>
                </button>
              </div>
            </div>

            {/* Input field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono text-[#c7c4d7]">
                Order ID, Blockchain TxID (Hash), or 12-Digit UPI UTR
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. ORD-CR-... or 0x71c... or 423456789012"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#181c24] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 font-mono text-xs sm:text-sm outline-none focus:border-[#8083ff] transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute inset-y-0 right-3 flex items-center text-[#908fa0] hover:text-[#dfe2ee] text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#8083ff]/20 shrink-0"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Checking…</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Check Payment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Fulfillment Status Banner */}
          {fulfillMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-mono flex items-start gap-2 ${
                fulfillMsg.type === "success"
                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/15 border border-red-500/30 text-red-300"
              }`}
            >
              {fulfillMsg.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{fulfillMsg.text}</span>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="p-4 rounded-xl bg-[#181c24] border border-[#262a33] space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#262a33]/60 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {result.isPaid ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>PAYMENT CONFIRMED</span>
                    </span>
                  ) : result.status === "mempool_detected" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      <Clock className="w-3.5 h-3.5" />
                      <span>DETECTED IN MEMPOOL</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>PENDING / NOT SETTLED</span>
                    </span>
                  )}

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#0f131c] text-[#8083ff] border border-[#262a33]">
                    {result.gateway === "crypto" ? "🪙 Atlos Crypto" : "💳 FamGateway UPI"}
                  </span>
                </div>

                <div className="text-right">
                  {result.alreadyFulfilled ? (
                    <span className="text-xs font-mono text-emerald-400 font-semibold">
                      ✓ Credentials Dispatched
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-amber-400 font-semibold">
                      ⏳ Fulfillment Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {/* Query / Order ID */}
                <div className="p-2.5 rounded-lg bg-[#0f131c] border border-[#262a33] space-y-1">
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider block">
                    Query Reference
                  </span>
                  <div className="flex items-center justify-between text-[#dfe2ee] font-medium truncate">
                    <span className="truncate">{result.query}</span>
                    <button
                      type="button"
                      onClick={() => copyVal(result.query, "q-copy")}
                      className="text-[#908fa0] hover:text-[#dfe2ee] p-0.5 rounded cursor-pointer"
                    >
                      {copiedKey === "q-copy" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="p-2.5 rounded-lg bg-[#0f131c] border border-[#262a33] space-y-1">
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider block">
                    Detected Settlement Amount
                  </span>
                  <div className="text-[#dfe2ee] font-bold text-sm">
                    {result.detectedAmount !== undefined
                      ? result.gateway === "crypto"
                        ? `$${result.detectedAmount} USD (~₹${Math.round(result.detectedAmount / 0.011)})`
                        : `₹${result.detectedAmount}`
                      : result.matchedOrder?.amount
                      ? `₹${result.matchedOrder.amount}`
                      : "—"}
                  </div>
                </div>

                {/* Transaction Hash or UTR */}
                <div className="p-2.5 rounded-lg bg-[#0f131c] border border-[#262a33] space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider block">
                    {result.gateway === "crypto" ? "Blockchain TxID / Hash" : "Bank UTR Reference"}
                  </span>
                  <div className="flex items-center justify-between text-emerald-400 font-semibold text-xs break-all">
                    <span>{result.detectedTxid || result.detectedUtr || result.matchedOrder?.utr || "Pending Gateway Detection"}</span>
                    {(result.detectedTxid || result.detectedUtr) && (
                      <button
                        type="button"
                        onClick={() => copyVal(result.detectedTxid || result.detectedUtr, "tx-copy")}
                        className="text-[#908fa0] hover:text-[#dfe2ee] p-0.5 rounded cursor-pointer ml-2 shrink-0"
                      >
                        {copiedKey === "tx-copy" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Matched Customer Email */}
                <div className="p-2.5 rounded-lg bg-[#0f131c] border border-[#262a33] space-y-1 sm:col-span-2">
                  <span className="text-[10px] text-[#908fa0] uppercase tracking-wider block">
                    Customer Delivery Email
                  </span>
                  <div className="text-[#dfe2ee]">
                    {result.matchedOrder?.email || result.orderData?.email || "No order record found in database for this hash."}
                  </div>
                </div>
              </div>

              {/* 1-Click Fulfill Action if Confirmed and Not Yet Dispatched */}
              {result.isPaid && !result.alreadyFulfilled && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Payment verified on gateway! Ready to dispatch credentials:</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Enter customer email for delivery"
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0f131c] border border-emerald-500/30 text-[#dfe2ee] text-xs font-mono outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={handleFulfillVerified}
                      disabled={fulfilling || !customerEmail.trim()}
                      className="px-4 py-2 rounded-lg bg-linear-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50 shrink-0"
                    >
                      {fulfilling ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching…</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>⚡ Fulfill &amp; Send Credentials</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#262a33] bg-[#0a0e16]/60 flex items-center justify-between text-xs font-mono text-[#908fa0]">
          <span>Atlos REST API + FamGateway Live Integration</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#181c24] hover:bg-[#262a33] text-[#dfe2ee] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
