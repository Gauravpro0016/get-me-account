"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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
};

type Status = "idle" | "loading" | "error" | "success";

export default function AdminPage() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // ── Navigation Tab ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<"orders" | "stock">("orders");

  // ── Search & Filter state ────────────────────────────────────────────────
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | "confirmed" | "pending" | "failed">("all");
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

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus =
        orderStatusFilter === "all" ||
        (orderStatusFilter === "failed" ? o.status === "failed" || o.status === "expired" : o.status === orderStatusFilter);

      if (!matchesStatus) return false;

      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase().trim();
      const matchId = o.orderId.toLowerCase().includes(q);
      const matchEmail = o.email.toLowerCase().includes(q);
      const matchUtr = o.utr ? o.utr.toLowerCase().includes(q) : false;
      return matchId || matchEmail || matchUtr;
    });
  }, [orders, orderStatusFilter, orderSearch]);

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
                  <span>🧾 Orders</span>
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
                  onClick={() => setTab("stock")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    tab === "stock"
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span>📦 Stock Pool</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      tab === "stock"
                        ? "bg-white/20 text-white"
                        : credentials.length > 0
                        ? "bg-sky-500/20 text-sky-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {credentials.length}
                  </span>
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
        {/* Metric Summary Cards (2x2 on mobile, 4 columns on tablet/desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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

          <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-lg relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-sky-400/70 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              <span>Available Stock</span>
              <span className="text-base sm:text-lg">📦</span>
            </div>
            <p
              className={`mt-1.5 text-xl sm:text-2xl md:text-3xl font-extrabold ${
                credentials.length > 0 ? "text-sky-400" : "text-red-400"
              }`}
            >
              {credentials.length}
            </p>
            <span
              className={`text-[10px] block mt-0.5 truncate ${
                credentials.length > 0 ? "text-sky-400/60" : "text-red-400/60 font-semibold"
              }`}
            >
              {credentials.length > 0 ? "Ready for instant delivery" : "⚠️ Needs Restock"}
            </span>
          </div>
        </div>

        {/* ── TAB 1: ORDERS & TRANSACTIONS ── */}
        {tab === "orders" && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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

              {/* Status Filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {(["all", "confirmed", "pending", "failed"] as const).map((filterStatus) => (
                  <button
                    key={filterStatus}
                    type="button"
                    onClick={() => setOrderStatusFilter(filterStatus)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                      orderStatusFilter === filterStatus
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white/5 hover:bg-white/10 text-white/60"
                    }`}
                  >
                    {filterStatus}
                  </button>
                ))}
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
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-white/45 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
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

        {/* ── TAB 2: CREDENTIAL STOCK POOL ── */}
        {tab === "stock" && (
          <div className="space-y-6">
            {/* Add Credential Card */}
            <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>➕ Add Accounts to Stock Pool</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Credentials are held in Upstash Redis and automatically dispensed to buyers upon payment.
                  </p>
                </div>

                {/* Single Form vs Bulk Mode Toggle */}
                <div className="flex p-1 bg-white/[0.06] rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !bulkMode
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Single Account
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      bulkMode
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    ⚡ Bulk Paste
                  </button>
                </div>
              </div>

              {!bulkMode ? (
                /* Single Form: Responsive Grid (1 col on mobile, 2 cols on tablet/desktop) */
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="cred-email" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                        Account Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="cred-email"
                        type="text"
                        value={newEmail}
                        onChange={(e) => {
                          setNewEmail(e.target.value);
                          setAddError("");
                        }}
                        placeholder="account@domain.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Email Password */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="cred-email-password" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                          Email Password <span className="text-red-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowEmailPassword(!showEmailPassword)}
                          className="text-[11px] text-white/40 hover:text-white cursor-pointer"
                        >
                          {showEmailPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        id="cred-email-password"
                        type={showEmailPassword ? "text" : "password"}
                        value={newEmailPassword}
                        onChange={(e) => {
                          setNewEmailPassword(e.target.value);
                          setAddError("");
                        }}
                        placeholder="Mailbox / Webmail password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Discord Password */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="cred-discord-password" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                          Discord Password <span className="text-red-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowDiscordPassword(!showDiscordPassword)}
                          className="text-[11px] text-white/40 hover:text-white cursor-pointer"
                        >
                          {showDiscordPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        id="cred-discord-password"
                        type={showDiscordPassword ? "text" : "password"}
                        value={newDiscordPassword}
                        onChange={(e) => {
                          setNewDiscordPassword(e.target.value);
                          setAddError("");
                        }}
                        placeholder="Discord account password"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Token */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="cred-token" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                          Account Token (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="text-[11px] text-white/40 hover:text-white cursor-pointer"
                        >
                          {showToken ? "Hide" : "Show"}
                        </button>
                      </div>
                      <input
                        id="cred-token"
                        type={showToken ? "text" : "password"}
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder="mfa.ab12cd34…"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Domain */}
                    <div className="space-y-1.5">
                      <label htmlFor="cred-domain" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                        Domain (Optional)
                      </label>
                      <input
                        id="cred-domain"
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        placeholder="e.g. rambler.ru / outlook.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* 2FA Key */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="cred-2fa" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                          2FA Secret Key
                        </label>
                        <span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      </div>
                      <input
                        id="cred-2fa"
                        type="text"
                        value={newTwoFactorKey}
                        onChange={(e) => setNewTwoFactorKey(e.target.value)}
                        placeholder="JBSWY3DPEHPK3PXP"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-amber-400 placeholder-white/30 text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* Webkey */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="cred-keyweb" className="block text-xs font-bold text-white/70 uppercase tracking-wider">
                          Keyweb / Webkey
                        </label>
                        <span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      </div>
                      <input
                        id="cred-keyweb"
                        type="text"
                        value={newKeyweb}
                        onChange={(e) => setNewKeyweb(e.target.value)}
                        placeholder="Web login key or access URL"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sky-400 placeholder-white/30 text-sm outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  {addError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <span>⚠️</span> {addError}
                    </p>
                  )}

                  <button
                    id="add-cred-btn"
                    type="submit"
                    disabled={addStatus === "loading"}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-[0.98] transition-all shadow-md shadow-indigo-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {addStatus === "loading" ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Adding Account…</span>
                      </>
                    ) : addStatus === "success" ? (
                      <span>✅ Account Added!</span>
                    ) : (
                      <span>+ Add Account to Stock</span>
                    )}
                  </button>
                </form>
              ) : (
                /* Bulk Import Form */
                <form onSubmit={handleBulkAdd} className="space-y-3.5">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-white/80 space-y-1">
                    <p className="font-semibold text-indigo-300">Supported formats (one per line):</p>
                    <div className="font-mono text-[11px] text-white/70 space-y-0.5">
                      <div>email:emailPassword:discordPassword</div>
                      <div>email:emailPassword:discordPassword:token:domain:2fakey:keyweb</div>
                      <div>email----emailPassword----discordPassword----token (supports :, |, \t, or ---- delimiters)</div>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => {
                      setBulkText(e.target.value);
                      setBulkMsg("");
                    }}
                    placeholder={`acc1@domain.com:EmailPass123:DiscordPass123:mfa.token123:domain.com:2FAKEY:KEYWEB\nacc2@domain.com:EmailPass456:DiscordPass456:mfa.token456\nacc3@domain.com:Pass789:Pass789`}
                    className="w-full p-3.5 rounded-xl bg-white/[0.06] border border-white/10 text-white placeholder-white/30 text-xs sm:text-sm font-mono outline-none focus:border-indigo-500 transition-colors resize-y"
                  />

                  {bulkMsg && (
                    <p
                      className={`text-xs ${
                        bulkStatus === "error" ? "text-red-400" : "text-emerald-400 font-semibold"
                      }`}
                    >
                      {bulkMsg}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="submit"
                      disabled={bulkStatus === "loading" || !bulkText.trim()}
                      className="px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {bulkStatus === "loading" ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Importing…</span>
                        </>
                      ) : (
                        <span>📥 Import Batch into Pool</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkMode(false)}
                      className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Credential Stock Table & Mobile Cards */}
            <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 shadow-xl overflow-hidden space-y-0">
              <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Active Stock Inventory</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 font-mono text-white/70">
                      {credentials.length} Total
                    </span>
                  </h2>
                  <p className="text-xs text-white/40">
                    Accounts waiting in queue for upcoming customer orders
                  </p>
                </div>

                {/* Stock Search Filter */}
                <div className="relative w-full sm:w-64">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-white/40 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Search stock…"
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/30 text-xs outline-none focus:border-indigo-500 transition-colors"
                  />
                  {stockSearch && (
                    <button
                      type="button"
                      onClick={() => setStockSearch("")}
                      className="absolute inset-y-0 right-2 flex items-center text-white/40 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {credentials.length === 0 ? (
                <div className="py-16 px-4 text-center space-y-2">
                  <div className="text-4xl">⚠️</div>
                  <p className="text-base font-bold text-red-400">Stock Pool is currently empty</p>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    Add account credentials using the form above so customers receive instant fulfillment upon completing payment.
                  </p>
                </div>
              ) : filteredCredentials.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <p className="text-sm font-semibold text-white/70">No stock accounts match "{stockSearch}"</p>
                  <button
                    type="button"
                    onClick={() => setStockSearch("")}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white hover:bg-white/15 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <>
                  {/* ── MOBILE / PHONE VIEW: Stock Cards (block md:hidden) ── */}
                  <div className="block md:hidden p-3.5 space-y-3">
                    {filteredCredentials.map((cred, idx) => (
                      <div
                        key={cred.id}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/10 shadow-md space-y-3"
                      >
                        {/* Header: Queue badge & Delete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {idx === 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse">
                                ⚡ NEXT TO DISPENSE
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-white/50">
                                Queue #{idx + 1}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelete(cred.id)}
                            disabled={deletingId === cred.id}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-colors cursor-pointer"
                            title="Remove account"
                          >
                            {deletingId === cred.id ? "…" : "🗑️ Delete"}
                          </button>
                        </div>

                        {/* Email & Domain */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white text-sm truncate select-all">
                              {cred.email}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyVal(cred.email, `m-cred-email-${cred.id}`)}
                              className="text-white/40 hover:text-white p-1 text-xs shrink-0 cursor-pointer"
                              title="Copy Email"
                            >
                              {copiedKey === `m-cred-email-${cred.id}` ? "✓" : "📋"}
                            </button>
                          </div>
                          {cred.domain && (
                            <span className="text-[11px] text-white/40 block">{cred.domain}</span>
                          )}
                        </div>

                        {/* Email Password */}
                        {(cred.emailPassword || cred.password) && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5 font-mono text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-white/40 font-sans text-[11px]">Email Pass:</span>
                              <span className="text-white/80 truncate">
                                {revealedEmailIds.has(cred.id) ? (cred.emailPassword || cred.password) : "••••••••"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleRevealEmail(cred.id)}
                                className="text-[11px] text-white/50 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                {revealedEmailIds.has(cred.id) ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyVal(cred.emailPassword || cred.password, `m-cred-epwd-${cred.id}`)}
                                className="text-white/50 hover:text-white p-1 rounded text-xs cursor-pointer"
                              >
                                {copiedKey === `m-cred-epwd-${cred.id}` ? "✓" : "📋"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Discord Password */}
                        {cred.discordPassword && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5 font-mono text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-white/40 font-sans text-[11px]">Discord Pass:</span>
                              <span className="text-white/80 truncate">
                                {revealedDiscordIds.has(cred.id) ? cred.discordPassword : "••••••••"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleRevealDiscord(cred.id)}
                                className="text-[11px] text-white/50 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                {revealedDiscordIds.has(cred.id) ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyVal(cred.discordPassword, `m-cred-dpwd-${cred.id}`)}
                                className="text-white/50 hover:text-white p-1 rounded text-xs cursor-pointer"
                              >
                                {copiedKey === `m-cred-dpwd-${cred.id}` ? "✓" : "📋"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Badges for Token, 2FA, Keyweb */}
                        {(cred.token || cred.twoFactorKey || cred.keyweb) && (
                          <div className="space-y-1.5 pt-1 text-xs">
                            {cred.token && (
                              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                                <span className="text-white/40 font-sans text-[10px] uppercase">Token:</span>
                                <div className="flex items-center gap-1 truncate">
                                  <span className="text-indigo-300 truncate max-w-[150px]">
                                    {revealedTokens.has(cred.id) ? cred.token : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealToken(cred.id)}
                                    className="text-[10px] text-white/40 hover:text-white"
                                  >
                                    {revealedTokens.has(cred.id) ? "Hide" : "Show"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.token, `m-cred-tok-${cred.id}`)}
                                    className="text-indigo-400 p-0.5"
                                  >
                                    {copiedKey === `m-cred-tok-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {cred.twoFactorKey && (
                              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                                <span className="text-white/40 font-sans text-[10px] uppercase">2FA:</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-400">{cred.twoFactorKey}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.twoFactorKey, `m-cred-2fa-${cred.id}`)}
                                    className="text-amber-400/80 p-0.5"
                                  >
                                    {copiedKey === `m-cred-2fa-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {cred.keyweb && (
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-white/40 text-[10px] uppercase">Web:</span>
                                <div className="flex items-center gap-1 truncate">
                                  <span className="text-sky-300 truncate max-w-[150px]">{cred.keyweb}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.keyweb, `m-cred-kw-${cred.id}`)}
                                    className="text-sky-400/80 p-0.5"
                                  >
                                    {copiedKey === `m-cred-kw-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-[10px] text-white/30 pt-1 border-t border-white/5">
                          Added: {new Date(cred.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── TABLET / DESKTOP VIEW: Stock Table (hidden md:block) ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.02] text-white/45 font-bold uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Queue</th>
                          <th className="py-3 px-4">Email / Domain</th>
                          <th className="py-3 px-4">Email Pass</th>
                          <th className="py-3 px-4">Discord Pass</th>
                          <th className="py-3 px-4">Token</th>
                          <th className="py-3 px-4">2FA Key</th>
                          <th className="py-3 px-4">Keyweb</th>
                          <th className="py-3 px-4">Added</th>
                          <th className="py-3 px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredCredentials.map((cred, idx) => (
                          <tr key={cred.id} className="hover:bg-white/[0.02] transition-colors">
                            {/* Queue Position */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {idx === 0 ? (
                                <span className="inline-flex items-center gap-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-md px-2 py-0.5 text-[11px] font-bold">
                                  <span>NEXT</span>
                                </span>
                              ) : (
                                <span className="text-white/40 font-mono text-xs">#{idx + 1}</span>
                              )}
                            </td>

                            {/* Email / Domain */}
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-white flex items-center gap-1.5 select-all">
                                <span>{cred.email}</span>
                                <button
                                  type="button"
                                  onClick={() => copyVal(cred.email, `t-cred-email-${cred.id}`)}
                                  className="text-white/30 hover:text-white p-0.5 rounded cursor-pointer"
                                  title="Copy Email"
                                >
                                  {copiedKey === `t-cred-email-${cred.id}` ? "✓" : "📋"}
                                </button>
                              </div>
                              {cred.domain && (
                                <div className="text-[11px] text-white/40">{cred.domain}</div>
                              )}
                            </td>

                            {/* Email Password */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              {cred.emailPassword || cred.password ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white/80">
                                    {revealedEmailIds.has(cred.id)
                                      ? (cred.emailPassword || cred.password)
                                      : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealEmail(cred.id)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Toggle Reveal Email Password"
                                  >
                                    {revealedEmailIds.has(cred.id) ? "🙈" : "👁️"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyVal(cred.emailPassword || cred.password, `t-cred-epwd-${cred.id}`)
                                    }
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Copy Email Password"
                                  >
                                    {copiedKey === `t-cred-epwd-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* Discord Password */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              {cred.discordPassword ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white/80">
                                    {revealedDiscordIds.has(cred.id)
                                      ? cred.discordPassword
                                      : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealDiscord(cred.id)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Toggle Reveal Discord Password"
                                  >
                                    {revealedDiscordIds.has(cred.id) ? "🙈" : "👁️"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.discordPassword, `t-cred-dpwd-${cred.id}`)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                    title="Copy Discord Password"
                                  >
                                    {copiedKey === `t-cred-dpwd-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* Token */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              {cred.token ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-indigo-300 max-w-[120px] truncate">
                                    {revealedTokens.has(cred.id) ? cred.token : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealToken(cred.id)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                  >
                                    {revealedTokens.has(cred.id) ? "🙈" : "👁️"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.token, `t-cred-tok-${cred.id}`)}
                                    className="text-indigo-400 hover:text-indigo-300 p-0.5 rounded cursor-pointer"
                                    title="Copy Token"
                                  >
                                    {copiedKey === `t-cred-tok-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* 2FA Key */}
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              {cred.twoFactorKey ? (
                                <div className="flex items-center gap-1.5 text-amber-400">
                                  <span>{revealed2fa.has(cred.id) ? cred.twoFactorKey : "••••••••"}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleReveal2fa(cred.id)}
                                    className="text-white/40 hover:text-white p-0.5 rounded cursor-pointer"
                                  >
                                    {revealed2fa.has(cred.id) ? "🙈" : "👁️"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.twoFactorKey, `t-cred-2fa-${cred.id}`)}
                                    className="text-amber-400/70 hover:text-amber-300 p-0.5 rounded cursor-pointer"
                                    title="Copy 2FA"
                                  >
                                    {copiedKey === `t-cred-2fa-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* Keyweb */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {cred.keyweb ? (
                                <div className="flex items-center gap-1.5 text-sky-300">
                                  <span className="max-w-[120px] truncate">{cred.keyweb}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyVal(cred.keyweb, `t-cred-kw-${cred.id}`)}
                                    className="text-sky-400/70 hover:text-sky-300 p-0.5 rounded cursor-pointer"
                                    title="Copy Web Key"
                                  >
                                    {copiedKey === `t-cred-kw-${cred.id}` ? "✓" : "📋"}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-white/20">—</span>
                              )}
                            </td>

                            {/* Added Date */}
                            <td className="py-3.5 px-4 text-white/40 whitespace-nowrap">
                              {new Date(cred.addedAt).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                            </td>

                            {/* Delete Action */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleDelete(cred.id)}
                                disabled={deletingId === cred.id}
                                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs transition-colors cursor-pointer"
                                title="Delete account from pool"
                              >
                                {deletingId === cred.id ? "…" : "🗑️"}
                              </button>
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
      </main>
    </div>
  );
}
