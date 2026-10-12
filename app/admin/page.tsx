"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminProductsManager } from "@/components/AdminProductsManager";
import { AdminCouponsManager } from "@/components/AdminCouponsManager";
import { APP_CONFIG } from "@/lib/config";

type Credential = {
  id: string;
  email: string;
  emailPassword?: string;
  discordPassword?: string;
  password?: string;
  token?: string;
  domain?: string;
  twoFactorKey?: string;
  keyweb?: string;
  addedAt: string;
};

type StoredOrder = {
  orderId: string;
  email: string;
  amount: number;
  quantity?: number;
  status: "pending" | "confirmed" | "failed" | "expired";
  createdAt: string;
  confirmedAt?: string;
  utr?: string;
  senderName?: string;
  deliveredCredential?: {
    email: string;
    emailPassword?: string;
    discordPassword?: string;
    password?: string;
    token?: string;
    domain?: string;
    twoFactorKey?: string;
    keyweb?: string;
  };
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
  // ── Email delivery & tracking fields ──
  emailStatus?: "pending" | "sent" | "opened" | "failed";
  emailSentAt?: string;
  emailRecipient?: string;
  emailMessageId?: string;
  emailDeliveryResponse?: string;
  emailError?: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  emailLastOpenedAt?: string;
  emailOpenCount?: number;
  emailClientUserAgent?: string;
  emailClientIp?: string;
  emailConfirmedManually?: boolean;
  emailResentCount?: number;
  emailLastResentAt?: string;
};

type Status = "idle" | "loading" | "error" | "success";

export default function AdminPage() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // ── Navigation Tab ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<"orders" | "products" | "coupons">("orders");

  // ── Search & Filter state ────────────────────────────────────────────────
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "confirmed" | "pending" | "failed">("all");
  const [orderEmailFilter, setOrderEmailFilter] = useState<"all" | "opened" | "sent" | "failed" | "pending">("all");
  const [stockSearch, setStockSearch] = useState("");

  // ── Credential pool state ────────────────────────────────────────────────
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [fetchStatus, setFetchStatus] = useState<Status>("idle");

  // ── Orders state ─────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderViewMode, setOrderViewMode] = useState<"cards" | "split" | "table">("cards");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [revealedOrderCreds, setRevealedOrderCreds] = useState<Set<string>>(new Set());
  const [revealedOrderEmailCreds, setRevealedOrderEmailCreds] = useState<Set<string>>(new Set());
  const [revealedOrderDiscordCreds, setRevealedOrderDiscordCreds] = useState<Set<string>>(new Set());

  // ── Email Tracking & Audit Modal state ───────────────────────────────────
  const [auditModalOrder, setAuditModalOrder] = useState<StoredOrder | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCustomEmail, setResendCustomEmail] = useState("");
  const [resendStatusMsg, setResendStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [togglingManualReceipt, setTogglingManualReceipt] = useState(false);
  const [copiedAuditKey, setCopiedAuditKey] = useState<string>("");

  // ── Add form state ───────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [newEmailPassword, setNewEmailPassword] = useState("");
  const [newDiscordPassword, setNewDiscordPassword] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newTwoFactorKey, setNewTwoFactorKey] = useState("");
  const [newKeyweb, setNewKeyweb] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showDiscordPassword, setShowDiscordPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [addStatus, setAddStatus] = useState<Status>("idle");
  const [addError, setAddError] = useState("");

  // ── Bulk import state ────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState<Status>("idle");
  const [bulkMsg, setBulkMsg] = useState("");

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Visible secrets in tables ────────────────────────────────────────────
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [revealedEmailIds, setRevealedEmailIds] = useState<Set<string>>(new Set());
  const [revealedDiscordIds, setRevealedDiscordIds] = useState<Set<string>>(new Set());
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [revealed2fa, setRevealed2fa] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string>("");

  // On mount, try to restore session password
  useEffect(() => {
    const saved = sessionStorage.getItem("adminPwd");
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = async () => {
    setAuthError("");
    if (!authInput.trim()) {
      setAuthError("Please enter your admin password.");
      return;
    }
    const res = await fetch("/api/admin/credentials", {
      headers: { "x-admin-password": authInput },
    });
    if (res.status === 401) {
      setAuthError("Wrong password. Try again.");
      return;
    }
    sessionStorage.setItem("adminPwd", authInput);
    setPassword(authInput);
    setAuthenticated(true);
  };

  const fetchCredentials = useCallback(async () => {
    setFetchStatus("loading");
    try {
      const res = await fetch("/api/admin/credentials", {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setCredentials(data.credentials || []);
      setFetchStatus("success");
    } catch {
      setFetchStatus("error");
    }
  }, [password]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { "x-admin-password": password },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, [password]);

  useEffect(() => {
    if (authenticated) {
      fetchCredentials();
      fetchOrders();
    }
  }, [authenticated, fetchCredentials, fetchOrders]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || (!newEmailPassword.trim() && !newDiscordPassword.trim())) {
      setAddError("Account email and at least one password (Email Password or Discord Password) are required.");
      return;
    }
    setAddError("");
    setAddStatus("loading");
    try {
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          emailPassword: newEmailPassword.trim() || undefined,
          discordPassword: newDiscordPassword.trim() || undefined,
          token: newToken.trim() || undefined,
          domain: newDomain.trim() || undefined,
          twoFactorKey: newTwoFactorKey.trim() || undefined,
          keyweb: newKeyweb.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Add failed");
      setNewEmail("");
      setNewEmailPassword("");
      setNewDiscordPassword("");
      setNewToken("");
      setNewDomain("");
      setNewTwoFactorKey("");
      setNewKeyweb("");
      setAddStatus("success");
      await fetchCredentials();
      setTimeout(() => setAddStatus("idle"), 2500);
    } catch {
      setAddStatus("error");
      setAddError("Failed to add credential. Try again.");
    }
  };

  const handleBulkAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      setBulkMsg("Please paste account credentials into the box.");
      return;
    }
    setBulkStatus("loading");
    setBulkMsg("");
    try {
      const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
      const parsed: Array<{
        email: string;
        emailPassword?: string;
        discordPassword?: string;
        password?: string;
        token?: string;
        domain?: string;
        twoFactorKey?: string;
        keyweb?: string;
      }> = [];

      for (const line of lines) {
        const delim = line.includes("----")
          ? "----"
          : line.includes("|")
          ? "|"
          : line.includes("\t")
          ? "\t"
          : line.includes(",")
          ? ","
          : ":";
        const parts = line.split(delim).map((p) => p.trim());
        if (parts.length >= 3) {
          parsed.push({
            email: parts[0],
            emailPassword: parts[1],
            discordPassword: parts[2],
            token: parts[3] || undefined,
            domain: parts[4] || undefined,
            twoFactorKey: parts[5] || undefined,
            keyweb: parts[6] || undefined,
          });
        } else if (parts.length === 2) {
          parsed.push({
            email: parts[0],
            emailPassword: parts[1],
            discordPassword: parts[1],
          });
        }
      }

      if (parsed.length === 0) {
        setBulkStatus("error");
        setBulkMsg(
          "No valid account rows found. Example: email:emailPassword:discordPassword or email:emailPassword:discordPassword:token:domain:2fa:keyweb"
        );
        return;
      }

      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ credentials: parsed }),
      });

      if (!res.ok) throw new Error("Bulk import failed");
      const data = await res.json();
      setBulkText("");
      setBulkStatus("success");
      setBulkMsg(`✅ Successfully imported ${data.count} accounts into the pool!`);
      await fetchCredentials();
      setTimeout(() => {
        setBulkStatus("idle");
        setBulkMode(false);
      }, 3000);
    } catch {
      setBulkStatus("error");
      setBulkMsg("Failed to import accounts. Please verify your format.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this account from stock?")) return;
    setDeletingId(id);
    try {
      await fetch("/api/admin/credentials", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ id }),
      });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRevealEmail = (id: string) => {
    setRevealedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRevealDiscord = (id: string) => {
    setRevealedDiscordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRevealToken = (id: string) => {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleReveal2fa = (id: string) => {
    setRevealed2fa((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyVal = (text: string | undefined, key: string) => {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    }
  };

  const toggleRevealOrderCred = (orderId: string) => {
    setRevealedOrderCreds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleRevealOrderEmailCred = (key: string) => {
    setRevealedOrderEmailCreds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRevealOrderDiscordCred = (key: string) => {
    setRevealedOrderDiscordCreds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminPwd");
    setAuthenticated(false);
    setPassword("");
    setAuthInput("");
    setCredentials([]);
    setOrders([]);
  };

  // Metrics
  const inrToUsdRate = APP_CONFIG.inrToUsdRate || 0.0118;
  const confirmedOrders = useMemo(() => orders.filter((o) => o.status === "confirmed"), [orders]);
  const totalRevenue = useMemo(
    () => confirmedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    [confirmedOrders]
  );
  const totalRevenueUsd = totalRevenue * inrToUsdRate;
  const openedOrdersCount = useMemo(
    () => orders.filter((o) => o.emailOpened || o.emailStatus === "opened").length,
    [orders]
  );
  const sentOrdersCount = useMemo(
    () => orders.filter((o) => (o.emailStatus === "sent" || (o.status === "confirmed" && !o.emailStatus)) && !o.emailOpened).length,
    [orders]
  );
  const failedOrdersCount = useMemo(
    () => orders.filter((o) => o.emailStatus === "failed").length,
    [orders]
  );

  // Email Action Handlers
  const handleResendEmail = async (orderId: string, emailOverride?: string) => {
    setResendingEmail(true);
    setResendStatusMsg(null);
    try {
      const res = await fetch("/api/admin/orders/resend-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          orderId,
          email: emailOverride?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to resend email");
      }
      setResendStatusMsg({ type: "success", text: "✅ Credential email resent successfully!" });
      await fetchOrders();
      setAuditModalOrder((prev) =>
        prev && prev.orderId === orderId
          ? {
              ...prev,
              email: emailOverride?.trim() || prev.email,
              emailStatus: "sent",
              emailSentAt: new Date().toISOString(),
              emailResentCount: (prev.emailResentCount || 0) + 1,
            }
          : prev
      );
      setTimeout(() => setResendStatusMsg(null), 4000);
    } catch (err) {
      setResendStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to resend email",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleToggleManualReceipt = async (orderId: string, newReceivedState: boolean) => {
    setTogglingManualReceipt(true);
    try {
      const res = await fetch("/api/admin/orders/mark-email-received", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          orderId,
          received: newReceivedState,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update receipt");
      }
      await fetchOrders();
      setAuditModalOrder((prev) =>
        prev && prev.orderId === orderId ? data.order : prev
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    } finally {
      setTogglingManualReceipt(false);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus =
        orderStatusFilter === "all" ||
        (orderStatusFilter === "failed" ? o.status === "failed" || o.status === "expired" : o.status === orderStatusFilter);

      if (!matchesStatus) return false;

      // Filter by email receipt status
      if (orderEmailFilter === "opened") {
        if (!o.emailOpened && o.emailStatus !== "opened") return false;
      } else if (orderEmailFilter === "sent") {
        if (o.emailOpened || o.emailStatus === "opened" || o.emailStatus === "failed" || o.status !== "confirmed") return false;
      } else if (orderEmailFilter === "failed") {
        if (o.emailStatus !== "failed") return false;
      } else if (orderEmailFilter === "pending") {
        if (o.status !== "pending" && o.emailStatus !== "pending") return false;
      }

      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase().trim();
      const matchId = o.orderId.toLowerCase().includes(q);
      const matchEmail = o.email.toLowerCase().includes(q);
      const matchUtr = o.utr ? o.utr.toLowerCase().includes(q) : false;
      const matchEmailStatus = o.emailStatus ? o.emailStatus.toLowerCase().includes(q) : false;
      return matchId || matchEmail || matchUtr || matchEmailStatus;
    });
  }, [orders, orderStatusFilter, orderEmailFilter, orderSearch]);

  // Filtered Stock Credentials
  const filteredCredentials = useMemo(() => {
    if (!stockSearch.trim()) return credentials;
    const q = stockSearch.toLowerCase().trim();
    return credentials.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.domain && c.domain.toLowerCase().includes(q)) ||
        (c.token && c.token.toLowerCase().includes(q))
    );
  }, [credentials, stockSearch]);

  const getStatusBadge = (status: StoredOrder["status"]) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Confirmed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            Pending
          </span>
        );
      case "failed":
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/70 border border-white/10">
            {status}
          </span>
        );
    }
  };

  const getEmailStatusBadge = (ord: StoredOrder) => {
    // 1. If customer opened & received the email
    if (ord.emailOpened || ord.emailStatus === "opened") {
      const openCount = ord.emailOpenCount || 1;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAuditModalOrder(ord);
            setResendCustomEmail(ord.email);
            setResendStatusMsg(null);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 hover:bg-emerald-500/25 active:scale-95 transition-all cursor-pointer shadow-xs text-left"
          title="Customer received & opened this email. Click for audit details."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>👁️ Received & Opened</span>
          {openCount > 1 && (
            <span className="px-1 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/30 text-emerald-200">
              {openCount}x
            </span>
          )}
        </button>
      );
    }

    // 2. If delivery failed
    if (ord.emailStatus === "failed") {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAuditModalOrder(ord);
            setResendCustomEmail(ord.email);
            setResendStatusMsg(null);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight bg-red-500/15 text-red-300 border border-red-500/35 hover:bg-red-500/25 active:scale-95 transition-all cursor-pointer shadow-xs text-left"
          title={ord.emailError || "Email failed to send. Click to inspect & retry."}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          <span>⚠️ Delivery Failed</span>
        </button>
      );
    }

    // 3. If sent (order confirmed and email sent via SMTP, waiting for customer to open)
    if (ord.emailStatus === "sent" || (ord.status === "confirmed" && !ord.emailStatus)) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAuditModalOrder(ord);
            setResendCustomEmail(ord.email);
            setResendStatusMsg(null);
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight bg-sky-500/15 text-sky-300 border border-sky-500/35 hover:bg-sky-500/25 active:scale-95 transition-all cursor-pointer shadow-xs text-left"
          title="Email dispatched to customer mailbox. Awaiting customer open. Click for details."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
          <span>✉️ Sent (Unopened)</span>
        </button>
      );
    }

    // 4. If payment pending
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAuditModalOrder(ord);
          setResendCustomEmail(ord.email);
          setResendStatusMsg(null);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white/40 bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-left"
        title="Payment pending. Email not sent yet."
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
        <span>⏳ Unsent</span>
      </button>
    );
  };

  const renderOrderCredentials = (ord: StoredOrder) => {
    const deliveredList =
      ord.deliveredCredentials && ord.deliveredCredentials.length > 0
        ? ord.deliveredCredentials
        : ord.deliveredCredential
        ? [ord.deliveredCredential]
        : [];

    if (deliveredList.length === 0) {
      return <span className="text-white/30 text-xs italic">— None delivered —</span>;
    }

    return (
      <div className="flex flex-col gap-2 w-full min-w-0">
        {deliveredList.length > 1 && (
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
              📦 {deliveredList.length} Accounts Delivered
            </span>
            <button
              type="button"
              onClick={() => {
                const text = deliveredList
                  .map((c, i) => {
                    let t = `Account #${i + 1}:\nEmail: ${c.email}`;
                    const ep = c.emailPassword || c.password;
                    if (ep) t += `\nEmail Password: ${ep}`;
                    if (c.discordPassword) t += `\nDiscord Password: ${c.discordPassword}`;
                    if (c.domain) t += `\nDomain: ${c.domain}`;
                    if (c.token) t += `\nToken: ${c.token}`;
                    if (c.twoFactorKey) t += `\n2FA: ${c.twoFactorKey}`;
                    if (c.keyweb) t += `\nKeyweb: ${c.keyweb}`;
                    return t;
                  })
                  .join("\n\n---\n\n");
                copyVal(text, `ord-all-${ord.orderId}`);
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              {copiedKey === `ord-all-${ord.orderId}` ? "✓ Copied All" : "📋 Copy All"}
            </button>
          </div>
        )}

        {deliveredList.map((cred, cIdx) => {
          const credKey = `${ord.orderId}-${cIdx}`;
          const isEmailPwdRevealed =
            revealedOrderEmailCreds.has(credKey) ||
            revealedOrderCreds.has(credKey) ||
            (cIdx === 0 && (revealedOrderEmailCreds.has(ord.orderId) || revealedOrderCreds.has(ord.orderId)));
          const isDiscordPwdRevealed =
            revealedOrderDiscordCreds.has(credKey) ||
            (cIdx === 0 && revealedOrderDiscordCreds.has(ord.orderId));
          const isTokRevealed =
            revealedTokens.has(credKey) || (cIdx === 0 && revealedTokens.has(ord.orderId));

          return (
            <div
              key={cIdx}
              className={`rounded-lg p-2 space-y-1.5 text-xs transition-all ${
                deliveredList.length > 1
                  ? "bg-white/[0.04] border border-white/10"
                  : "bg-white/[0.02]"
              }`}
            >
              {deliveredList.length > 1 && (
                <div className="text-[10px] font-bold text-indigo-400">
                  Account #{cIdx + 1}
                </div>
              )}

              {/* Email */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-white/40 text-[11px] w-11 shrink-0 font-medium">Email:</span>
                  <span className="text-white font-semibold truncate select-all">{cred.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyVal(cred.email, `ord-email-${credKey}`)}
                  className="text-white/50 hover:text-white p-1 rounded hover:bg-white/10 transition-colors shrink-0 text-xs cursor-pointer"
                  title="Copy Email"
                >
                  {copiedKey === `ord-email-${credKey}` ? "✓" : "📋"}
                </button>
              </div>

              {/* Email Password */}
              {(cred.emailPassword || cred.password) && (
                <div className="flex items-center justify-between gap-1.5 font-mono">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/40 text-[11px] w-20 shrink-0 font-sans font-medium">Email Pass:</span>
                    <span className="text-white/80 truncate">
                      {isEmailPwdRevealed ? (cred.emailPassword || cred.password) : "••••••••"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleRevealOrderEmailCred(credKey)}
                      className="text-[10px] text-white/60 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {isEmailPwdRevealed ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyVal(cred.emailPassword || cred.password, `ord-epwd-${credKey}`)}
                      className="text-white/50 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer"
                      title="Copy Email Password"
                    >
                      {copiedKey === `ord-epwd-${credKey}` ? "✓" : "📋"}
                    </button>
                  </div>
                </div>
              )}

              {/* Discord Password */}
              {cred.discordPassword && (
                <div className="flex items-center justify-between gap-1.5 font-mono">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/40 text-[11px] w-20 shrink-0 font-sans font-medium">Discord Pass:</span>
                    <span className="text-white/80 truncate">
                      {isDiscordPwdRevealed ? cred.discordPassword : "••••••••"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleRevealOrderDiscordCred(credKey)}
                      className="text-[10px] text-white/60 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {isDiscordPwdRevealed ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyVal(cred.discordPassword, `ord-dpwd-${credKey}`)}
                      className="text-white/50 hover:text-white p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer"
                      title="Copy Discord Password"
                    >
                      {copiedKey === `ord-dpwd-${credKey}` ? "✓" : "📋"}
                    </button>
                  </div>
                </div>
              )}

              {/* Domain */}
              {cred.domain && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <span className="text-white/40 w-11 shrink-0 font-medium">Domain:</span>
                  <span className="truncate">{cred.domain}</span>
                </div>
              )}

              {/* Token */}
              {cred.token && (
                <div className="flex items-center justify-between gap-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/40 w-11 shrink-0 font-sans font-medium">Token:</span>
                    <span className="text-indigo-300 truncate max-w-[120px] sm:max-w-[180px]">
                      {isTokRevealed ? cred.token : "••••••••••••"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleRevealToken(credKey)}
                      className="text-[10px] text-white/60 hover:text-white px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      {isTokRevealed ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyVal(cred.token, `ord-tok-${credKey}`)}
                      className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-white/10 transition-colors text-xs cursor-pointer"
                      title="Copy Token"
                    >
                      {copiedKey === `ord-tok-${credKey}` ? "✓" : "📋"}
                    </button>
                  </div>
                </div>
              )}

              {/* 2FA Key */}
              {cred.twoFactorKey && (
                <div className="flex items-center justify-between gap-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/40 w-11 shrink-0 font-sans font-medium">2FA:</span>
                    <span className="text-amber-400 truncate max-w-[120px] sm:max-w-[180px]">{cred.twoFactorKey}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyVal(cred.twoFactorKey, `ord-2fa-${credKey}`)}
                    className="text-amber-400/80 hover:text-amber-300 p-1 rounded hover:bg-white/10 transition-colors shrink-0 text-xs cursor-pointer"
                    title="Copy 2FA Key"
                  >
                    {copiedKey === `ord-2fa-${credKey}` ? "✓" : "📋"}
                  </button>
                </div>
              )}

              {/* Keyweb */}
              {cred.keyweb && (
                <div className="flex items-center justify-between gap-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white/40 w-11 shrink-0 font-medium">Web:</span>
                    <span className="text-sky-300 truncate max-w-[120px] sm:max-w-[180px]">{cred.keyweb}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyVal(cred.keyweb, `ord-kw-${credKey}`)}
                    className="text-sky-400/80 hover:text-sky-300 p-1 rounded hover:bg-white/10 transition-colors shrink-0 text-xs cursor-pointer"
                    title="Copy Web Key"
                  >
                    {copiedKey === `ord-kw-${credKey}` ? "✓" : "📋"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Login Gate ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#0f131c] text-[#dfe2ee]">
        <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-8 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#262a33] border border-[#31353e] text-2xl shadow-inner mb-1">
              ⚡
            </div>
            <h1 className="text-2xl font-bold text-[#dfe2ee] tracking-tight">
              Trinitymart Admin Portal
            </h1>
            <p className="font-mono text-xs text-[#908fa0] leading-relaxed">
              Enter your master key to oversee orders and live account inventory.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="admin-password-input" className="block font-mono text-xs text-[#908fa0] uppercase tracking-wider mb-2">
                Security Password
              </label>
              <input
                id="admin-password-input"
                type="password"
                value={authInput}
                onChange={(e) => {
                  setAuthInput(e.target.value);
                  setAuthError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password…"
                className={`w-full px-4 py-3 rounded-xl bg-[#0f131c] text-[#dfe2ee] placeholder-[#908fa0]/60 font-mono text-sm outline-none transition-all duration-200 border ${
                  authError
                    ? "border-[#ffb4ab] focus:border-[#ffb4ab] focus:ring-1 focus:ring-[#ffb4ab]"
                    : "border-[#262a33] focus:border-[#8083ff] focus:ring-1 focus:ring-[#8083ff]"
                }`}
              />
              {authError && (
                <p className="mt-2 text-xs text-[#ffb4ab] font-mono flex items-center gap-1">
                  <span>⚠️</span> {authError}
                </p>
              )}
            </div>

            <button
              id="admin-login-btn"
              onClick={handleLogin}
              className="w-full py-3.5 px-4 rounded-xl font-bold font-mono text-xs text-[#0d0096] bg-[#8083ff] hover:bg-[#6366f1] hover:text-white active:scale-[0.98] transition-all shadow-lg shadow-[#8083ff]/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>UNLOCK DASHBOARD</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-[#0f131c] text-[#dfe2ee] font-sans antialiased selection:bg-[#6366f1] selection:text-white">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-[#0a0e16]/95 backdrop-blur-xl border-b border-[#262a33]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Brand & Status */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#262a33] border border-[#31353e] flex items-center justify-center text-lg shadow-sm">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-[#dfe2ee] tracking-tight">
                      Trinitymart <span className="text-[#8083ff]">Operations</span>
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#00a572]/20 text-[#4edea3] border border-[#00a572]/30 font-mono text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                      VAULT-EAST-01
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-[#908fa0] hidden sm:block">
                    ENCRYPTION: AES-256-GCM • DISPATCH ENGINE ACTIVE
                  </p>
                </div>
              </div>

              {/* Action Buttons for Mobile */}
              <div className="flex sm:hidden items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    fetchOrders();
                    fetchCredentials();
                  }}
                  disabled={ordersLoading || fetchStatus === "loading"}
                  className="p-2 rounded-lg bg-[#181c24] hover:bg-[#262a33] border border-[#262a33] text-[#dfe2ee] text-xs transition-colors cursor-pointer"
                  title="Refresh Database"
                >
                  <span className={ordersLoading || fetchStatus === "loading" ? "inline-block animate-spin" : ""}>
                    🔄
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/40 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Full width on mobile, auto on desktop) */}
            <div className="flex items-center gap-2">
              <div className="flex w-full sm:w-auto p-1 bg-[#181c24] rounded-xl border border-[#262a33]">
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer font-mono ${
                    tab === "orders"
                      ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-md"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]"
                  }`}
                >
                  <span>Orders &amp; Payments</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === "orders" ? "bg-[#0d0096]/20 text-[#0d0096]" : "bg-[#262a33] text-[#c7c4d7]"
                    }`}
                  >
                    {orders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("products")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer font-mono ${
                    tab === "products"
                      ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-md"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]"
                  }`}
                >
                  <span>Stock &amp; Products</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("coupons")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer font-mono ${
                    tab === "coupons"
                      ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-md"
                      : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]"
                  }`}
                >
                  <span>🎟️ Coupons</span>
                </button>
              </div>

              {/* Action Buttons for Tablet / Desktop */}
              <div className="hidden sm:flex items-center gap-2 ml-2">
                <button
                  type="button"
                  onClick={() => {
                    fetchOrders();
                    fetchCredentials();
                  }}
                  disabled={ordersLoading || fetchStatus === "loading"}
                  className="px-3 py-2 rounded-lg bg-[#181c24] hover:bg-[#262a33] border border-[#262a33] text-[#dfe2ee] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className={ordersLoading || fetchStatus === "loading" ? "inline-block animate-spin" : ""}>
                    🔄
                  </span>
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/40 border border-[#ffb4ab]/30 text-[#ffb4ab] text-xs font-mono font-semibold transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* Metric Summary Cards (2x2 on mobile, 5 columns on tablet/desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg relative overflow-hidden group hover:border-[#8083ff]/40 transition-all">
            <div className="flex items-center justify-between text-[#908fa0] text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider">
              <span>Total Orders</span>
              <span className="text-base sm:text-lg">🧾</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-black font-mono text-[#dfe2ee]">
              {orders.length}
            </p>
            <span className="font-mono text-[10px] text-[#908fa0] block mt-0.5 truncate">
              Recorded in Redis DB
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg relative overflow-hidden group hover:border-[#00a572]/40 transition-all">
            <div className="flex items-center justify-between text-[#4edea3]/80 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider">
              <span>Confirmed</span>
              <span className="text-base sm:text-lg">✅</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-black font-mono text-[#4edea3]">
              {confirmedOrders.length}
            </p>
            <span className="font-mono text-[10px] text-[#4edea3]/70 block mt-0.5 truncate">
              {orders.length > 0
                ? `${Math.round((confirmedOrders.length / orders.length) * 100)}% Conversion`
                : "100% automated"}
            </span>
          </div>

          {/* Email Received & Verified Metric Card */}
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg relative overflow-hidden group hover:border-[#00a572]/40 transition-all">
            <div className="flex items-center justify-between text-[#4edea3]/80 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider">
              <span>Email Received</span>
              <span className="text-base sm:text-lg">📬</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-[#4edea3]">
                {openedOrdersCount}
              </p>
              <span className="font-mono text-[11px] text-[#908fa0] font-semibold truncate">
                / {confirmedOrders.length}
              </span>
            </div>
            <span className="font-mono text-[10px] text-[#4edea3]/70 block mt-0.5 truncate">
              {confirmedOrders.length > 0
                ? `${Math.round((openedOrdersCount / confirmedOrders.length) * 100)}% Delivered & Opened`
                : "Live Open Tracking"}
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg relative overflow-hidden group hover:border-[#8083ff]/40 transition-all">
            <div className="flex items-center justify-between text-[#8083ff] text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider">
              <span>Total Revenue</span>
              <span className="text-base sm:text-lg">💰</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-black font-mono text-[#8083ff]">
              ₹{totalRevenue.toFixed(0)}
            </p>
            <span className="font-mono text-[10px] text-[#c7c4d7] block mt-0.5 truncate">
              ~${totalRevenueUsd.toFixed(2)} USD (UPI &amp; Crypto)
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg relative overflow-hidden group hover:border-[#8083ff]/40 transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[#8083ff] text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider">
              <span>Products &amp; Stock</span>
              <span className="text-base sm:text-lg">🏷️</span>
            </div>
            <button
              type="button"
              onClick={() => setTab("products")}
              className="mt-1.5 text-left w-full cursor-pointer block group-hover:scale-[1.02] transition-transform"
            >
              <p className="text-xl sm:text-2xl md:text-3xl font-black font-mono text-[#8083ff]">
                Products
              </p>
              <span className="font-mono text-[10px] block mt-0.5 truncate text-[#c7c4d7]">
                Manage Inventory &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: ORDERS & TRANSACTIONS ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#181c24] border border-[#262a33] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#908fa0] text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Order ID, customer email, or UTR…"
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 text-xs sm:text-sm font-mono outline-none focus:border-[#8083ff] transition-colors"
                />
                {orderSearch && (
                  <button
                    type="button"
                    onClick={() => setOrderSearch("")}
                    className="absolute inset-y-0 right-2.5 flex items-center text-[#908fa0] hover:text-[#dfe2ee] text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filters & Email Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap">
                {/* Order Status Filters */}
                <div className="flex items-center gap-1 bg-[#0f131c] p-1 rounded-xl border border-[#262a33]">
                  {(["all", "confirmed", "pending", "failed"] as const).map((filterStatus) => (
                    <button
                      key={filterStatus}
                      type="button"
                      onClick={() => setOrderStatusFilter(filterStatus)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                        orderStatusFilter === filterStatus
                          ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-xs"
                          : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]"
                      }`}
                    >
                      {filterStatus}
                    </button>
                  ))}
                </div>

                {/* Email Delivery Status Filter */}
                <div className="flex items-center gap-1 bg-[#0f131c] p-1 rounded-xl border border-[#262a33]">
                  <span className="font-mono text-[10px] font-bold text-[#908fa0] px-1.5 hidden xl:inline uppercase tracking-wider">
                    Email:
                  </span>
                  {(
                    [
                      { id: "all", label: "All" },
                      { id: "opened", label: "👁️ Received" },
                      { id: "sent", label: "✉️ Sent" },
                      { id: "failed", label: "⚠️ Failed" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOrderEmailFilter(f.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        orderEmailFilter === f.id
                          ? "bg-[#00a572]/20 text-[#4edea3] border border-[#00a572]/30 shadow-xs"
                          : "text-[#c7c4d7] hover:text-[#dfe2ee] hover:bg-[#262a33]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders Container */}
            <div className="rounded-2xl bg-[#181c24] border border-[#262a33] shadow-xl overflow-hidden">
              {/* Header with Title and Modern View Mode Switcher */}
              <div className="p-4 sm:p-5 border-b border-[#262a33] bg-[#0a0e16]/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[#dfe2ee]">
                      Customer Orders History
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#8083ff]/15 text-[#8083ff] border border-[#8083ff]/30 font-semibold">
                      {filteredOrders.length} of {orders.length} orders
                    </span>
                  </div>
                  <p className="font-mono text-xs text-[#908fa0] mt-0.5">
                    Zero-scroll navigation • Live status tracking • Instant credential audit
                  </p>
                </div>

                {/* View Mode Switcher: Cards vs Split Inspector vs Contained Table */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0f131c] border border-[#262a33] self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => setOrderViewMode("cards")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      orderViewMode === "cards"
                        ? "bg-[#8083ff] text-[#0d0096] shadow-sm font-black"
                        : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                    }`}
                    title="Modern responsive cards layout (Fits screen, no scrolling right)"
                  >
                    <span>🗂️</span>
                    <span>Cards Feed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOrderViewMode("split");
                      if (!selectedOrderId && filteredOrders.length > 0) {
                        setSelectedOrderId(filteredOrders[0].orderId);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      orderViewMode === "split"
                        ? "bg-[#8083ff] text-[#0d0096] shadow-sm font-black"
                        : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                    }`}
                    title="Split-pane inspector (Queue on left, detailed dossier on right)"
                  >
                    <span>📑</span>
                    <span>Split Inspector</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      orderViewMode === "table"
                        ? "bg-[#8083ff] text-[#0d0096] shadow-sm font-black"
                        : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                    }`}
                    title="Contained table with on-screen scrollbar"
                  >
                    <span>📊</span>
                    <span>Compact Table</span>
                  </button>
                </div>
              </div>

              {ordersLoading ? (
                <div className="py-16 text-center text-[#908fa0] text-sm font-mono">
                  <div className="inline-block w-6 h-6 border-2 border-[#8083ff] border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Loading orders from Upstash Redis…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-16 px-4 text-center space-y-2">
                  <div className="text-4xl">📭</div>
                  <p className="text-base font-bold text-[#dfe2ee]">
                    {orderSearch || orderStatusFilter !== "all"
                      ? "No orders match your filter"
                      : "No orders recorded yet"}
                  </p>
                  <p className="text-xs text-[#908fa0] max-w-sm mx-auto font-mono">
                    {orderSearch || orderStatusFilter !== "all"
                      ? "Try resetting your search query or status filter above."
                      : "When customers generate a payment session, it will appear here instantly."}
                  </p>
                  {(orderSearch || orderStatusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch("");
                        setOrderStatusFilter("all");
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-xs font-mono font-semibold text-[#dfe2ee] transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : orderViewMode === "cards" ? (
                /* ── 1. MODERN CARDS FEED VIEW (NO HORIZONTAL SCROLL REQUIRED) ── */
                <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredOrders.map((ord) => (
                    <div
                      key={ord.orderId}
                      className="rounded-2xl bg-[#0f131c] border border-[#262a33] hover:border-[#31353e] p-4 sm:p-5 shadow-lg transition-all space-y-4 flex flex-col justify-between"
                    >
                      {/* Top Bar: Order ID, Timestamp, Status & Audit Button */}
                      <div className="flex items-start justify-between gap-2.5 pb-3 border-b border-[#262a33]">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-[#8083ff]">
                              #{ord.orderId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyVal(ord.orderId, `card-id-${ord.orderId}`)}
                              className="text-[#908fa0] hover:text-[#dfe2ee] p-1 rounded bg-[#181c24] hover:bg-[#262a33] text-xs cursor-pointer transition-colors"
                              title="Copy Order ID"
                            >
                              {copiedKey === `card-id-${ord.orderId}` ? "✓ Copied" : "📋 Copy"}
                            </button>
                            <span className="text-[11px] font-mono text-[#908fa0]">
                              {new Date(ord.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              at{" "}
                              {new Date(ord.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(ord.status)}
                          <button
                            type="button"
                            onClick={() => {
                              setAuditModalOrder(ord);
                              setResendCustomEmail(ord.email);
                              setResendStatusMsg(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] hover:text-white border border-[#8083ff]/30 text-xs font-mono font-bold cursor-pointer transition-colors shrink-0"
                            title="Audit email delivery and resend credentials"
                          >
                            Audit &amp; Resend
                          </button>
                        </div>
                      </div>

                      {/* Main Details Grid: Customer Email, Amount, Payment UTR, Email Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Customer Email */}
                        <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#908fa0] block">
                            Customer Email
                          </span>
                          <div className="flex items-center justify-between gap-1 font-mono text-[#dfe2ee] font-medium">
                            <span className="truncate select-all">{ord.email}</span>
                            <button
                              type="button"
                              onClick={() => copyVal(ord.email, `card-em-${ord.orderId}`)}
                              className="text-[#908fa0] hover:text-[#dfe2ee] p-0.5 rounded cursor-pointer shrink-0"
                              title="Copy Email"
                            >
                              {copiedKey === `card-em-${ord.orderId}` ? "✓" : "📋"}
                            </button>
                          </div>
                        </div>

                        {/* Amount & Dual Currency */}
                        <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#908fa0] block">
                            Total Order Value
                          </span>
                          <div className="flex items-baseline gap-2 font-mono flex-wrap">
                            <span className="text-base font-extrabold text-[#dfe2ee]">₹{ord.amount}</span>
                            <span className="text-[11px] text-[#908fa0]">
                              (~${((Number(ord.amount) || 0) * inrToUsdRate).toFixed(2)} USD)
                            </span>
                            {ord.quantity && ord.quantity > 1 && (
                              <span className="text-[10px] font-bold text-[#8083ff] bg-[#8083ff]/15 px-1.5 py-0.5 rounded">
                                {ord.quantity}x
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Payment Reference / UTR */}
                        <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#908fa0] block">
                            Bank UTR / Blockchain TxID
                          </span>
                          {ord.utr ? (
                            <div className="flex items-center justify-between gap-1 font-mono text-[#4edea3] font-semibold">
                              <span className="truncate select-all">{ord.utr}</span>
                              <button
                                type="button"
                                onClick={() => copyVal(ord.utr, `card-utr-${ord.orderId}`)}
                                className="text-[#908fa0] hover:text-[#dfe2ee] p-0.5 rounded cursor-pointer shrink-0"
                                title="Copy UTR"
                              >
                                {copiedKey === `card-utr-${ord.orderId}` ? "✓" : "📋"}
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[#908fa0]/60 block">— Pending Verification</span>
                          )}
                        </div>

                        {/* Email Tracking Badge */}
                        <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#908fa0] block">
                            Delivery Telemetry
                          </span>
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <div>{getEmailStatusBadge(ord)}</div>
                            {ord.emailOpenedAt ? (
                              <span className="text-[10px] font-mono text-[#4edea3]">
                                Opened: {new Date(ord.emailOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : ord.emailSentAt ? (
                              <span className="text-[10px] font-mono text-[#908fa0]">
                                Sent: {new Date(ord.emailSentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Delivered Credentials Box */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#908fa0]">
                            Delivered Account &amp; Keys
                          </span>
                          <span className="text-[10px] font-mono text-[#8083ff]">
                            Instant Auto-Assigned
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33]">
                          {renderOrderCredentials(ord)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : orderViewMode === "split" ? (
                /* ── 2. DUAL-PANE MASTER-DETAIL SPLIT INSPECTOR (ZERO HORIZONTAL SCROLL) ── */
                <div className="flex flex-col lg:flex-row min-h-[600px] border-t border-[#262a33]">
                  {/* Left Column: Order Stream Queue */}
                  <div className="w-full lg:w-5/12 xl:w-4/12 max-h-[700px] overflow-y-auto p-3 space-y-2 border-b lg:border-b-0 lg:border-r border-[#262a33] bg-[#0a0e16]/40">
                    <div className="px-2 py-1 text-[11px] font-mono font-bold text-[#908fa0] uppercase tracking-wider">
                      Select Order to Inspect ({filteredOrders.length})
                    </div>
                    {filteredOrders.map((ord) => {
                      const isSelected =
                        (selectedOrderId || filteredOrders[0]?.orderId) === ord.orderId;
                      return (
                        <div
                          key={ord.orderId}
                          onClick={() => setSelectedOrderId(ord.orderId)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? "bg-[#181c24] border-[#8083ff] shadow-md shadow-[#8083ff]/10"
                              : "bg-[#0f131c] border-[#262a33] hover:border-[#31353e] hover:bg-[#181c24]/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-[#8083ff] truncate">
                              #{ord.orderId}
                            </span>
                            <div className="shrink-0">{getStatusBadge(ord.status)}</div>
                          </div>

                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#dfe2ee] truncate max-w-[170px]">
                              {ord.email}
                            </span>
                            <span className="font-bold text-[#dfe2ee]">₹{ord.amount}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-[#908fa0]">
                            <span>
                              {new Date(ord.createdAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <div>{getEmailStatusBadge(ord)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Column: Deep Order Record Inspector */}
                  {(() => {
                    const activeInspect =
                      filteredOrders.find((o) => o.orderId === selectedOrderId) ||
                      filteredOrders[0];
                    if (!activeInspect) {
                      return (
                        <div className="flex-1 flex items-center justify-center p-12 text-[#908fa0] font-mono text-sm">
                          Select an order from the list to view its complete audit details.
                        </div>
                      );
                    }
                    return (
                      <div className="flex-1 max-h-[700px] overflow-y-auto p-5 sm:p-7 space-y-6">
                        {/* Header Dossier */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#262a33] gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-lg font-black text-[#8083ff]">
                                #{activeInspect.orderId}
                              </span>
                              {getStatusBadge(activeInspect.status)}
                              {getEmailStatusBadge(activeInspect)}
                            </div>
                            <p className="font-mono text-xs text-[#908fa0] mt-1">
                              Session Created: {new Date(activeInspect.createdAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAuditModalOrder(activeInspect);
                                setResendCustomEmail(activeInspect.email);
                                setResendStatusMsg(null);
                              }}
                              className="px-4 py-2 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs shadow-md shadow-[#8083ff]/20 transition-all cursor-pointer"
                            >
                              ⚡ Audit &amp; Resend Email
                            </button>
                          </div>
                        </div>

                        {/* Customer & Transaction Breakdown Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#908fa0] block">
                              Buyer Email Address
                            </span>
                            <div className="flex items-center justify-between font-mono text-sm font-semibold text-[#dfe2ee]">
                              <span className="select-all truncate">{activeInspect.email}</span>
                              <button
                                type="button"
                                onClick={() => copyVal(activeInspect.email, `insp-em-${activeInspect.orderId}`)}
                                className="text-[#908fa0] hover:text-[#dfe2ee] p-1 rounded cursor-pointer"
                              >
                                {copiedKey === `insp-em-${activeInspect.orderId}` ? "✓" : "📋"}
                              </button>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#908fa0] block">
                              Dual Currency Billing Total
                            </span>
                            <div className="flex items-baseline gap-2 font-mono">
                              <span className="text-xl font-black text-[#dfe2ee]">₹{activeInspect.amount}</span>
                              <span className="text-xs text-[#908fa0]">
                                (~${((Number(activeInspect.amount) || 0) * inrToUsdRate).toFixed(2)} USD)
                              </span>
                              {activeInspect.quantity && activeInspect.quantity > 1 && (
                                <span className="text-xs font-bold text-[#8083ff] bg-[#8083ff]/15 px-2 py-0.5 rounded">
                                  {activeInspect.quantity} Units
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#908fa0] block">
                              Payment Gateway Reference (UTR / TxID)
                            </span>
                            {activeInspect.utr ? (
                              <div className="flex items-center justify-between font-mono text-sm text-[#4edea3] font-semibold">
                                <span className="select-all truncate">{activeInspect.utr}</span>
                                <button
                                  type="button"
                                  onClick={() => copyVal(activeInspect.utr, `insp-utr-${activeInspect.orderId}`)}
                                  className="text-[#908fa0] hover:text-[#dfe2ee] p-1 rounded cursor-pointer"
                                >
                                  {copiedKey === `insp-utr-${activeInspect.orderId}` ? "✓" : "📋"}
                                </button>
                              </div>
                            ) : (
                              <span className="font-mono text-xs text-[#908fa0]/60">— No UTR submitted yet</span>
                            )}
                          </div>

                          <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase text-[#908fa0] block">
                              Email Delivery Timeline
                            </span>
                            <div className="font-mono text-xs space-y-1">
                              {activeInspect.emailOpenedAt ? (
                                <div className="text-[#4edea3]">
                                  ✓ Customer opened email on {new Date(activeInspect.emailOpenedAt).toLocaleString()}
                                </div>
                              ) : activeInspect.emailSentAt ? (
                                <div className="text-[#908fa0]">
                                  ✉️ Dispatched at {new Date(activeInspect.emailSentAt).toLocaleTimeString()}
                                </div>
                              ) : (
                                <div className="text-[#908fa0]/60">Email pending dispatch</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Complete Credentials Display */}
                        <div className="space-y-2">
                          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#8083ff]">
                            Delivered Account Credentials Payload
                          </h3>
                          <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33]">
                            {renderOrderCredentials(activeInspect)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ── 3. FIXED CONTAINED TABLE VIEW (ON-SCREEN SCROLLBAR, NEVER SCROLL DOWN 2000PX) ── */
                <div className="max-h-[580px] overflow-auto scrollbar-thin">
                  <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#0a0e16] border-b border-[#262a33] z-10 shadow-sm">
                      <tr className="text-[#908fa0] font-mono font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Email Receipt</th>
                        <th className="py-3 px-4">Bank UTR / Tx</th>
                        <th className="py-3 px-4">Delivered Accounts</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#262a33]/60 bg-[#181c24]/50">
                      {filteredOrders.map((ord) => (
                        <tr key={ord.orderId} className="hover:bg-[#262a33]/30 transition-colors">
                          {/* Order ID */}
                          <td className="py-3.5 px-4 font-mono text-[#8083ff] font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>#{ord.orderId}</span>
                              <button
                                type="button"
                                onClick={() => copyVal(ord.orderId, `ord-id-tbl-${ord.orderId}`)}
                                className="text-[#908fa0] hover:text-[#dfe2ee] p-1 rounded hover:bg-[#262a33] cursor-pointer"
                                title="Copy Order ID"
                              >
                                {copiedKey === `ord-id-tbl-${ord.orderId}` ? "✓" : "📋"}
                              </button>
                            </div>
                          </td>

                          {/* Customer Email */}
                          <td className="py-3.5 px-4 font-mono font-medium text-[#dfe2ee] max-w-[180px] truncate select-all">
                            {ord.email}
                          </td>

                          {/* Amount (Dual Currency) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold font-mono text-[#dfe2ee] text-sm">₹{ord.amount}</div>
                            <div className="text-[10px] font-mono text-[#908fa0]">
                              ~${((Number(ord.amount) || 0) * inrToUsdRate).toFixed(2)} USD
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(ord.status)}
                          </td>

                          {/* Email Receipt Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              {getEmailStatusBadge(ord)}
                              {ord.emailOpenedAt && (
                                <span className="text-[10px] text-[#4edea3] font-mono">
                                  Opened: {new Date(ord.emailOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Bank UTR */}
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                            {ord.utr ? (
                              <div className="flex items-center gap-1.5 text-[#4edea3] font-semibold">
                                <span>{ord.utr}</span>
                                <button
                                  type="button"
                                  onClick={() => copyVal(ord.utr, `ord-utr-tbl-${ord.orderId}`)}
                                  className="text-[#908fa0] hover:text-[#dfe2ee] p-0.5 rounded cursor-pointer"
                                >
                                  {copiedKey === `ord-utr-tbl-${ord.orderId}` ? "✓" : "📋"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[#908fa0]/60">—</span>
                            )}
                          </td>

                          {/* Delivered Account */}
                          <td className="py-3.5 px-4 min-w-[240px] max-w-[320px]">
                            {renderOrderCredentials(ord)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setAuditModalOrder(ord);
                                setResendCustomEmail(ord.email);
                                setResendStatusMsg(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] hover:text-white border border-[#8083ff]/30 text-xs font-mono font-bold cursor-pointer transition-colors"
                            >
                              Audit / Resend
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: CUSTOM PRODUCTS MANAGEMENT ── */}
        {tab === "products" && (
          <AdminProductsManager adminPassword={password} />
        )}

        {/* ── TAB 4: PROMO COUPONS MANAGEMENT ── */}
        {tab === "coupons" && (
          <AdminCouponsManager adminPassword={password} />
        )}
      </main>

      {/* ── EMAIL RECEIPT & AUDIT MODAL DIALOG ── */}
      {auditModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setAuditModalOrder(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#181c24] border border-[#262a33] p-5 sm:p-7 shadow-2xl space-y-5 text-[#dfe2ee] text-xs scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#262a33] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📬</span>
                  <h3 className="text-base sm:text-lg font-bold text-[#dfe2ee] tracking-tight">
                    Email Delivery &amp; Receipt Audit
                  </h3>
                </div>
                <p className="font-mono text-xs text-[#908fa0]">
                  Verify whether the customer received, opened, or confirmed their credentials email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOrder(null)}
                className="w-8 h-8 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#908fa0] hover:text-[#dfe2ee] flex items-center justify-center text-sm cursor-pointer transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Current Receipt Status Highlight Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                  ? "bg-[#00a572]/15 border-[#00a572]/40 text-[#4edea3]"
                  : auditModalOrder.emailStatus === "failed"
                  ? "bg-[#93000a]/20 border-[#ffb4ab]/30 text-[#ffb4ab]"
                  : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                  ? "bg-[#8083ff]/15 border-[#8083ff]/30 text-[#8083ff]"
                  : "bg-[#0f131c] border-[#262a33] text-[#c7c4d7]"
              }`}
            >
              <div className="text-2xl shrink-0 mt-0.5">
                {auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                  ? "✅"
                  : auditModalOrder.emailStatus === "failed"
                  ? "❌"
                  : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                  ? "✉️"
                  : "⏳"}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <div className="font-bold text-sm text-[#dfe2ee]">
                  {auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                    ? "Email Delivered & Received by Customer"
                    : auditModalOrder.emailStatus === "failed"
                    ? "Email Delivery Failed"
                    : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                    ? "Email Dispatched — Awaiting Customer Open"
                    : "Payment Pending — Email Not Sent"}
                </div>
                <p className="text-xs opacity-80 leading-relaxed font-mono">
                  {auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                    ? `The customer opened this email${
                        auditModalOrder.emailOpenCount && auditModalOrder.emailOpenCount > 1
                          ? ` ${auditModalOrder.emailOpenCount} times`
                          : ""
                      }${
                        auditModalOrder.emailConfirmedManually
                          ? " and verified receipt via the web confirmation portal"
                          : " (detected by email open tracking pixel)"
                      }.`
                    : auditModalOrder.emailStatus === "failed"
                    ? `Error: ${auditModalOrder.emailError || "SMTP server failed to deliver"}`
                    : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                    ? "The credentials were submitted to Gmail SMTP and delivered to the customer mailbox. Tracking pixel is awaiting customer open."
                    : "Email will be automatically sent when payment is confirmed."}
                </p>
              </div>
            </div>

            {/* Audit Diagnostics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Order ID */}
              <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">Order ID</span>
                <span className="font-mono text-[#8083ff] text-xs font-semibold">{auditModalOrder.orderId}</span>
              </div>

              {/* Customer Email */}
              <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">Recipient Email</span>
                  <button
                    type="button"
                    onClick={() => copyVal(auditModalOrder.email, "audit-email")}
                    className="font-mono text-[10px] text-[#908fa0] hover:text-[#dfe2ee] cursor-pointer"
                  >
                    {copiedKey === "audit-email" ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <span className="font-mono font-medium text-[#dfe2ee] text-xs truncate block select-all">{auditModalOrder.email}</span>
              </div>

              {/* Email Sent At */}
              <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">Dispatched via SMTP</span>
                <span className="font-mono text-[#c7c4d7] text-xs">
                  {auditModalOrder.emailSentAt
                    ? new Date(auditModalOrder.emailSentAt).toLocaleString()
                    : auditModalOrder.status === "confirmed"
                    ? "Yes (Automated)"
                    : "Not sent"}
                </span>
                {auditModalOrder.emailResentCount ? (
                  <span className="font-mono text-[10px] text-[#8083ff] block font-semibold">
                    Resent {auditModalOrder.emailResentCount} time(s)
                  </span>
                ) : null}
              </div>

              {/* Email Opened At */}
              <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">First Opened / Received</span>
                <span className="font-mono text-[#c7c4d7] text-xs">
                  {auditModalOrder.emailOpenedAt
                    ? new Date(auditModalOrder.emailOpenedAt).toLocaleString()
                    : "Awaiting open detection"}
                </span>
                {auditModalOrder.emailLastOpenedAt && auditModalOrder.emailLastOpenedAt !== auditModalOrder.emailOpenedAt ? (
                  <span className="text-[10px] text-[#4edea3] block font-mono">
                    Last: {new Date(auditModalOrder.emailLastOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>

              {/* Message ID */}
              {auditModalOrder.emailMessageId && (
                <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1 col-span-1 sm:col-span-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">SMTP Message ID</span>
                  <span className="font-mono text-[11px] text-[#908fa0] break-all select-all">
                    {auditModalOrder.emailMessageId}
                  </span>
                </div>
              )}

              {/* Client User Agent (Device) */}
              {auditModalOrder.emailClientUserAgent && (
                <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1 col-span-1 sm:col-span-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">Email Client / Proxy Device</span>
                  <span className="font-mono text-[10px] text-[#908fa0] break-all">
                    {auditModalOrder.emailClientUserAgent}
                  </span>
                </div>
              )}
            </div>

            {/* Resend Action Form */}
            <div className="p-4 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#dfe2ee] flex items-center gap-1.5 font-mono">
                  <span>✉️</span> Resend Credentials Email
                </span>
                <span className="font-mono text-[10px] text-[#908fa0]">
                  Deliver immediately with live tracking pixel
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="email"
                  value={resendCustomEmail}
                  onChange={(e) => setResendCustomEmail(e.target.value)}
                  placeholder="Recipient email address…"
                  className="flex-1 px-3.5 py-2 rounded-lg bg-[#181c24] border border-[#262a33] text-[#dfe2ee] text-xs font-mono placeholder-[#908fa0]/60 outline-none focus:border-[#8083ff] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleResendEmail(auditModalOrder.orderId, resendCustomEmail)}
                  disabled={resendingEmail || !resendCustomEmail.trim()}
                  className="px-4 py-2 rounded-lg font-bold font-mono text-xs bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#8083ff]/20 shrink-0"
                >
                  {resendingEmail ? (
                    <>
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>📧 Resend Now</span>
                    </>
                  )}
                </button>
              </div>

              {resendStatusMsg && (
                <div
                  className={`text-xs p-2.5 rounded-lg flex items-center gap-2 font-mono ${
                    resendStatusMsg.type === "success"
                      ? "bg-[#00a572]/20 border border-[#00a572]/30 text-[#4edea3]"
                      : "bg-[#93000a]/20 border border-[#ffb4ab]/30 text-[#ffb4ab]"
                  }`}
                >
                  <span>{resendStatusMsg.type === "success" ? "✅" : "⚠️"}</span>
                  <span>{resendStatusMsg.text}</span>
                </div>
              )}
            </div>

            {/* Secondary Actions: Manual Override & Direct Links */}
            <div className="space-y-2 pt-1 border-t border-[#262a33]">
              <span className="font-mono text-[10px] uppercase font-bold text-[#908fa0] block">
                Verification Tools &amp; Manual Override
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* Toggle Manual Confirmation */}
                <button
                  type="button"
                  onClick={() =>
                    handleToggleManualReceipt(
                      auditModalOrder.orderId,
                      !(auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened")
                    )
                  }
                  disabled={togglingManualReceipt}
                  className={`px-3 py-2 rounded-lg font-mono font-semibold text-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                      ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300"
                      : "bg-[#00a572]/20 hover:bg-[#00a572]/30 border-[#00a572]/30 text-[#4edea3]"
                  }`}
                >
                  {togglingManualReceipt ? (
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened" ? (
                    "↩️ Mark as Unopened"
                  ) : (
                    "✅ Mark Received Manually"
                  )}
                </button>

                {/* Copy Receipt Link */}
                <button
                  type="button"
                  onClick={() => {
                    const confirmUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/track-email/confirm?orderId=${encodeURIComponent(auditModalOrder.orderId)}`;
                    copyVal(confirmUrl, `audit-conf-${auditModalOrder.orderId}`);
                  }}
                  className="px-3 py-2 rounded-lg font-mono font-semibold text-xs bg-[#262a33] hover:bg-[#31353e] border border-[#31353e] text-[#dfe2ee] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedKey === `audit-conf-${auditModalOrder.orderId}` ? "✓ Link Copied" : "🔗 Copy Web Receipt Link"}
                </button>

                {/* Open Confirmation Page in New Tab (Test) */}
                <a
                  href={`/api/track-email/confirm?orderId=${encodeURIComponent(auditModalOrder.orderId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg font-mono font-semibold text-xs bg-[#262a33] hover:bg-[#31353e] border border-[#31353e] text-[#dfe2ee] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  ↗️ Open Web Voucher
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
