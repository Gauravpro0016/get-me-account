"use client";

import { useState, useEffect, useCallback } from "react";

type Credential = {
  id: string;
  email: string;
  password: string;
  addedAt: string;
};

type Status = "idle" | "loading" | "error" | "success";

export default function AdminPage() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [authInput, setAuthInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // ── Credential pool state ────────────────────────────────────────────────
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [fetchStatus, setFetchStatus] = useState<Status>("idle");

  // ── Add form state ───────────────────────────────────────────────────────
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addStatus, setAddStatus] = useState<Status>("idle");
  const [addError, setAddError] = useState("");

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Visible passwords in table ───────────────────────────────────────────
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

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
    // Verify against the API
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
      setCredentials(data.credentials);
      setFetchStatus("success");
    } catch {
      setFetchStatus("error");
    }
  }, [password]);

  useEffect(() => {
    if (authenticated) fetchCredentials();
  }, [authenticated, fetchCredentials]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) {
      setAddError("Both email and password are required.");
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
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword.trim() }),
      });
      if (!res.ok) throw new Error("Add failed");
      setNewEmail("");
      setNewPassword("");
      setAddStatus("success");
      await fetchCredentials();
      setTimeout(() => setAddStatus("idle"), 2000);
    } catch {
      setAddStatus("error");
      setAddError("Failed to add credential. Try again.");
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleLogout = () => {
    sessionStorage.removeItem("adminPwd");
    setAuthenticated(false);
    setPassword("");
    setAuthInput("");
    setCredentials([]);
  };

  // ── Login Gate ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "24px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🛡️</div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "26px", fontWeight: 700, letterSpacing: "-0.5px" }}>
              Admin Panel
            </h1>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
              Enter your admin password to continue
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              id="admin-password-input"
              type="password"
              value={authInput}
              onChange={(e) => { setAuthInput(e.target.value); setAuthError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin password"
              style={{
                width: "100%",
                padding: "14px 18px",
                borderRadius: "12px",
                border: authError ? "1.5px solid #f87171" : "1.5px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                transition: "border 0.2s",
              }}
            />
            {authError && (
              <p style={{ margin: "-8px 0 0", color: "#f87171", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚠️ {authError}
              </p>
            )}
            <button
              id="admin-login-btn"
              onClick={handleLogin}
              style={{
                padding: "14px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
                transition: "opacity 0.2s, transform 0.1s",
                boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              Unlock Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.2)",
        backdropFilter: "blur(12px)",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "28px" }}>🛡️</span>
          <div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "20px", fontWeight: 700 }}>Admin Panel</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Credential Pool Manager</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            background: credentials.length === 0 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
            border: `1px solid ${credentials.length === 0 ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
            borderRadius: "24px",
            padding: "6px 16px",
            color: credentials.length === 0 ? "#f87171" : "#34d399",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            {credentials.length === 0 ? "⚠️ Pool Empty" : `✅ ${credentials.length} credential${credentials.length !== 1 ? "s" : ""} available`}
          </div>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.6)",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px" }}>

        {/* Add Credential Card */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "32px",
          marginBottom: "28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <h2 style={{ margin: "0 0 6px", color: "#fff", fontSize: "18px", fontWeight: 700 }}>
            ➕ Add Credential
          </h2>
          <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.45)", fontSize: "13px" }}>
            Add an account email &amp; password to the delivery pool. It will be sent to the next buyer automatically.
          </p>

          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="cred-email" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Account Email
                </label>
                <input
                  id="cred-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setAddError(""); }}
                  placeholder="account@example.com"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.07)",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border 0.2s",
                  }}
                  onFocus={(e) => (e.target.style.border = "1.5px solid rgba(99,102,241,0.7)")}
                  onBlur={(e) => (e.target.style.border = "1.5px solid rgba(255,255,255,0.12)")}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="cred-password" style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Account Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="cred-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setAddError(""); }}
                    placeholder="Password123!"
                    style={{
                      width: "100%",
                      padding: "12px 44px 12px 16px",
                      borderRadius: "10px",
                      border: "1.5px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.07)",
                      color: "#fff",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.border = "1.5px solid rgba(99,102,241,0.7)")}
                    onBlur={(e) => (e.target.style.border = "1.5px solid rgba(255,255,255,0.12)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "16px",
                      padding: 0,
                    }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            </div>

            {addError && (
              <p style={{ margin: 0, color: "#f87171", fontSize: "13px" }}>⚠️ {addError}</p>
            )}

            <button
              id="add-credential-btn"
              type="submit"
              disabled={addStatus === "loading"}
              style={{
                padding: "13px 28px",
                borderRadius: "10px",
                border: "none",
                background: addStatus === "success"
                  ? "linear-gradient(135deg, #059669, #10b981)"
                  : "linear-gradient(135deg, #6366f1, #7c3aed)",
                color: "#fff",
                fontWeight: 700,
                fontSize: "14px",
                cursor: addStatus === "loading" ? "not-allowed" : "pointer",
                alignSelf: "flex-start",
                opacity: addStatus === "loading" ? 0.7 : 1,
                transition: "all 0.3s",
                boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
              }}
            >
              {addStatus === "loading" ? "Adding…" : addStatus === "success" ? "✓ Added!" : "Add to Pool"}
            </button>
          </form>
        </div>

        {/* Credentials Table Card */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          <div style={{
            padding: "24px 32px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "18px", fontWeight: 700 }}>📋 Credential Pool</h2>
              <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Credentials are delivered in order (top → bottom) and auto-removed after delivery.
              </p>
            </div>
            <button
              id="refresh-btn"
              onClick={fetchCredentials}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.6)",
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              ↻ Refresh
            </button>
          </div>

          {fetchStatus === "loading" && (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Loading credentials…</p>
            </div>
          )}

          {fetchStatus !== "loading" && credentials.length === 0 && (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <p style={{ margin: "0 0 6px", color: "#fff", fontSize: "16px", fontWeight: 600 }}>Pool is Empty</p>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Add credentials above so they can be delivered to buyers.
              </p>
            </div>
          )}

          {credentials.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.2)" }}>
                    {["#", "Account Email", "Password", "Added At", "Action"].map((h) => (
                      <th key={h} style={{
                        padding: "12px 20px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((cred, idx) => (
                    <tr
                      key={cred.id}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 20px", color: "rgba(255,255,255,0.35)", fontSize: "13px", fontWeight: 600, width: "40px" }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "14px 20px", color: "#e0e7ff", fontSize: "14px", fontFamily: "monospace" }}>
                        {cred.email}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#e0e7ff", fontSize: "14px", fontFamily: "monospace", letterSpacing: revealedIds.has(cred.id) ? 0 : "2px" }}>
                            {revealedIds.has(cred.id) ? cred.password : "••••••••"}
                          </span>
                          <button
                            onClick={() => toggleReveal(cred.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "rgba(255,255,255,0.3)",
                              fontSize: "13px",
                              padding: "2px 4px",
                              transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                            title={revealedIds.has(cred.id) ? "Hide" : "Reveal"}
                          >
                            {revealedIds.has(cred.id) ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "14px 20px", color: "rgba(255,255,255,0.4)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {new Date(cred.addedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <button
                          id={`delete-btn-${cred.id}`}
                          onClick={() => handleDelete(cred.id)}
                          disabled={deletingId === cred.id}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            border: "1px solid rgba(239,68,68,0.35)",
                            background: "rgba(239,68,68,0.1)",
                            color: "#f87171",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: deletingId === cred.id ? "not-allowed" : "pointer",
                            opacity: deletingId === cred.id ? 0.5 : 1,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => { if (deletingId !== cred.id) { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)"; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.35)"; }}
                        >
                          {deletingId === cred.id ? "Removing…" : "🗑️ Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info banner */}
        <div style={{
          marginTop: "24px",
          padding: "16px 24px",
          borderRadius: "14px",
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
        }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>ℹ️</span>
          <p style={{ margin: 0, color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: "1.6" }}>
            <strong style={{ color: "rgba(255,255,255,0.8)" }}>How delivery works:</strong> When a buyer completes payment, the topmost credential is claimed and emailed to them — then permanently removed from this pool. If the pool is empty when someone pays, they will see an error and you should contact them manually.
          </p>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  );
}
