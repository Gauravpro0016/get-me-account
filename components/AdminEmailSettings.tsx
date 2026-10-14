"use client";

import React, { useState, useEffect } from "react";
import { Upload, Sparkles, Send, CheckCircle, AlertCircle, RefreshCw, Eye, ShieldCheck, Mail, ExternalLink, Image as ImageIcon, Key, Lock, Check, HelpCircle } from "lucide-react";

interface AdminEmailSettingsProps {
  adminPassword: string;
}

export function AdminEmailSettings({ adminPassword }: AdminEmailSettingsProps) {
  const [profilePic, setProfilePic] = useState<string>("/admin-profile.jpg");
  const [inputUrl, setInputUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Test email state
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    verifyTimeMs?: number;
    totalTimeMs?: number;
    error?: string;
  } | null>(null);

  // Test Discord state
  const [sendingDiscordTest, setSendingDiscordTest] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    configuredTarget?: string;
  } | null>(null);

  // Preview device toggle
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // SMTP credentials state
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<{ type: "success" | "error"; text: string; details?: string } | null>(null);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);

  // Fetch current admin profile pic and SMTP config on mount
  useEffect(() => {
    fetchProfilePic();
    fetchSmtpConfig();
  }, [adminPassword]);

  const fetchProfilePic = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/profile", {
        headers: {
          "x-admin-password": adminPassword,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profilePic) {
          setProfilePic(data.profilePic);
          setInputUrl(data.profilePic.startsWith("data:") ? "" : data.profilePic);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch admin profile pic:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    setSmtpLoading(true);
    try {
      const res = await fetch("/api/admin/smtp", {
        headers: {
          "x-admin-password": adminPassword,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setSmtpUser(data.user);
        }
        setHasStoredPassword(Boolean(data.hasPassword));
      }
    } catch (err) {
      console.warn("Failed to fetch SMTP config:", err);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSaveSmtp = async () => {
    if (!smtpUser.trim()) {
      setSmtpStatus({ type: "error", text: "Please enter your Gmail address." });
      return;
    }
    if (!smtpPass.trim()) {
      setSmtpStatus({ type: "error", text: "Please enter your 16-character Google App Password." });
      return;
    }

    setSmtpSaving(true);
    setSmtpStatus(null);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ user: smtpUser.trim(), pass: smtpPass.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasStoredPassword(true);
        setSmtpPass("");
        setSmtpStatus({
          type: "success",
          text: `Connected to Google SMTP! Verified & saved for ${data.user}`,
        });
      } else {
        setSmtpStatus({
          type: "error",
          text: data.error || "Failed to authenticate with Google SMTP",
          details: data.details,
        });
      }
    } catch (err) {
      setSmtpStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Network error verifying SMTP",
      });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSaveProfilePic = async (picToSave?: string) => {
    const finalPic = (picToSave !== undefined ? picToSave : inputUrl).trim();
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ profilePic: finalPic }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfilePic(data.profilePic);
        setSaveStatus({
          type: "success",
          text: "Admin profile picture updated successfully! Live emails will now include this avatar.",
        });
      } else {
        throw new Error(data.error || "Failed to save profile picture");
      }
    } catch (err: unknown) {
      setSaveStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Error saving profile picture",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Image file size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfilePic(reader.result);
        setInputUrl("");
        handleSaveProfilePic(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/test-email?password=${encodeURIComponent(adminPassword)}`, {
        headers: {
          "x-admin-password": adminPassword,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || "Test email dispatched successfully!",
          verifyTimeMs: data.verifyTimeMs,
          totalTimeMs: data.totalTimeMs,
        });
      } else {
        throw new Error(data.error || "SMTP test failed");
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Test email failed to send",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const [sendingDiscordType, setSendingDiscordType] = useState<"purchase" | "restock" | null>(null);

  const handleSendTestDiscord = async (type: "purchase" | "restock" = "purchase") => {
    setSendingDiscordTest(true);
    setSendingDiscordType(type);
    setDiscordTestResult(null);
    try {
      const res = await fetch(`/api/admin/test-discord?type=${type}`, {
        headers: {
          "x-admin-password": adminPassword,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDiscordTestResult({
          success: true,
          message: data.message || `Test ${type} notification sent to Discord!`,
          configuredTarget: data.configuredTarget,
        });
      } else {
        throw new Error(data.error || "Discord test failed");
      }
    } catch (err: unknown) {
      setDiscordTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to send test notification to Discord",
      });
    } finally {
      setSendingDiscordTest(false);
      setSendingDiscordType(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ── TOP HERO HEADER ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-r from-[#14192b] via-[#101424] to-[#16122a] border border-[#262a33] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8083ff]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#8083ff]/15 border border-[#8083ff]/30 text-[#8083ff] text-xs font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Email &amp; Discord Dispatch Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#dfe2ee] tracking-tight">
              Admin Profile &amp; Notification Settings
            </h2>
            <p className="text-sm text-[#908fa0] max-w-2xl leading-relaxed">
              Configure your admin profile picture, test automated buyer emails, and verify Discord channel purchase &amp; restock alerts.
            </p>
          </div>

          {/* Action Buttons: Test Purchase + Test Restock + Test Email */}
          <div className="shrink-0 flex flex-wrap sm:flex-nowrap items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSendTestDiscord("purchase")}
              disabled={sendingDiscordTest}
              className="px-3.5 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-[#5865F2]/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Send a sample purchase notification to your Discord server"
            >
              {sendingDiscordTest && sendingDiscordType === "purchase" ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing…</span>
                </>
              ) : (
                <>
                  <span>🛒</span>
                  <span>Test Purchase Alert</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSendTestDiscord("restock")}
              disabled={sendingDiscordTest}
              className="px-3.5 py-2.5 rounded-xl bg-linear-to-r from-[#6366f1] to-[#a855f7] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-[#6366f1]/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Send a sample product restock notification to your Discord server"
            >
              {sendingDiscordTest && sendingDiscordType === "restock" ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing…</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Test Restock Alert</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={sendingTest}
              className="px-4 py-2.5 rounded-xl bg-linear-to-r from-[#06b6d4] via-[#2563eb] to-[#7c3aed] text-white font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-[#06b6d4]/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sendingTest ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Test Email</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Test Status Feedback */}
        {testResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs font-mono flex items-start gap-3 ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            )}
            <div className="space-y-1">
              <p className="font-bold">
                {testResult.success
                  ? "✅ Test Email Dispatched Successfully!"
                  : "❌ Failed to Send Test Email"}
              </p>
              <p className="text-[11px] opacity-90">
                {testResult.message || testResult.error}
              </p>
              {testResult.verifyTimeMs && (
                <p className="text-[10px] opacity-75">
                  SMTP Handshake Latency: {testResult.verifyTimeMs}ms • Total Dispatch Time: {testResult.totalTimeMs}ms
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live Discord Test Status Feedback */}
        {discordTestResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs font-mono flex items-start gap-3 ${
              discordTestResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {discordTestResult.success ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            )}
            <div className="space-y-1">
              <p className="font-bold">
                {discordTestResult.success
                  ? "✅ Test Notification Sent to Discord!"
                  : "❌ Failed to Dispatch Discord Alert"}
              </p>
              <p className="text-[11px] opacity-90">
                {discordTestResult.message || discordTestResult.error}
              </p>
              {discordTestResult.configuredTarget && (
                <p className="text-[10px] opacity-75">
                  Mode: {discordTestResult.configuredTarget}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── GMAIL SMTP AUTHENTICATION & DIAGNOSTICS CARD ── */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[#181c24] border border-[#262a33] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#262a33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#8083ff]/15 text-[#8083ff]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#dfe2ee] font-mono">
                Gmail SMTP Server &amp; App Password Configuration
              </h3>
              <p className="text-xs text-[#908fa0]">
                Used by Nodemailer to dispatch customer delivery receipts &amp; order tracking notifications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-[#908fa0] bg-[#0f131c] px-2.5 py-1 rounded-lg border border-[#262a33]">
              Host: smtp.gmail.com:465
            </span>
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                hasStoredPassword
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {hasStoredPassword ? "● Authenticated" : "○ Needs Password"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono font-bold text-[#c7c4d7] mb-1.5 flex items-center gap-1.5">
              <span>Gmail Address (GMAIL_USER)</span>
            </label>
            <input
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs font-mono text-[#dfe2ee] placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff] transition-all"
            />
            <p className="text-[11px] text-[#908fa0] mt-1">
              The Google account that will send order emails and credentials.
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-[#c7c4d7] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>16-Character Google App Password</span>
              </span>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#8083ff] hover:underline flex items-center gap-0.5"
              >
                <span>Generate App Password</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="text"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={hasStoredPassword ? "•••••••••••••••• (Leave blank to keep current)" : "e.g. qimh ftzp fpid ybta"}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs font-mono text-amber-300 placeholder-[#908fa0]/50 focus:outline-none focus:border-amber-400 transition-all"
            />
            <p className="text-[11px] text-[#908fa0] mt-1">
              Not your normal Google login password! Must be created at Google App Passwords.
            </p>
          </div>
        </div>

        {/* Step-by-Step Google BadCredentials Fix Box */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>Getting error 535-5.7.8 BadCredentials? Here is how to fix it in 30 seconds:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-amber-200/90 leading-relaxed font-mono text-[11px] pl-1">
            <li>
              Log into the exact Gmail account above (<strong>{smtpUser || "your email"}</strong>).
            </li>
            <li>
              Enable <strong>2-Step Verification</strong> at{" "}
              <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline text-amber-300">
                myaccount.google.com/security
              </a>
              . (Google requires 2FA to generate App Passwords).
            </li>
            <li>
              Open{" "}
              <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline text-amber-300 font-bold">
                myaccount.google.com/apppasswords
              </a>
              . Name the app &quot;Trinitymart&quot; and click <strong>Create</strong>.
            </li>
            <li>
              Copy the 16-character code (e.g. <span className="font-bold text-white">abcd efgh ijkl mnop</span>), paste it above, and click <strong>Verify &amp; Save</strong>.
            </li>
          </ol>
        </div>

        {/* Action Button & Status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleSaveSmtp}
            disabled={smtpSaving || !smtpUser.trim() || !smtpPass.trim()}
            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {smtpSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>Verifying with Google SMTP…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-black" />
                <span>Verify &amp; Save Credentials</span>
              </>
            )}
          </button>

          {smtpStatus && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 flex-1 max-w-xl ${
                smtpStatus.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {smtpStatus.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold">{smtpStatus.text}</p>
                {smtpStatus.details && (
                  <p className="text-[10px] opacity-75">{smtpStatus.details}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── GRID: PROFILE PIC MANAGER & FEATURES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Admin Profile Picture Manager (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#262a33]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#8083ff]" />
                <h3 className="text-sm font-bold text-[#dfe2ee] uppercase tracking-wider font-mono">
                  Admin Profile Picture
                </h3>
              </div>
              <span className="text-[10px] text-[#4edea3] font-mono font-bold bg-[#00a572]/15 px-2 py-0.5 rounded border border-[#00a572]/30">
                LIVE IN EMAIL
              </span>
            </div>

            {/* Profile Picture Avatar Preview with Glowing Ring */}
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#0f131c] border border-[#262a33] text-center space-y-3">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-linear-to-tr from-[#06b6d4] via-[#8b5cf6] to-[#ec4899] p-1 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profilePic || "/admin-profile.jpg"}
                    alt="Admin Avatar Preview"
                    className="w-full h-full rounded-full object-cover bg-[#181c24]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/admin-profile.jpg";
                    }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#10b981] border-2 border-[#0f131c] flex items-center justify-center text-white text-xs shadow-md" title="Verified Store Admin">
                  ✓
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#dfe2ee]">Trinitymart Official Dispatcher</h4>
                <p className="text-[11px] font-mono text-[#908fa0]">Store Administrator &bull; Verified ID</p>
              </div>

              <div className="text-[11px] text-[#8083ff] bg-[#8083ff]/10 border border-[#8083ff]/20 px-3 py-1 rounded-full font-mono">
                Embedded directly into customer delivery emails
              </div>
            </div>

            {/* Input URL & Upload Controls */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold text-[#c7c4d7] mb-1.5">
                  Avatar Image URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="Paste image URL (https://...)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs font-mono text-[#dfe2ee] placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (inputUrl.trim()) {
                        setProfilePic(inputUrl.trim());
                        handleSaveProfilePic(inputUrl.trim());
                      }
                    }}
                    disabled={saving || !inputUrl.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#8083ff] text-[#0d0096] text-xs font-bold font-mono hover:bg-[#8083ff]/90 cursor-pointer disabled:opacity-50 transition-all shrink-0"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* File Upload Button */}
                <label className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] border border-[#31353e] text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-[#8083ff]" />
                  <span>Upload Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>

                {/* Reset to Default */}
                <button
                  type="button"
                  onClick={() => {
                    setProfilePic("/admin-profile.jpg");
                    setInputUrl("");
                    handleSaveProfilePic("/admin-profile.jpg");
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#93000a]/15 hover:bg-[#93000a]/30 text-[#ffb4ab] border border-[#ffb4ab]/20 text-xs font-mono font-bold transition-colors cursor-pointer"
                  title="Reset to default cyberpunk emblem avatar"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Save Status Banner */}
            {saveStatus && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  saveStatus.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {saveStatus.type === "success" ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{saveStatus.text}</span>
              </div>
            )}
          </div>

          {/* Email Architecture Features Card */}
          <div className="p-5 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 text-xs">
            <h4 className="font-bold text-[#dfe2ee] uppercase font-mono tracking-wider text-[11px]">
              Gradient Email Enhancements Active
            </h4>
            <div className="space-y-2.5 text-[#908fa0]">
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#0f131c] border border-[#262a33]">
                <span className="text-base">👤</span>
                <div>
                  <strong className="text-[#dfe2ee] block">Admin Profile Picture:</strong>
                  Avatar ring with glowing gradient, official dispatcher badge, and store verification.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#0f131c] border border-[#262a33]">
                <span className="text-base">🎉</span>
                <div>
                  <strong className="text-[#dfe2ee] block">Gradient Thank You Banner:</strong>
                  Warm celebratory header acknowledging buyer and confirming instant automated dispatch.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#0f131c] border border-[#262a33]">
                <span className="text-base">🔑</span>
                <div>
                  <strong className="text-[#dfe2ee] block">Gradient Credentials Cards:</strong>
                  Vibrant cyan/blue badge, high-contrast monospace boxes for Account ID, Password, and 2FA.
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-[#0f131c] border border-[#262a33]">
                <span className="text-base">📄</span>
                <div>
                  <strong className="text-[#dfe2ee] block">Glowing Gradient Invoice Link:</strong>
                  Official invoice summary and glowing button linking to the live web receipt portal.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Email Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-xl space-y-4">
            
            {/* Header with Device Preview Toggle */}
            <div className="flex items-center justify-between pb-3 border-b border-[#262a33]">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#8083ff]" />
                <h3 className="text-sm font-bold text-[#dfe2ee] uppercase tracking-wider font-mono">
                  Live Customer Email Preview
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-[#0f131c] p-1 rounded-xl border border-[#262a33]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    previewDevice === "desktop"
                      ? "bg-[#8083ff] text-[#0d0096]"
                      : "text-[#908fa0] hover:text-[#dfe2ee]"
                  }`}
                >
                  Desktop (600px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    previewDevice === "mobile"
                      ? "bg-[#8083ff] text-[#0d0096]"
                      : "text-[#908fa0] hover:text-[#dfe2ee]"
                  }`}
                >
                  Mobile (380px)
                </button>
              </div>
            </div>

            {/* Email Container Canvas */}
            <div className="p-3 sm:p-6 rounded-2xl bg-[#070911] border border-[#262a33] overflow-x-auto flex justify-center">
              <div
                style={{
                  width: previewDevice === "desktop" ? "560px" : "360px",
                  transition: "width 0.3s ease",
                }}
                className="rounded-2xl overflow-hidden bg-[#111524] border border-[#232b42] shadow-2xl text-left"
              >
                {/* 1. Header with Admin Profile Pic & Gradient Thank You */}
                <div className="p-6 text-center bg-linear-to-br from-[#1e1b4b] via-[#2e1065] to-[#0f172a] border-b border-[#2e3856]">
                  {/* Avatar with Glowing Ring */}
                  <div className="inline-block p-1 rounded-full bg-linear-to-tr from-[#06b6d4] via-[#8b5cf6] to-[#ec4899] shadow-[0_0_20px_rgba(6,182,212,0.45)] mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profilePic || "/admin-profile.jpg"}
                      alt="Admin Profile"
                      className="w-16 h-16 rounded-full object-cover bg-[#0f172a]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/admin-profile.jpg";
                      }}
                    />
                  </div>

                  <div className="mb-2">
                    <span className="inline-block px-3 py-1 rounded-full bg-linear-to-r from-[#06b6d4]/20 to-[#8b5cf6]/20 border border-[#38bdf8]/40 text-[#38bdf8] text-[10px] font-extrabold uppercase tracking-wider">
                      🛡️ TRINITYMART DISPATCH &bull; VERIFIED ADMIN
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Thank You for Your Order! 🎉
                  </h3>
                  <p className="text-xs text-[#cbd5e1] mt-1.5 max-w-md mx-auto leading-relaxed">
                    Hi <strong className="text-white">Alex</strong>, your payment of <strong className="text-[#34d399]">₹25</strong> was verified successfully. Your authentic account credentials are ready below.
                  </p>
                </div>

                {/* 2. Main Body */}
                <div className="p-5 sm:p-6 space-y-5">
                  {/* Warranty Badge */}
                  <div className="p-3 rounded-xl bg-linear-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/30 flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <div className="text-xs text-emerald-200 leading-relaxed">
                      <strong className="text-emerald-300">Replacement Guarantee Active:</strong> Full warranty is active for this order. 24/7 support is available on Discord.
                    </div>
                  </div>

                  {/* Delivered Credentials Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-linear-to-b from-[#14192b] to-[#0c101d] border border-[#29354d] shadow-lg space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                      <span className="px-2.5 py-1 rounded-md bg-linear-to-r from-[#06b6d4] to-[#3b82f6] text-white text-[10px] font-extrabold uppercase tracking-wider">
                        🔑 Unit #1 &mdash; Discord Nitro Booster
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        ● Verified
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[11px] text-[#94a3b8] font-medium block mb-0.5">Account ID / Login:</span>
                        <div className="p-2 rounded-lg bg-[#090d16] border border-[#1e293b] font-mono text-[#38bdf8] font-bold text-xs truncate">
                          trinity_nitro_vip_2026
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#94a3b8] font-medium block mb-0.5">Password:</span>
                        <div className="p-2 rounded-lg bg-[#090d16] border border-[#1e293b] font-mono text-emerald-400 font-bold text-xs">
                          NitroBoostPass#9201
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#94a3b8] font-medium block mb-0.5">License Key / Token:</span>
                        <div className="p-2 rounded-lg bg-[#090d16] border border-[#1e293b] font-mono text-purple-300 font-bold text-[11px] truncate">
                          mfa.W83kd9193Jld82A_TRINITYMART_TOKEN
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-[#94a3b8] font-medium block mb-0.5">2FA / PIN:</span>
                        <div className="p-2 rounded-lg bg-[#090d16] border border-[#1e293b] font-mono text-amber-300 font-bold text-xs">
                          948201
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Official Invoice & Glowing Gradient Link */}
                  <div className="p-5 rounded-2xl bg-linear-to-br from-[#0f172a] to-[#181e36] border border-[#3b82f6] shadow-xl space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-[11px] font-extrabold text-[#60a5fa] uppercase tracking-wider font-mono">
                        📄 OFFICIAL INVOICE &amp; PAYMENT SUMMARY
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        PAID IN FULL
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[#94a3b8]">Invoice / Order ID</span>
                        <span className="font-mono text-[#60a5fa] font-bold">ORD-774921</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[#94a3b8]">Product</span>
                        <span className="text-white font-bold">Discord Nitro Booster (1x)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[#94a3b8]">Amount Paid</span>
                        <span className="text-emerald-400 font-black text-sm">₹25</span>
                      </div>
                    </div>

                    {/* Glowing Gradient Invoice Link Button */}
                    <div className="text-center pt-2">
                      <div className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-[#06b6d4] via-[#2563eb] to-[#7c3aed] text-white font-black text-xs uppercase tracking-wider shadow-[0_6px_20px_rgba(6,182,212,0.4)] border border-white/20 select-none">
                        📄 View Official Invoice &amp; Confirm Delivery &rarr;
                      </div>
                      <p className="text-[10px] text-[#94a3b8] mt-1.5">
                        Opens live web invoice with delivery verification &amp; print receipt button
                      </p>
                    </div>
                  </div>

                  {/* Discord 24/7 Box */}
                  <div className="p-4 rounded-xl bg-linear-to-r from-[#5865F2]/15 to-[#7c3aed]/10 border border-[#5865F2]/30 text-center space-y-2">
                    <p className="text-xs font-bold text-[#818cf8]">💬 Need Help? 24/7 Discord Support</p>
                    <div className="inline-block px-3 py-1.5 rounded-lg bg-linear-to-r from-[#5865F2] to-[#7c3aed] text-white text-[11px] font-bold">
                      Join Official Discord Server
                    </div>
                  </div>
                </div>

                {/* 3. Footer */}
                <div className="p-4 text-center bg-[#090d16] border-t border-[#1e293b] text-[10px] text-[#64748b]">
                  Trinitymart &bull; Automated Digital Goods Dispatch &bull; 24/7 Support
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
