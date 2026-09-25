"use client";

import Image from "next/image";
import { Fascinate_Inline } from "next/font/google";
import { useState, useEffect, useRef } from "react";
import { APP_CONFIG } from "@/lib/config";

const f = Fascinate_Inline({ subsets: ["latin"], weight: "400" });

type Step = 1 | 2 | 3;

interface FamGatewayOrder {
  order_id: string;
  amount: number | string;
  payable_amount: number | string;
  quantity?: number;
  upi_id?: string;
  qr_url: string;
  checkout_url: string;
  upi_intent: string;
  expires_at_ist?: string;
}

interface CredentialResult {
  email: string;
  password: string;
  token?: string;
  domain?: string;
  twoFactorKey?: string;
  keyweb?: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // Live stock state
  const [inStock, setInStock] = useState<boolean | null>(null);
  const [stockCount, setStockCount] = useState<number | null>(null);
  const [checkingStock, setCheckingStock] = useState(false);

  // Payment session state
  const [order, setOrder] = useState<FamGatewayOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [stockError, setStockError] = useState("");
  const [polling, setPolling] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [failReason, setFailReason] = useState("");

  // Countdown timer for 5-minute UPI session
  const [timeLeft, setTimeLeft] = useState<number>(300);

  // Selected Quantity
  const [quantity, setQuantity] = useState<number>(1);

  // Delivered account credentials
  const [deliveredCreds, setDeliveredCreds] = useState<CredentialResult | null>(null);
  const [deliveredList, setDeliveredList] = useState<CredentialResult[]>([]);
  const [confirmedUtr, setConfirmedUtr] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set());
  const [revealedTokens, setRevealedTokens] = useState<Set<number>>(new Set());
  const [copiedField, setCopiedField] = useState<string>("");

  // Manual query
  const [manualQuery, setManualQuery] = useState("");
  const [manualChecking, setManualChecking] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Dynamic price & discord link from server
  const [price, setPrice] = useState<number>(APP_CONFIG.price);
  const [discordLink, setDiscordLink] = useState<string>(APP_CONFIG.discordLink);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial stock and server config on page load
  const refreshStock = async () => {
    try {
      const res = await fetch("/api/check-stock", { cache: "no-store" });
      const data = await res.json();
      setInStock(data.inStock);
      setStockCount(data.count ?? 0);
      if (data.price !== undefined && Number(data.price) > 0) {
        setPrice(Number(data.price));
      }
      if (data.discordLink) {
        setDiscordLink(data.discordLink);
      }
    } catch {
      setInStock(false);
      setStockCount(0);
    }
  };

  useEffect(() => {
    refreshStock();
  }, []);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  // Check stock before user can proceed from Step 1 to Step 2
  const handleEmailNext = async () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setEmailError("");
    setCheckingStock(true);

    try {
      const res = await fetch("/api/check-stock", { cache: "no-store" });
      const data = await res.json();
      setInStock(data.inStock);
      setStockCount(data.count ?? 0);

      if (!data.inStock || data.count === 0) {
        setEmailError("Sorry, we are currently OUT OF STOCK! Please join our Discord server for restock updates.");
        setCheckingStock(false);
        return;
      }
    } catch {
      setEmailError("Unable to verify stock at this moment. Please check your internet connection.");
      setCheckingStock(false);
      return;
    }

    setCheckingStock(false);
    setStep(2);
  };

  // Generate UPI order via FamGateway
  const startPayment = async () => {
    setStockError("");
    setLoadingOrder(true);
    setPaymentStatus("idle");
    setFailReason("");

    try {
      // 1. Re-verify stock before creating order
      const stockRes = await fetch("/api/check-stock", { cache: "no-store" });
      const stockData = await stockRes.json();
      setInStock(stockData.inStock);
      setStockCount(stockData.count ?? 0);

      if (!stockData.inStock || stockData.count === 0) {
        setStockError("Sorry, we're currently out of stock. No payment session was opened.");
        setLoadingOrder(false);
        return;
      }

      // 2. Call backend order generation
      const res = await fetch("/api/famgateway/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          quantity,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.status !== "success" || !data.data) {
        setStockError(data.error || "Failed to initialize payment session. Please try again.");
        setLoadingOrder(false);
        return;
      }

      setOrder(data.data);
      setTimeLeft(300); // 5 minutes countdown
      setLoadingOrder(false);
      startPolling(data.data.order_id);
    } catch (err) {
      console.error("Payment initiation error:", err);
      setStockError("Network error. Please check your internet connection.");
      setLoadingOrder(false);
    }
  };

  // Start polling every 3 seconds
  const startPolling = (orderId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setPolling(true);

    const check = async () => {
      try {
        const res = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            email: email.trim().toLowerCase(),
          }),
        });

        const data = await res.json();

        if (data.status === "confirmed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPolling(false);
          setPaymentStatus("success");
          if (data.credentials && data.credentials.length > 0) {
            setDeliveredList(data.credentials);
            setDeliveredCreds(data.credentials[0]);
          } else if (data.credential) {
            setDeliveredCreds(data.credential);
            setDeliveredList([data.credential]);
          }
          if (data.utr) {
            setConfirmedUtr(data.utr);
          }
          setStep(3);
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPolling(false);
          setPaymentStatus("failed");
          setFailReason(data.reason || "Payment window expired.");
        }
      } catch (err) {
        console.warn("Polling blip, will retry:", err);
      }
    };

    // First check immediately
    check();
    // Then every 3 seconds
    pollIntervalRef.current = setInterval(check, 3000);
  };

  // Countdown timer effect
  useEffect(() => {
    if (!order || step !== 2 || paymentStatus === "success") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPolling(false);
          setPaymentStatus("failed");
          setFailReason("Payment session expired (5 minutes). Please start a fresh payment.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, step, paymentStatus]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Manual verify by Order ID or UTR
  const handleManualVerify = async () => {
    if (!manualQuery.trim()) {
      setManualMsg("Please enter your Order ID or 12-digit UPI UTR.");
      return;
    }
    setManualChecking(true);
    setManualMsg("");

    try {
      const res = await fetch("/api/verify-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          orderId: manualQuery.trim(),
        }),
      });

      const data = await res.json();
      if (data.status === "confirmed") {
        if (data.credentials && data.credentials.length > 0) {
          setDeliveredList(data.credentials);
          setDeliveredCreds(data.credentials[0]);
        } else if (data.credential) {
          setDeliveredCreds(data.credential);
          setDeliveredList([data.credential]);
        }
        if (data.utr) setConfirmedUtr(data.utr);
        setPaymentStatus("success");
        setStep(3);
      } else {
        setManualMsg(data.message || data.error || "Payment not yet confirmed. Please wait 1-2 minutes.");
      }
    } catch {
      setManualMsg("Network error. Please try again.");
    } finally {
      setManualChecking(false);
    }
  };

  const maxStock = stockCount && stockCount > 0 ? stockCount : 1;

  const handleDecreaseQty = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQty = () => {
    setQuantity((prev) => Math.min(maxStock, prev + 1));
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setQuantity(1);
    } else {
      setQuantity(Math.max(1, Math.min(maxStock, val)));
    }
  };

  const toggleRevealPwd = (idx: number) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleRevealTok = (idx: number) => {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const copyAllAccounts = () => {
    const list =
      deliveredList.length > 0
        ? deliveredList
        : deliveredCreds
        ? [deliveredCreds]
        : [];
    const formatted = list
      .map((c, i) => {
        let text = `Account #${i + 1}:\nEmail: ${c.email}\nPassword: ${c.password}`;
        if (c.domain) text += `\nDomain: ${c.domain}`;
        if (c.token) text += `\nToken: ${c.token}`;
        if (c.twoFactorKey) text += `\n2FA: ${c.twoFactorKey}`;
        if (c.keyweb) text += `\nKeyweb: ${c.keyweb}`;
        return text;
      })
      .join("\n\n---\n\n");

    copyToClipboard(formatted, "all");
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(""), 2500);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const steps = [
    { id: 1, label: "Account" },
    { id: 2, label: "UPI Pay" },
    { id: 3, label: "Delivery" },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* ── Left Panel ── */}
      <div className="bg-amber-50 w-full md:w-1/2 min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pt-5 px-5 sm:px-6 md:pt-6 md:px-6">
          <div className={`${f.className} text-2xl sm:text-3xl md:text-4xl text-amber-900`}>
            Trinity Mart
          </div>

          {/* Discord 24/7 Support Quick Badge */}
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-all shadow-xs hover:shadow-sm"
          >
            <span>💬</span> 24/7 Discord
          </a>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-0 px-5 md:px-6 pt-4 pb-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 transition-all duration-300
                    ${
                      step > s.id
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : step === s.id
                        ? "bg-white border-indigo-600 text-indigo-600 shadow-sm"
                        : "bg-white border-gray-300 text-gray-400"
                    }`}
                >
                  {step > s.id ? "✓" : s.id}
                </div>
                <span
                  className={`text-xs mt-1 font-medium ${
                    step >= s.id ? "text-indigo-600" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 w-10 sm:w-14 md:w-16 mb-4 mx-1 transition-all duration-500 ${
                    step > s.id ? "bg-indigo-600" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 pb-10 md:pb-12">
          {/* STEP 1 — Enter Email & Check Stock */}
          {step === 1 && (
            <div className="space-y-4 w-full max-w-sm mx-auto md:mx-0">
              {/* Product Badge Card */}
              <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-md">
                    🚀 {APP_CONFIG.productName}
                  </span>
                  <span className="font-extrabold text-indigo-600 text-lg">
                    {APP_CONFIG.currencySymbol}{price}
                  </span>
                </div>

                {/* Stock Status Check Alert */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                  <span className="text-gray-500">Inventory Status:</span>
                  {inStock === null ? (
                    <span className="text-gray-400 animate-pulse">Checking stock…</span>
                  ) : inStock ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      In Stock ({stockCount} ready)
                    </span>
                  ) : (
                    <span className="text-red-700 font-bold flex items-center gap-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      Out of Stock
                    </span>
                  )}
                </div>

                {/* Guarantee Badges */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-gray-600">
                  <div className="flex items-center gap-1 bg-gray-50 rounded-md p-1.5 border border-gray-100">
                    <span>🛡️</span>
                    <span>Full Warranty</span>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 rounded-md p-1.5 border border-gray-100">
                    <span>💬</span>
                    <span>24/7 Discord Support</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-800">Your Delivery Email</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your Nitro Booster ID [with 2 Boosts] will be automatically sent to this address after UPI payment.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailNext()}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white outline-none text-gray-800 placeholder-gray-400 transition-all duration-200 text-sm
                    ${
                      emailError
                        ? "border-red-400 focus:border-red-500"
                        : "border-gray-200 focus:border-indigo-500"
                    }`}
                />
                {emailError && (
                  <p className="text-xs text-red-500 flex items-start gap-1">
                    <span className="shrink-0 mt-0.5">⚠</span> <span>{emailError}</span>
                  </p>
                )}
              </div>

              {/* Quantity Selector */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <span>📦</span> Account Quantity
                  </label>
                  {stockCount !== null && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      {stockCount} in stock
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  {/* Stepper */}
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecreaseQty}
                      disabled={quantity <= 1}
                      className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={maxStock}
                      value={quantity}
                      onChange={handleQtyChange}
                      className="w-12 text-center font-bold text-gray-800 text-sm py-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={handleIncreaseQty}
                      disabled={quantity >= maxStock}
                      className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Select Quantity Buttons */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 5].map((qtyVal) => {
                      if (stockCount && stockCount < qtyVal) return null;
                      return (
                        <button
                          key={qtyVal}
                          type="button"
                          onClick={() => setQuantity(qtyVal)}
                          className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                            quantity === qtyVal
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {qtyVal}x
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] pt-1 text-gray-500 border-t border-gray-200/60">
                  <span>Unit Price: {APP_CONFIG.currencySymbol}{price}</span>
                  <span className="font-bold text-indigo-600">
                    Total: {APP_CONFIG.currencySymbol}{price * quantity}
                  </span>
                </div>
              </div>

              <button
                id="email-next-btn"
                onClick={handleEmailNext}
                disabled={checkingStock || inStock === false}
                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {checkingStock ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Checking Stock…
                  </>
                ) : inStock === false ? (
                  "Sold Out (Restocking Soon)"
                ) : (
                  `Buy ${quantity} Account${quantity > 1 ? "s" : ""} (${APP_CONFIG.currencySymbol}${price * quantity}) →`
                )}
              </button>

              {/* 24/7 Discord Support Box */}
              <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-xl p-3 flex items-center justify-between text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="font-bold text-[#5865F2]">24/7 Discord Support</p>
                    <p className="text-[11px] text-gray-500">Need help or warranty claim?</p>
                  </div>
                </div>
                <a
                  href={discordLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#5865F2] hover:bg-[#4752c4] text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] shrink-0"
                >
                  Join Server ↗
                </a>
              </div>
            </div>
          )}

          {/* STEP 2 — UPI Payment (FamGateway) */}
          {step === 2 && (
            <div className="space-y-4 w-full max-w-sm mx-auto md:mx-0">
              {/* Not yet created order */}
              {!order && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Order Confirmation</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Delivering to: <span className="font-semibold text-indigo-600 break-all">{email}</span>
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 space-y-2.5 shadow-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Product</span>
                      <span className="font-bold text-gray-800 text-right">Nitro Booster ID [with 2 Boosts]</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Quantity</span>
                      <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {quantity} Account{quantity > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Unit Price</span>
                      <span className="text-gray-800 font-medium">{APP_CONFIG.currencySymbol}{price} / account</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Warranty</span>
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                        Full Replacement
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">Support</span>
                      <span className="text-[#5865F2] font-semibold">24/7 Discord Live</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="font-bold text-gray-800 text-sm">Total Payable</span>
                      <span className="font-bold text-indigo-600 text-xl">{APP_CONFIG.currencySymbol}{price * quantity}</span>
                    </div>
                  </div>

                  {stockError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">⚠️</span>
                      <span>{stockError}</span>
                    </div>
                  )}

                  <button
                    id="generate-qr-btn"
                    onClick={startPayment}
                    disabled={loadingOrder}
                    className="w-full bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {loadingOrder ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Generating Dynamic UPI QR…
                      </>
                    ) : (
                      <>
                        <span>📱</span> Pay {APP_CONFIG.currencySymbol}{price * quantity} with UPI
                      </>
                    )}
                  </button>

                  <button
                    id="back-btn"
                    onClick={() => setStep(1)}
                    className="w-full text-gray-500 hover:text-gray-700 text-xs py-1 transition-colors"
                  >
                    ← Change Email / Back
                  </button>
                </div>
              )}

              {/* Active UPI QR Screen */}
              {order && paymentStatus !== "failed" && (
                <div className="space-y-3.5">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live UPI Payment Session
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">Scan UPI QR to Pay</h2>
                    <p className="text-xs text-gray-500">
                      Transfer exact amount <strong className="text-gray-800 font-bold">₹{order.payable_amount}</strong>
                    </p>
                  </div>

                  {/* QR Box */}
                  <div className="bg-white rounded-2xl border-2 border-indigo-100 p-4 shadow-sm flex flex-col items-center gap-2.5">
                    {/* Timer badge */}
                    <div className="flex items-center justify-between w-full text-xs text-gray-500 px-1 border-b pb-2">
                      <span className="font-mono text-gray-400 text-[11px]">Order: {order.order_id}</span>
                      <span className={`font-semibold ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-amber-600"}`}>
                        ⏱ Expiring: {formatTimer(timeLeft)}
                      </span>
                    </div>

                    {/* QR Image */}
                    <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-xs relative">
                      <img
                        src={order.qr_url}
                        alt="FamGateway UPI QR Code"
                        width={190}
                        height={190}
                        className="rounded-lg object-contain"
                      />
                    </div>

                    <p className="text-[11px] text-gray-500 text-center">
                      Scan via <strong>PhonePe, Google Pay, Paytm, BHIM or FamPay</strong>
                    </p>

                    {/* Mobile UPI Deep link Button */}
                    <div className="w-full flex flex-col gap-1.5 pt-1">
                      {order.upi_intent && (
                        <a
                          href={order.upi_intent}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold py-2.5 px-4 rounded-xl text-center text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                          <span>⚡</span> Pay via UPI App (PhonePe / GPay)
                        </a>
                      )}

                      <a
                        href={order.checkout_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-1.5 px-4 rounded-xl text-center text-[11px] transition-colors"
                      >
                        Open FamGateway Payment Screen ↗
                      </a>
                    </div>
                  </div>

                  {/* Real-time listener pulse */}
                  <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="relative w-3.5 h-3.5 shrink-0">
                      <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-60" />
                      <div className="relative w-3.5 h-3.5 rounded-full bg-indigo-600" />
                    </div>
                    <div className="text-[11px]">
                      <p className="font-semibold text-indigo-900">Waiting for transfer…</p>
                      <p className="text-indigo-700">Account credentials will be emailed to {email} instantly.</p>
                    </div>
                  </div>

                  {/* Manual entry fallback */}
                  <div className="pt-0.5">
                    {!showManualEntry ? (
                      <button
                        onClick={() => setShowManualEntry(true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 underline block mx-auto cursor-pointer"
                      >
                        Already transferred? Enter Bank UTR manually
                      </button>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 text-xs">
                        <p className="font-semibold text-amber-800">Manual UTR Verification</p>
                        <input
                          type="text"
                          value={manualQuery}
                          onChange={(e) => setManualQuery(e.target.value)}
                          placeholder="Enter 12-digit UPI UTR / Ref"
                          className="w-full px-3 py-1.5 rounded-lg border bg-white text-gray-800 placeholder-gray-400 font-mono text-xs outline-none"
                        />
                        {manualMsg && <p className="text-red-600 text-xs">{manualMsg}</p>}
                        <button
                          onClick={handleManualVerify}
                          disabled={manualChecking || !manualQuery.trim()}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {manualChecking ? "Verifying…" : "Confirm UTR"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Failed Screen */}
              {paymentStatus === "failed" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                      ❌
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Session Ended</h2>
                    <p className="text-xs text-gray-500 text-center max-w-xs">
                      {failReason || "Payment session was not completed in time."}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setOrder(null);
                      setPaymentStatus("idle");
                      startPayment();
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all text-sm"
                  >
                    Generate Fresh QR Code
                  </button>

                  <button
                    onClick={() => {
                      setOrder(null);
                      setStep(1);
                    }}
                    className="w-full text-gray-500 hover:text-gray-700 text-xs py-1"
                  >
                    ← Back to Email
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Delivery / Success */}
          {step === 3 && (
            <div className="space-y-4 w-full max-w-sm mx-auto md:mx-0">
              <div className="flex flex-col items-center gap-1.5 py-1">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl shadow-xs">
                  ✅
                </div>
                <h2 className="text-xl font-bold text-gray-800 text-center">Payment Confirmed!</h2>
                <p className="text-xs text-gray-600 text-center">
                  Your <strong>Nitro Booster ID [with 2 Boosts]</strong> has been delivered to{" "}
                  <span className="font-semibold text-indigo-600 break-all">{email}</span>
                </p>
              </div>

              {/* Delivered Account Details Box */}
              {(deliveredList.length > 0 || deliveredCreds) ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                      🚀 Delivered Accounts ({deliveredList.length || 1})
                    </span>
                    {(deliveredList.length > 1 || deliveredCreds) && (
                      <button
                        onClick={copyAllAccounts}
                        className="text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                      >
                        {copiedField === "all" ? "✓ All Copied!" : "📋 Copy All Accounts"}
                      </button>
                    )}
                  </div>

                  {(deliveredList.length > 0 ? deliveredList : [deliveredCreds!]).map((cred, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border-2 border-indigo-100 p-4 space-y-2.5 shadow-md">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                          Account #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRevealPwd(idx)}
                            className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                          >
                            {revealedPasswords.has(idx) ? "Hide Password" : "Show Password"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-xs text-gray-500 block">Discord Login Email</span>
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 mt-0.5 border">
                            <span className="font-mono text-xs text-gray-800 select-all break-all">
                              {cred.email}
                            </span>
                            <button
                              onClick={() => copyToClipboard(cred.email, `email-${idx}`)}
                              className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0 cursor-pointer"
                            >
                              {copiedField === `email-${idx}` ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>

                        <div>
                          <span className="text-xs text-gray-500 block">Password</span>
                          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 mt-0.5 border">
                            <span className="font-mono text-xs text-gray-800 select-all break-all">
                              {revealedPasswords.has(idx) || showPassword ? cred.password : "••••••••••••"}
                            </span>
                            <button
                              onClick={() => copyToClipboard(cred.password, `password-${idx}`)}
                              className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0 cursor-pointer"
                            >
                              {copiedField === `password-${idx}` ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>

                        {cred.domain && (
                          <div>
                            <span className="text-xs text-gray-500 block">Domain / Mail Host</span>
                            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2 mt-0.5 border">
                              <span className="font-mono text-xs text-gray-800 select-all break-all">
                                {cred.domain}
                              </span>
                              <button
                                onClick={() => copyToClipboard(cred.domain!, `domain-${idx}`)}
                                className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0 cursor-pointer"
                              >
                                {copiedField === `domain-${idx}` ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        )}

                        {cred.token && (
                          <div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500 block">Account Token</span>
                              <button
                                onClick={() => toggleRevealTok(idx)}
                                className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                {revealedTokens.has(idx) || showToken ? "Hide" : "Show"}
                              </button>
                            </div>
                            <div className="flex items-center justify-between bg-indigo-50/60 rounded-lg p-2 mt-0.5 border border-indigo-100">
                              <span className="font-mono text-xs text-indigo-950 select-all break-all">
                                {revealedTokens.has(idx) || showToken ? cred.token : "••••••••••••••••••••••••"}
                              </span>
                              <button
                                onClick={() => copyToClipboard(cred.token!, `token-${idx}`)}
                                className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0 cursor-pointer"
                              >
                                {copiedField === `token-${idx}` ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                        )}

                        {cred.twoFactorKey && (
                          <div>
                            <span className="text-xs text-amber-700 font-medium block">
                              2FA Secret Key (TOTP)
                            </span>
                            <div className="flex items-center justify-between bg-amber-50/70 rounded-lg p-2 mt-0.5 border border-amber-200">
                              <span className="font-mono text-xs text-amber-900 select-all break-all font-semibold">
                                {cred.twoFactorKey}
                              </span>
                              <button
                                onClick={() => copyToClipboard(cred.twoFactorKey!, `2fa-${idx}`)}
                                className="ml-2 text-xs text-amber-700 hover:text-amber-900 font-medium shrink-0 cursor-pointer"
                              >
                                {copiedField === `2fa-${idx}` ? "Copied!" : "Copy"}
                              </button>
                            </div>
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              Paste into 2fa.live or Google Authenticator to generate 6-digit login codes.
                            </span>
                          </div>
                        )}

                        {cred.keyweb && (
                          <div>
                            <span className="text-xs text-sky-700 font-medium block">Keyweb / Webkey</span>
                            <div className="flex items-center justify-between bg-sky-50/70 rounded-lg p-2 mt-0.5 border border-sky-200">
                              <span className="font-mono text-xs text-sky-950 select-all break-all">
                                {cred.keyweb}
                              </span>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                {cred.keyweb.startsWith("http") && (
                                  <a
                                    href={cred.keyweb}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-600 hover:text-sky-800 underline"
                                  >
                                    Open ↗
                                  </a>
                                )}
                                <button
                                  onClick={() => copyToClipboard(cred.keyweb!, `keyweb-${idx}`)}
                                  className="text-xs text-sky-700 hover:text-sky-900 font-medium cursor-pointer"
                                >
                                  {copiedField === `keyweb-${idx}` ? "Copied!" : "Copy"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="bg-emerald-50 rounded-xl p-2.5 text-[11px] text-emerald-800 space-y-1 border border-emerald-100">
                    <p className="font-semibold flex items-center gap-1">
                      <span>🛡️</span> Full Replacement Warranty Active
                    </p>
                    <p className="text-emerald-700">
                      Login to Discord and apply your <strong>2 Server Boosts</strong> to any server of your choice!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-xs text-emerald-800">
                  Account details have been sent to your email! Please check your inbox and spam folder.
                </div>
              )}

              {/* 24/7 Discord Support Card */}
              <div className="bg-[#5865F2] text-white rounded-2xl p-4 shadow-md text-center space-y-2">
                <p className="font-bold text-sm">💬 24/7 Discord Support</p>
                <p className="text-xs text-white/90">
                  Need help applying boosts or claiming warranty? Join our official Discord community!
                </p>
                <a
                  href={discordLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full bg-white text-[#5865F2] font-bold py-2 px-4 rounded-xl text-xs shadow-sm hover:bg-gray-100 transition-colors"
                >
                  Join Discord Support Server ↗
                </a>
              </div>

              {/* Transaction details card */}
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-1 text-xs text-gray-600 shadow-xs">
                {order?.order_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order ID:</span>
                    <span className="font-mono font-semibold text-gray-800">{order.order_id}</span>
                  </div>
                )}
                {confirmedUtr && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank UTR:</span>
                    <span className="font-mono font-semibold text-gray-800">{confirmedUtr}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Product:</span>
                  <span className="text-gray-800 font-medium">Nitro Booster ID [with 2 Boosts]</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount Paid:</span>
                  <span className="font-semibold text-emerald-600">
                    {APP_CONFIG.currencySymbol}{order?.payable_amount || price}.00
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep(1);
                  setOrder(null);
                  setDeliveredCreds(null);
                  setPaymentStatus("idle");
                  refreshStock();
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all text-xs cursor-pointer"
              >
                Purchase Another Account →
              </button>
            </div>
          )}
        </div>

        {/* Mobile Mini Guide */}
        <div className="md:hidden flex gap-2.5 overflow-x-auto px-5 pb-8 scrollbar-hide">
          {[
            { icon: "🚀", title: "Nitro Booster ID", desc: "with 2 Server Boosts" },
            { icon: "🛡️", title: "Full Warranty", desc: "Replacement Guarantee" },
            { icon: "💬", title: "24/7 Discord", desc: "Live Staff Support" },
          ].map((item, i) => (
            <div
              key={i}
              className="shrink-0 flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 shadow-xs border border-gray-200"
            >
              <span className="text-base">{item.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800 whitespace-nowrap">{item.title}</p>
                <p className="text-[10px] text-gray-500 whitespace-nowrap">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel (Desktop only) ── */}
      <div className="hidden md:flex bg-blue-100 w-1/2 min-h-screen flex-col items-center justify-center gap-6 p-8">
        <Image
          src="/light.svg"
          alt="Discord"
          width={200}
          height={200}
          className="drop-shadow-2xl"
          loading="eager"
        />

        <div className="text-center space-y-2 px-6 max-w-md">
          <span className="inline-block bg-[#5865F2] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Official Store
          </span>
          <h2 className="text-blue-900 font-bold text-2xl">
            Nitro Booster ID [with 2 Boosts]
          </h2>
          <p className="text-blue-700 text-sm leading-relaxed">
            Instant automated delivery via UPI. Every account comes pre-loaded with 2 Discord Server Boosts, backed by our full warranty and 24/7 support.
          </p>
        </div>

        {/* Desktop Feature Cards */}
        <div className="flex flex-col gap-3 w-72">
          {[
            { icon: "🚀", title: "2 Server Boosts Included", desc: "Boost your server immediately" },
            { icon: "🛡️", title: "Replacement Warranty", desc: "100% guarantee on every order" },
            { icon: "⚡", title: "Instant UPI Delivery", desc: "FamGateway automated verification" },
            { icon: "💬", title: "24/7 Discord Support", desc: "Ticket assistance anytime" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white/80 backdrop-blur-xs rounded-xl px-4 py-2.5 shadow-xs border border-white/60"
            >
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-xs font-bold text-gray-800">{item.title}</p>
                <p className="text-[11px] text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}

          {/* Join Discord Support Server Banner Button */}
          <a
            href={discordLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 px-4 rounded-xl text-center text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-1"
          >
            <span>💬</span> Join 24/7 Discord Support Server ↗
          </a>
        </div>
      </div>
    </div>
  );
}
