"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Ticket,
  Plus,
  Search,
  Copy,
  Check,
  Trash2,
  Edit2,
  Calendar,
  Percent,
  Coins,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  Users,
  ArrowUpDown,
} from "lucide-react";
import { Coupon } from "@/lib/coupons";

interface AdminCouponsManagerProps {
  adminPassword: string;
}

export function AdminCouponsManager({ adminPassword }: AdminCouponsManagerProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal / Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState<string>("10");
  const [minOrderAmount, setMinOrderAmount] = useState<string>("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch Coupons
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        headers: { "x-admin-password": adminPassword },
      });
      if (!res.ok) throw new Error("Failed to load coupons");
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err: any) {
      console.error("AdminCouponsManager: Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate random promo code
  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(`TRINITY-${rand}`);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("10");
    setMinOrderAmount("0");
    setMaxDiscountAmount("");
    setMaxUses("");
    setActive(true);
    setExpiresAt("");
    setDescription("");
    setFormError("");
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Coupon) => {
    setEditingId(c.id);
    setCode(c.code);
    setDiscountType(c.discountType);
    setDiscountValue(String(c.discountValue));
    setMinOrderAmount(String(c.minOrderAmount || 0));
    setMaxDiscountAmount(c.maxDiscountAmount ? String(c.maxDiscountAmount) : "");
    setMaxUses(c.maxUses ? String(c.maxUses) : "");
    setActive(c.active);
    setExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
    setDescription(c.description || "");
    setFormError("");
    setModalOpen(true);
  };

  // Save Coupon (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setFormError("Coupon code is required");
      return;
    }

    const numValue = Number(discountValue);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      setFormError("Discount value must be greater than 0");
      return;
    }

    if (discountType === "percentage" && numValue > 100) {
      setFormError("Percentage discount cannot exceed 100%");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const payload = {
        id: editingId || undefined,
        code: cleanCode,
        discountType,
        discountValue: numValue,
        minOrderAmount: Math.max(0, Number(minOrderAmount) || 0),
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        active,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        description: description.trim(),
      };

      const res = await fetch("/api/admin/coupons", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save coupon");
      }

      await fetchCoupons();
      setModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (c: Coupon) => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          id: c.id,
          active: !c.active,
        }),
      });
      if (res.ok) {
        setCoupons((prev) =>
          prev.map((item) => (item.id === c.id ? { ...item, active: !c.active } : item))
        );
      }
    } catch (err) {
      console.error("Toggle active status failed:", err);
    }
  };

  // Delete coupon
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      if (res.ok) {
        setCoupons((prev) => prev.filter((item) => item.id !== id));
        setDeletingId(null);
      }
    } catch (err) {
      console.error("Delete coupon failed:", err);
    }
  };

  // Filtered coupons
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesDesc = (c.description || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc) return false;
      }

      if (filterType === "active") return c.active;
      if (filterType === "inactive") return !c.active;
      if (filterType === "expired") {
        if (!c.expiresAt) return false;
        return Date.now() > new Date(c.expiresAt).getTime();
      }

      return true;
    });
  }, [coupons, search, filterType]);

  // Aggregate stats
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.active).length;
  const totalUses = coupons.reduce((acc, c) => acc + (c.usedCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Top Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#908fa0] font-bold">
              Active Promo Codes
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#4edea3]">
              {activeCoupons} <span className="text-xs text-[#908fa0] font-normal">/ {totalCoupons}</span>
            </div>
            <p className="text-[11px] text-[#908fa0]">Currently available for shoppers</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Ticket className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#908fa0] font-bold">
              Total Redemptions
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-[#8083ff]">
              {totalUses}
            </div>
            <p className="text-[11px] text-[#908fa0]">Times coupons were applied</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#8083ff]/10 border border-[#8083ff]/20 flex items-center justify-center text-[#8083ff]">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#908fa0] font-bold">
              System Discount Engine
            </span>
            <div className="text-base sm:text-lg font-bold text-[#dfe2ee]">
              Real-Time Validation
            </div>
            <p className="text-[11px] text-[#4edea3] flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
              UPI &amp; Crypto Auto-Synced
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Search, Filter & Action Bar ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#908fa0] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code or description..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] placeholder-[#908fa0]/60 outline-none focus:border-[#8083ff]"
            />
          </div>

          {/* Filter Type */}
          <div className="flex rounded-xl bg-[#10141d] p-1 border border-[#262a33]">
            {(["all", "active", "inactive", "expired"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold capitalize transition-colors cursor-pointer ${
                  filterType === type
                    ? "bg-[#8083ff] text-[#0d0096]"
                    : "text-[#908fa0] hover:text-[#dfe2ee]"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchCoupons}
            disabled={loading}
            className="p-2.5 rounded-xl bg-[#10141d] hover:bg-[#262a33] border border-[#262a33] text-[#dfe2ee] text-xs font-mono transition-colors cursor-pointer"
            title="Refresh coupons"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Coupon</span>
          </button>
        </div>
      </div>

      {/* ── Coupons List ── */}
      <div className="rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md overflow-hidden">
        {loading && coupons.length === 0 ? (
          <div className="p-12 text-center text-[#908fa0] text-xs font-mono space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#8083ff]" />
            <p>Loading promo coupons from database...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-12 text-center text-[#908fa0] text-xs font-mono space-y-3">
            <Ticket className="w-8 h-8 text-[#908fa0]/40 mx-auto" />
            <p className="text-sm font-bold text-[#dfe2ee]">No coupons found</p>
            <p className="text-xs">Create your first promo code or adjust your search filter.</p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-4 py-2 rounded-xl bg-[#8083ff] text-[#0d0096] font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Coupon</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#10141d] border-b border-[#262a33] text-[#908fa0] font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Code</th>
                  <th className="py-3.5 px-4 font-bold">Discount</th>
                  <th className="py-3.5 px-4 font-bold">Min Order</th>
                  <th className="py-3.5 px-4 font-bold">Redemptions</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold">Expiry</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262a33] text-[#dfe2ee]">
                {filteredCoupons.map((c) => {
                  const isExpired = c.expiresAt && Date.now() > new Date(c.expiresAt).getTime();
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Code */}
                      <td className="py-4 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 select-all">
                            {c.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(c.code)}
                            className="text-[#908fa0] hover:text-[#dfe2ee] p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                            title="Copy Code"
                          >
                            {copiedCode === c.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {c.description && (
                          <p className="text-[11px] text-[#908fa0] mt-1 truncate max-w-xs">
                            {c.description}
                          </p>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="py-4 px-4 font-mono">
                        <div className="font-extrabold text-[#4edea3]">
                          {c.discountType === "percentage"
                            ? `${c.discountValue}% OFF`
                            : `₹${c.discountValue} FLAT`}
                        </div>
                        {c.discountType === "percentage" && c.maxDiscountAmount && (
                          <span className="text-[10px] text-[#908fa0]">
                            Max cap: ₹{c.maxDiscountAmount}
                          </span>
                        )}
                      </td>

                      {/* Min Order */}
                      <td className="py-4 px-4 font-mono">
                        {c.minOrderAmount > 0 ? (
                          <span>₹{c.minOrderAmount}</span>
                        ) : (
                          <span className="text-[#908fa0]">No min.</span>
                        )}
                      </td>

                      {/* Redemptions */}
                      <td className="py-4 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{c.usedCount || 0}</span>
                          <span className="text-[#908fa0]">
                            / {c.maxUses ? c.maxUses : "∞"} uses
                          </span>
                        </div>
                        {c.maxUses && (
                          <div className="w-24 h-1.5 bg-[#10141d] rounded-full overflow-hidden mt-1.5 border border-[#262a33]">
                            <div
                              className="h-full bg-[#8083ff] rounded-full"
                              style={{
                                width: `${Math.min(100, ((c.usedCount || 0) / c.maxUses) * 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono transition-all cursor-pointer ${
                            c.active
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-white/5 text-[#908fa0] border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.active ? "bg-emerald-400 animate-pulse" : "bg-[#908fa0]"
                            }`}
                          />
                          <span>{c.active ? "Active" : "Disabled"}</span>
                        </button>
                      </td>

                      {/* Expiry */}
                      <td className="py-4 px-4 font-mono text-[11px]">
                        {c.expiresAt ? (
                          <span
                            className={
                              isExpired ? "text-[#ffb4ab] font-bold" : "text-[#c7c4d7]"
                            }
                          >
                            {isExpired ? "⚠️ Expired: " : ""}
                            {new Date(c.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[#908fa0]">Never</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg bg-[#10141d] hover:bg-[#262a33] text-[#c7c4d7] hover:text-[#dfe2ee] border border-[#262a33] transition-colors cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(c.id)}
                            className="p-1.5 rounded-lg bg-[#93000a]/15 hover:bg-[#93000a]/30 text-[#ffb4ab] border border-[#ffb4ab]/20 transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#181c24] border border-[#262a33] p-5 sm:p-6 shadow-2xl space-y-5 text-[#dfe2ee] text-xs scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#262a33] pb-3.5">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-[#dfe2ee] flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#8083ff]" />
                  <span>{editingId ? "Edit Coupon" : "Create New Promo Code"}</span>
                </h3>
                <p className="font-mono text-xs text-[#908fa0]">
                  Configure discount percentages, flat amounts, and redemption rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#908fa0] hover:text-[#dfe2ee] flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Code Input & Random Generator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                    Coupon Code *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="text-[10px] font-mono text-[#8083ff] hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Random</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TRINITY20, BOOST5"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#10141d] border border-[#262a33] text-sm font-mono font-bold text-[#dfe2ee] placeholder-[#908fa0]/50 uppercase outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#10141d] rounded-xl border border-[#262a33]">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percentage")}
                      className={`py-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        discountType === "percentage"
                          ? "bg-[#8083ff] text-[#0d0096]"
                          : "text-[#908fa0] hover:text-[#dfe2ee]"
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("flat")}
                      className={`py-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        discountType === "flat"
                          ? "bg-[#8083ff] text-[#0d0096]"
                          : "text-[#908fa0] hover:text-[#dfe2ee]"
                      }`}
                    >
                      ₹ Flat
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                    Discount Value *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[#908fa0] font-bold">
                      {discountType === "percentage" ? "%" : "₹"}
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      max={discountType === "percentage" ? "100" : undefined}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percentage" ? "10" : "5"}
                      className="w-full pl-8 pr-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-sm font-mono font-bold text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                    />
                  </div>
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                    Min Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(e.target.value)}
                    placeholder="0 (no minimum)"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                  />
                </div>

                {discountType === "percentage" ? (
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(e.target.value)}
                      placeholder="Optional cap (e.g. 100)"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited if empty"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                    />
                  </div>
                )}
              </div>

              {/* Usage Limit & Expiry Date */}
              {discountType === "percentage" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited if empty"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                    />
                  </div>
                </div>
              )}

              {discountType === "flat" && (
                <div className="space-y-1.5">
                  <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs font-mono text-[#dfe2ee] outline-none focus:border-[#8083ff]"
                  />
                </div>
              )}

              {/* Description / Note */}
              <div className="space-y-1.5">
                <label className="font-bold text-[#c7c4d7] uppercase tracking-wider text-[11px] font-mono">
                  Description / Merchant Note
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Exclusive Discord Booster Community Discount"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#10141d] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/50 outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#10141d] border border-[#262a33]">
                <div>
                  <span className="font-bold text-[#dfe2ee] block text-xs">
                    Enable Coupon
                  </span>
                  <span className="text-[10px] text-[#908fa0]">
                    Allow customers to use this code at checkout
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    active ? "bg-emerald-500" : "bg-[#262a33]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      active ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262a33]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#c7c4d7] text-xs font-mono font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs cursor-pointer transition-all shadow-md shadow-[#8083ff]/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>{editingId ? "Update Coupon" : "Create Coupon"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION DIALOG ── */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#181c24] border border-[#262a33] p-5 shadow-2xl space-y-4 text-[#dfe2ee] text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#dfe2ee]">Delete Promo Coupon</h4>
                <p className="text-[11px] text-[#908fa0]">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-[#c7c4d7]">
              Are you sure you want to delete this coupon? Existing orders will retain their historic discount record.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-3.5 py-2 rounded-xl bg-[#262a33] text-[#c7c4d7] font-mono text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
