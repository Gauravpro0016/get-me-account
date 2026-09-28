"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AdminProductsManager } from "@/components/AdminProductsManager";

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
  const [tab, setTab] = useState<"orders" | "products">("orders");

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
  const confirmedOrders = useMemo(() => orders.filter((o) => o.status === "confirmed"), [orders]);
  const totalRevenue = useMemo(
    () => confirmedOrders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0),
    [confirmedOrders]
  );
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
      <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-[#0c0a21] via-[#1a1640] to-[#110e2e]">
        <div className="w-full max-w-sm sm:max-w-md p-6 sm:p-10 rounded-2xl sm:rounded-3xl bg-white/[0.05] backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-3xl shadow-inner mb-1">
              🛡️
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Admin Portal
            </h1>
            <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
              Enter your master key to oversee orders and live account inventory.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="admin-password-input" className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
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
                className={`w-full px-4 py-3.5 rounded-xl bg-white/[0.06] text-white placeholder-white/30 text-base outline-none transition-all duration-200 border ${
                  authError
                    ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border-white/15 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                }`}
              />
              {authError && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                  <span>⚠️</span> {authError}
                </p>
              )}
            </div>

            <button
              id="admin-login-btn"
              onClick={handleLogin}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Unlock Dashboard</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0c0a21] via-[#1a1640] to-[#110e2e] text-white font-sans antialiased">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-30 bg-[#0c0a21]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Brand & Status */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/15 flex items-center justify-center text-lg shadow-inner">
                  🛡️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Admin Panel
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-white/40 hidden sm:block">
                    Automated Redis Delivery Engine
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
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white text-xs transition-colors cursor-pointer"
                  title="Refresh Database"
                >
                  <span className={ordersLoading || fetchStatus === "loading" ? "inline-block animate-spin" : ""}>
                    🔄
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Full width on mobile, auto on desktop) */}
            <div className="flex items-center gap-2">
              <div className="flex w-full sm:w-auto p-1 bg-white/[0.06] rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setTab("orders")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    tab === "orders"
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>🧾 Orders &amp; Payments</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === "orders" ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                    }`}
                  >
                    {orders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab("products")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    tab === "products"
                      ? "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-600/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>🏷️ Manage Products &amp; Stock</span>
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
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className={ordersLoading || fetchStatus === "loading" ? "inline-block animate-spin" : ""}>
                    🔄
                  </span>
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6">
        {/* Metric Summary Cards (2x2 on mobile, 5 columns on tablet/desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-white/50 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Total Orders</span>
              <span className="text-base sm:text-lg">🧾</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
              {orders.length}
            </p>
            <span className="text-[10px] text-white/40 block mt-0.5 truncate">
              Recorded in Redis
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-emerald-400/70 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Confirmed</span>
              <span className="text-base sm:text-lg">✅</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-400">
              {confirmedOrders.length}
            </p>
            <span className="text-[10px] text-emerald-400/50 block mt-0.5 truncate">
              {orders.length > 0
                ? `${Math.round((confirmedOrders.length / orders.length) * 100)}% Conversion`
                : "100% automated"}
            </span>
          </div>

          {/* Email Received & Verified Metric Card */}
          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-emerald-400/80 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Email Received</span>
              <span className="text-base sm:text-lg">📬</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-300">
                {openedOrdersCount}
              </p>
              <span className="text-[11px] text-white/40 font-semibold truncate">
                / {confirmedOrders.length}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400/70 block mt-0.5 truncate font-medium">
              {confirmedOrders.length > 0
                ? `${Math.round((openedOrdersCount / confirmedOrders.length) * 100)}% Delivered & Opened`
                : "Live Open Tracking"}
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-indigo-400/70 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Total Revenue</span>
              <span className="text-base sm:text-lg">💰</span>
            </div>
            <p className="mt-1.5 text-xl sm:text-2xl md:text-3xl font-extrabold text-indigo-300">
              ₹{totalRevenue.toFixed(0)}
            </p>
            <span className="text-[10px] text-indigo-300/50 block mt-0.5 truncate">
              From completed UPI sales
            </span>
          </div>

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-cyan-500/30 transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-cyan-400/70 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Products &amp; Stock</span>
              <span className="text-base sm:text-lg">🏷️</span>
            </div>
            <button
              type="button"
              onClick={() => setTab("products")}
              className="mt-1.5 text-left w-full cursor-pointer block group-hover:scale-[1.02] transition-transform"
            >
              <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-cyan-400">
                Products
              </p>
              <span className="text-[10px] block mt-0.5 truncate text-cyan-400/60 font-semibold">
                Manage Inventory &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: ORDERS & TRANSACTIONS ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-white/40 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Order ID, customer email, or UTR…"
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm outline-none focus:border-indigo-500 transition-colors"
                />
                {orderSearch && (
                  <button
                    type="button"
                    onClick={() => setOrderSearch("")}
                    className="absolute inset-y-0 right-2.5 flex items-center text-white/40 hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filters & Email Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap">
                {/* Order Status Filters */}
                <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/10">
                  {(["all", "confirmed", "pending", "failed"] as const).map((filterStatus) => (
                    <button
                      key={filterStatus}
                      type="button"
                      onClick={() => setOrderStatusFilter(filterStatus)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                        orderStatusFilter === filterStatus
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {filterStatus}
                    </button>
                  ))}
                </div>

                {/* Email Delivery Status Filter */}
                <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-white/40 px-1.5 hidden xl:inline uppercase tracking-wider">
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
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        orderEmailFilter === f.id
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Orders Container */}
            <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    Customer Orders History
                  </h2>
                  <p className="text-xs text-white/40">
                    Showing {filteredOrders.length} of {orders.length} recorded orders
                  </p>
                </div>
                <span className="text-[11px] text-white/40 font-mono hidden sm:inline-block bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
                  Key: <code>orders_history</code>
                </span>
              </div>

              {ordersLoading ? (
                <div className="py-16 text-center text-white/50 text-sm">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Loading orders from Upstash Redis…</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-16 px-4 text-center space-y-2">
                  <div className="text-4xl">📭</div>
                  <p className="text-base font-bold text-white/80">
                    {orderSearch || orderStatusFilter !== "all"
                      ? "No orders match your filter"
                      : "No orders recorded yet"}
                  </p>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    {orderSearch || orderStatusFilter !== "all"
                      ? "Try resetting your search query or status filter above."
                      : "When customers generate a UPI QR code or complete a payment, it will appear here instantly."}
                  </p>
                  {(orderSearch || orderStatusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch("");
                        setOrderStatusFilter("all");
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* ── MOBILE / PHONE VIEW: Responsive Cards (block md:hidden) ── */}
                  <div className="block md:hidden p-3.5 space-y-3">
                    {filteredOrders.map((ord) => (
                      <div
                        key={ord.orderId}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10 shadow-md space-y-3"
                      >
                        {/* Header: Order ID & Status */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-indigo-400 truncate">
                              #{ord.orderId}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyVal(ord.orderId, `ord-id-${ord.orderId}`)}
                              className="text-white/40 hover:text-white p-1 rounded hover:bg-white/10 text-xs shrink-0 cursor-pointer"
                              title="Copy Order ID"
                            >
                              {copiedKey === `ord-id-${ord.orderId}` ? "✓" : "📋"}
                            </button>
                          </div>
                          <div className="shrink-0">{getStatusBadge(ord.status)}</div>
                        </div>

                        {/* Customer Email & Date */}
                        <div className="flex items-center justify-between text-xs text-white/70">
                          <span className="font-medium text-white truncate max-w-[200px] select-all">
                            {ord.email}
                          </span>
                          <span className="text-[11px] text-white/40 shrink-0">
                            {new Date(ord.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Amount & Bank UTR Pill */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-white/5 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-white/40 block">Amount</span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="text-base font-extrabold text-white">₹{ord.amount}</span>
                              {ord.quantity && ord.quantity > 1 && (
                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                                  {ord.quantity}x Accounts
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-white/40 block">Bank UTR</span>
                            {ord.utr ? (
                              <div className="flex items-center justify-end gap-1 font-mono text-xs text-emerald-400 font-semibold mt-0.5">
                                <span>{ord.utr}</span>
                                <button
                                  type="button"
                                  onClick={() => copyVal(ord.utr, `ord-utr-${ord.orderId}`)}
                                  className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                  title="Copy UTR"
                                >
                                  {copiedKey === `ord-utr-${ord.orderId}` ? "✓" : "📋"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-white/30 mt-0.5 block">—</span>
                            )}
                          </div>
                        </div>

                        {/* Email Delivery & Receipt Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg bg-black/20 border border-white/5 text-xs">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] uppercase font-bold text-white/40 block mb-1">
                              Email Delivery Status
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">{getEmailStatusBadge(ord)}</div>
                            {ord.emailOpenedAt ? (
                              <span className="text-[10px] text-emerald-400/80 font-mono block mt-1">
                                Opened: {new Date(ord.emailOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : ord.emailSentAt ? (
                              <span className="text-[10px] text-white/40 font-mono block mt-1">
                                Sent: {new Date(ord.emailSentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAuditModalOrder(ord);
                              setResendCustomEmail(ord.email);
                              setResendStatusMsg(null);
                            }}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold cursor-pointer transition-colors text-center shrink-0"
                          >
                            Audit &amp; Resend
                          </button>
                        </div>

                        {/* Delivered Credentials */}
                        <div className="pt-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-white/40 block mb-1.5">
                            Delivered Account
                          </span>
                          {renderOrderCredentials(ord)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── TABLET / DESKTOP VIEW: Data Table (hidden md:block) ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-white/45 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Email Receipt</th>
                          <th className="py-3 px-4">Bank UTR</th>
                          <th className="py-3 px-4">Delivered Accounts</th>
                          <th className="py-3 px-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredOrders.map((ord) => (
                          <tr key={ord.orderId} className="hover:bg-white/[0.02] transition-colors">
                            {/* Order ID */}
                            <td className="py-3.5 px-4 font-mono text-indigo-400 font-semibold whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{ord.orderId}</span>
                                <button
                                  type="button"
                                  onClick={() => copyVal(ord.orderId, `ord-id-tbl-${ord.orderId}`)}
                                  className="text-white/30 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                                  title="Copy Order ID"
                                >
                                  {copiedKey === `ord-id-tbl-${ord.orderId}` ? "✓" : "📋"}
                                </button>
                              </div>
                            </td>

                            {/* Customer Email */}
                            <td className="py-3.5 px-4 font-medium text-white max-w-[180px] truncate select-all">
                              {ord.email}
                            </td>

                            {/* Amount */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-bold text-white text-sm">₹{ord.amount}</div>
                              <div className="text-[10px] font-semibold text-white/40">
                                {ord.quantity && ord.quantity > 1 ? `📦 ${ord.quantity}x` : "1x"}
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
                                {ord.emailOpenedAt ? (
                                  <span className="text-[10px] text-emerald-400/80 font-mono flex items-center gap-1">
                                    <span>🕒</span>
                                    <span>
                                      {new Date(ord.emailOpenedAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                                      {new Date(ord.emailOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </span>
                                ) : ord.emailSentAt ? (
                                  <span className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                                    <span>Sent:</span>
                                    <span>
                                      {new Date(ord.emailSentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Bank UTR */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              {ord.utr ? (
                                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                  <span>{ord.utr}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(ord.utr, `ord-utr-tbl-${ord.orderId}`)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Copy UTR"
                                  >
                                    {copiedKey === `ord-utr-tbl-${ord.orderId}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/30">—</span>
                              )}
                            </td>

                            {/* Delivered Account */}
                            <td className="py-3.5 px-4 min-w-[260px] max-w-[340px]">
                              {renderOrderCredentials(ord)}
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-4 text-white/40 whitespace-nowrap">
                              {new Date(ord.createdAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: CUSTOM PRODUCTS MANAGEMENT ── */}
        {tab === "products" && (
          <AdminProductsManager adminPassword={password} />
        )}
      </main>

      {/* ── EMAIL RECEIPT & AUDIT MODAL DIALOG ── */}
      {auditModalOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setAuditModalOrder(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#131033] border border-white/15 p-5 sm:p-7 shadow-2xl space-y-5 text-white text-xs scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📬</span>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Email Delivery &amp; Receipt Audit
                  </h3>
                </div>
                <p className="text-xs text-white/50">
                  Verify whether the customer received, opened, or confirmed their credentials email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOrder(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm cursor-pointer transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Current Receipt Status Highlight Banner */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : auditModalOrder.emailStatus === "failed"
                  ? "bg-red-500/10 border-red-500/30 text-red-200"
                  : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-200"
                  : "bg-white/5 border-white/10 text-white/70"
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
                <div className="font-bold text-sm text-white">
                  {auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                    ? "Email Delivered & Received by Customer"
                    : auditModalOrder.emailStatus === "failed"
                    ? "Email Delivery Failed"
                    : auditModalOrder.emailStatus === "sent" || (auditModalOrder.status === "confirmed" && !auditModalOrder.emailStatus)
                    ? "Email Dispatched — Awaiting Customer Open"
                    : "Payment Pending — Email Not Sent"}
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
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
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 block">Order ID</span>
                <span className="font-mono text-white text-xs font-semibold">{auditModalOrder.orderId}</span>
              </div>

              {/* Customer Email */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-white/40 block">Recipient Email</span>
                  <button
                    type="button"
                    onClick={() => copyVal(auditModalOrder.email, "audit-email")}
                    className="text-[10px] text-white/50 hover:text-white cursor-pointer"
                  >
                    {copiedKey === "audit-email" ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                <span className="font-medium text-white text-xs truncate block select-all">{auditModalOrder.email}</span>
              </div>

              {/* Email Sent At */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 block">Dispatched via SMTP</span>
                <span className="text-white/80 text-xs">
                  {auditModalOrder.emailSentAt
                    ? new Date(auditModalOrder.emailSentAt).toLocaleString()
                    : auditModalOrder.status === "confirmed"
                    ? "Yes (Automated)"
                    : "Not sent"}
                </span>
                {auditModalOrder.emailResentCount ? (
                  <span className="text-[10px] text-indigo-400 block font-semibold">
                    Resent {auditModalOrder.emailResentCount} time(s)
                  </span>
                ) : null}
              </div>

              {/* Email Opened At */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 block">First Opened / Received</span>
                <span className="text-white/80 text-xs">
                  {auditModalOrder.emailOpenedAt
                    ? new Date(auditModalOrder.emailOpenedAt).toLocaleString()
                    : "Awaiting open detection"}
                </span>
                {auditModalOrder.emailLastOpenedAt && auditModalOrder.emailLastOpenedAt !== auditModalOrder.emailOpenedAt ? (
                  <span className="text-[10px] text-emerald-400/80 block font-mono">
                    Last: {new Date(auditModalOrder.emailLastOpenedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : null}
              </div>

              {/* Message ID */}
              {auditModalOrder.emailMessageId && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 col-span-1 sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-white/40 block">SMTP Message ID</span>
                  <span className="font-mono text-[11px] text-white/70 break-all select-all">
                    {auditModalOrder.emailMessageId}
                  </span>
                </div>
              )}

              {/* Client User Agent (Device) */}
              {auditModalOrder.emailClientUserAgent && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 col-span-1 sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-white/40 block">Email Client / Proxy Device</span>
                  <span className="font-mono text-[10px] text-white/60 break-all">
                    {auditModalOrder.emailClientUserAgent}
                  </span>
                </div>
              )}
            </div>

            {/* Resend Action Form */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white flex items-center gap-1.5">
                  <span>✉️</span> Resend Credentials Email
                </span>
                <span className="text-[10px] text-white/40">
                  Deliver immediately with live tracking pixel
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="email"
                  value={resendCustomEmail}
                  onChange={(e) => setResendCustomEmail(e.target.value)}
                  placeholder="Recipient email address…"
                  className="flex-1 px-3.5 py-2 rounded-lg bg-black/40 border border-white/15 text-white text-xs placeholder-white/30 outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleResendEmail(auditModalOrder.orderId, resendCustomEmail)}
                  disabled={resendingEmail || !resendCustomEmail.trim()}
                  className="px-4 py-2 rounded-lg font-bold text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20 shrink-0"
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
                  className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${
                    resendStatusMsg.type === "success"
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/20 border border-red-500/30 text-red-300"
                  }`}
                >
                  <span>{resendStatusMsg.type === "success" ? "✅" : "⚠️"}</span>
                  <span>{resendStatusMsg.text}</span>
                </div>
              )}
            </div>

            {/* Secondary Actions: Manual Override & Direct Links */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <span className="text-[10px] uppercase font-bold text-white/40 block">
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
                  className={`px-3 py-2 rounded-lg font-semibold text-xs border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    auditModalOrder.emailOpened || auditModalOrder.emailStatus === "opened"
                      ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
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
                  className="px-3 py-2 rounded-lg font-semibold text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedKey === `audit-conf-${auditModalOrder.orderId}` ? "✓ Link Copied" : "🔗 Copy Web Receipt Link"}
                </button>

                {/* Open Confirmation Page in New Tab (Test) */}
                <a
                  href={`/api/track-email/confirm?orderId=${encodeURIComponent(auditModalOrder.orderId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg font-semibold text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-colors cursor-pointer flex items-center gap-1.5"
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
