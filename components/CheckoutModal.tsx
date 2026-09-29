"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import {
  X,
  Mail,
  ShieldCheck,
  Zap,
  CheckCircle,
  Copy,
  Check,
  ExternalLink,
  Headset,
  AlertCircle,
  ArrowRight,
  QrCode,
  Smartphone,
  Lock,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { ProductIcon } from "./ProductIcons";
import { APP_CONFIG } from "@/lib/config";

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
  id?: string;
  email: string;
  emailPassword?: string;
  discordPassword?: string;
  password?: string;
  token?: string;
  domain?: string;
  twoFactorKey?: string;
  keyweb?: string;
  productName?: string;
  productId?: string;
  fields?: Record<string, string>;
}

export function CheckoutModal() {
  const {
    isCheckoutOpen,
    setIsCheckoutOpen,
    checkoutProduct,
    items,
    subtotal,
    clearCart,
  } = useCart();

  const ACTIVE_ORDER_STORAGE_KEY = "trinitymart_active_checkout_v2";

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<FamGatewayOrder | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [timeLeft, setTimeLeft] = useState(300);
  const [deliveredCreds, setDeliveredCreds] = useState<CredentialResult | null>(
    null
  );
  const [deliveredList, setDeliveredList] = useState<CredentialResult[]>([]);
  const [failReason, setFailReason] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Bank UTR submission & verification state
  const [utrInput, setUtrInput] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Determine active purchase items & total amount
  const isSingleProduct = checkoutProduct !== null;
  const currentTotal = isSingleProduct ? checkoutProduct.price : subtotal;
  const currentTitle = isSingleProduct
    ? checkoutProduct.name
    : `${items.length} items in cart`;

  const isOutOfStock = isSingleProduct
    ? !checkoutProduct.inStock ||
      (checkoutProduct.stockCount !== undefined &&
        checkoutProduct.stockCount <= 0)
    : items.some(
        (item) =>
          !item.product.inStock ||
          (item.product.stockCount !== undefined &&
            item.product.stockCount <= 0)
      );

  // Poll for payment confirmation
  const startPolling = (orderId: string, emailToPoll?: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const targetEmail = (emailToPoll || email).trim().toLowerCase();

    pollIntervalRef.current = setInterval(async () => {
      // Guard against overlapping poll requests choking browser socket pool
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const queryParams = new URLSearchParams({ order_id: orderId, orderId });
        if (targetEmail) queryParams.set("email", targetEmail);

        const res = await fetch(`/api/confirm-payment?${queryParams.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (
          data.status === "COMPLETED" ||
          data.status === "SUCCESS" ||
          data.status === "confirmed"
        ) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStatus("success");
          if (data.credentials && Array.isArray(data.credentials) && data.credentials.length > 0) {
            setDeliveredCreds(data.credentials[0]);
            setDeliveredList(data.credentials);
          } else if (data.credential) {
            setDeliveredCreds(data.credential);
          }

          // Confetti explosion
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } else if (data.status === "FAILED" || data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStatus("failed");
          setFailReason(data.message || data.reason || "Payment transaction was rejected.");
        }
      } catch (err) {
        console.warn("Polling payment error:", err);
      } finally {
        isPollingRef.current = false;
      }
    }, 2500);
  };

  // Restore active payment session across page refreshes or accidental reloads
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        const age = Date.now() - (saved.timestamp || 0);
        // Valid for up to 15 minutes
        if (age < 15 * 60 * 1000 && saved.order) {
          setEmail(saved.email || "");
          setOrder(saved.order);
          setPaymentStatus(saved.paymentStatus || "pending");
          if (saved.timeLeft) {
            const remaining = Math.max(10, saved.timeLeft - Math.floor(age / 1000));
            setTimeLeft(remaining);
          }
          if (saved.deliveredCreds) setDeliveredCreds(saved.deliveredCreds);
          if (saved.deliveredList) setDeliveredList(saved.deliveredList);
          setIsCheckoutOpen(true);

          if (saved.paymentStatus === "pending") {
            startPolling(saved.order.order_id, saved.email);
          }
        } else {
          localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn("Could not restore active checkout:", e);
    }
  }, []);

  // Save active order state to localStorage whenever pending or success
  useEffect(() => {
    if (paymentStatus === "pending" && order) {
      try {
        localStorage.setItem(
          ACTIVE_ORDER_STORAGE_KEY,
          JSON.stringify({
            order,
            email,
            paymentStatus,
            timeLeft,
            timestamp: Date.now(),
            deliveredCreds,
            deliveredList,
          })
        );
      } catch {}
    } else if (paymentStatus === "success" && order) {
      try {
        localStorage.setItem(
          ACTIVE_ORDER_STORAGE_KEY,
          JSON.stringify({
            order,
            email,
            paymentStatus,
            timestamp: Date.now(),
            deliveredCreds,
            deliveredList,
          })
        );
      } catch {}
    } else if (paymentStatus === "idle" || paymentStatus === "failed") {
      try {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      } catch {}
    }
  }, [paymentStatus, order, email, timeLeft, deliveredCreds, deliveredList]);

  // Window beforeunload protection: warns user if they refresh while payment is pending
  useEffect(() => {
    if (paymentStatus !== "pending") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "UPI payment in progress! Leaving or refreshing will interrupt your active session.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [paymentStatus]);

  // Reset modal state on close
  const handleClose = () => {
    setIsCheckoutOpen(false);
    if (paymentStatus === "success") {
      clearCart();
      try {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      } catch {}
    }
    setOrder(null);
    setPaymentStatus("idle");
    setUtrInput("");
    setVerificationError("");
    setShowCancelConfirm(false);
    isPollingRef.current = false;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  const handleForceClose = () => {
    try {
      localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
    } catch {}
    handleClose();
  };

  // Timer countdown
  useEffect(() => {
    if (paymentStatus !== "pending") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPaymentStatus("failed");
          setFailReason("Payment session expired (5 minutes). Please try again.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentStatus]);

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOutOfStock) {
      setEmailError(
        isSingleProduct
          ? `"${checkoutProduct.name}" is currently out of stock.`
          : "Your cart contains out-of-stock items. Please remove them before checkout."
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError("Please enter a valid email to receive your keys/receipt.");
      return;
    }
    setEmailError("");
    setLoading(true);

    try {
      const quantity = isSingleProduct
        ? 1
        : items.reduce((acc, curr) => acc + curr.quantity, 0);

      const cartItemsPayload = isSingleProduct
        ? [{ productId: checkoutProduct.id, productName: checkoutProduct.name, quantity: 1, price: checkoutProduct.price }]
        : items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          }));

      const res = await fetch("/api/famgateway/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          quantity,
          amount: currentTotal,
          productId: isSingleProduct ? checkoutProduct.id : "cart",
          productName: currentTitle,
          cartItems: cartItemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error || !json.data) {
        setEmailError(
          json.error ||
            "Unable to generate live UPI payment session. Please try again."
        );
      } else {
        setOrder(json.data);
        setPaymentStatus("pending");
        setTimeLeft(300);
        startPolling(json.data.order_id, cleanEmail);
      }
    } catch {
      setEmailError(
        "Failed to connect to payment gateway. Please check your internet connection."
      );
    } finally {
      setLoading(false);
    }
  };

  // Confirm payment in database with UTR
  const handleConfirmWithUtr = async (providedUtr?: string) => {
    if (!order) return;
    setVerifyingPayment(true);
    setVerificationError("");

    const finalUtr = (providedUtr || utrInput).trim();
    if (!finalUtr) {
      setVerificationError("Please enter your 12-digit UPI Bank Reference / UTR number.");
      setVerifyingPayment(false);
      return;
    }
    if (!/^\d{12}$/.test(finalUtr)) {
      setVerificationError(
        "Invalid UTR: Bank Transaction Reference must be exactly 12 numeric digits (e.g. 423456789012)."
      );
      setVerifyingPayment(false);
      return;
    }

    try {
      const quantity = isSingleProduct
        ? 1
        : items.reduce((acc, curr) => acc + curr.quantity, 0);

      const cartItemsPayload = isSingleProduct
        ? [{ productId: checkoutProduct.id, productName: checkoutProduct.name, quantity: 1, price: checkoutProduct.price }]
        : items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          }));

      const res = await fetch("/api/payment/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          orderId: order.order_id,
          email,
          utr: finalUtr,
          amount: order.amount || currentTotal,
          quantity,
          productId: isSingleProduct ? checkoutProduct.id : "cart",
          productName: currentTitle,
          cartItems: cartItemsPayload,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setPaymentStatus("success");
        if (data.credentials && Array.isArray(data.credentials) && data.credentials.length > 0) {
          setDeliveredCreds(data.credentials[0]);
          setDeliveredList(data.credentials);
        } else if (data.credential) {
          setDeliveredCreds(data.credential);
        }

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      } else {
        setVerificationError(
          data.error ||
            "Payment verification failed: No matching bank settlement found. Please ensure payment is completed in UPI."
        );
      }
    } catch {
      setVerificationError("Network error while verifying payment with database.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(""), 2000);
  };

  const handleBackdropClick = () => {
    if (paymentStatus === "pending") {
      setShowCancelConfirm(true);
      return;
    }
    if (paymentStatus === "success") {
      // Prevent accidental close until user finishes copying their credentials
      return;
    }
    handleClose();
  };

  const handleCloseButtonClick = () => {
    if (paymentStatus === "pending") {
      setShowCancelConfirm(true);
      return;
    }
    handleClose();
  };

  if (!isCheckoutOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop — Safe against accidental click closing */}
      <div
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-[#080e1c] dark:bg-[#080e1c] light:bg-white rounded-3xl shadow-2xl border border-cyan-500/30 text-white z-10 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cancel Confirmation Prompt for Active Payment */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-30 bg-[#080e1c]/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30 animate-pulse">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">
                Payment In Progress!
              </h4>
              <p className="text-xs text-slate-300 mt-1.5 max-w-sm leading-relaxed">
                If you already sent money or scanned the QR code via UPI, <strong>do not cancel!</strong> Please enter your 12-digit UPI Bank Reference / UTR number below to receive your account credentials immediately.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs pt-1">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
              >
                Keep Open &amp; Enter UTR
              </button>
              <button
                type="button"
                onClick={handleForceClose}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-all cursor-pointer"
              >
                Cancel Session
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-[#050811]/90">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-white dark:text-white light:text-slate-900">
              Instant Automated Checkout
            </h3>
          </div>
          <button
            onClick={handleCloseButtonClick}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {paymentStatus === "idle" && (
            <form onSubmit={handleInitiatePayment} className="space-y-5">
              {/* Product preview banner */}
              <div className="p-4 rounded-2xl bg-[#0b1222] border border-cyan-500/25 flex items-center gap-3.5">
                {isSingleProduct ? (
                  <ProductIcon
                    type={checkoutProduct.iconType}
                    customLogoUrl={checkoutProduct.customLogoUrl}
                    logoSize={checkoutProduct.logoSize}
                    className="w-12 h-12 shrink-0"
                    size={22}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                    {items.length}x
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {currentTitle}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-base font-black text-cyan-600 dark:text-cyan-400">
                      {APP_CONFIG.currencySymbol}
                      {currentTotal}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        isOutOfStock
                          ? "text-rose-400 bg-rose-500/10 border border-rose-500/30"
                          : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                      }`}
                    >
                      {isOutOfStock ? "Out of Stock" : "Instant Automated Delivery"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Recipient Email (For Keys & Credentials Delivery)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    placeholder="your-email@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-rose-500 font-medium">
                    {emailError}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Your credentials and order receipt will be instantly dispatched here.
                </p>
              </div>

              {/* Payment Methods Pill */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-cyan-500" />
                  <span>Google Pay, PhonePe, Paytm, BHIM, UPI</span>
                </div>
                <span className="font-semibold text-emerald-500">0% Surcharge</span>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading || isOutOfStock}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 text-white font-extrabold text-sm shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span>Generating Secure UPI Session...</span>
                ) : isOutOfStock ? (
                  <span>Product Out of Stock — Cannot Proceed</span>
                ) : (
                  <>
                    <span>Generate Instant UPI Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Pending Payment State */}
          {paymentStatus === "pending" && order && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-semibold">
                <span>Awaiting Payment Confirmation</span>
                <span className="font-mono">
                  {Math.floor(timeLeft / 60)}:
                  {String(timeLeft % 60).padStart(2, "0")}
                </span>
              </div>

              {/* Protection notice */}
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2 text-left">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-[11px] text-cyan-200 leading-snug">
                  <strong>Protected Session:</strong> Accidental clicks or page refreshes will not lose your order or money.
                </span>
              </div>

              {/* Amount to pay */}
              <div>
                <span className="text-xs text-slate-400">Amount Payable</span>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
                  {APP_CONFIG.currencySymbol}
                  {order.payable_amount}
                </div>
              </div>

              {/* UPI QR Display or UPI link */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center space-y-3">
                {order.qr_url ? (
                  <div className="relative w-48 h-48 rounded-xl overflow-hidden shadow-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.qr_url}
                      alt="UPI QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-cyan-500/40 flex flex-col items-center justify-center p-4">
                    <QrCode className="w-16 h-16 text-cyan-500 mb-2 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Scan with any UPI App
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {order.upi_id || "trinitymart@upi"}
                    </span>
                  </div>
                )}

                {/* Mobile Intent link */}
                <a
                  href={order.upi_intent || "#"}
                  className="w-full py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                </a>
              </div>

              {/* Bank Reference / UTR Input Section */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-cyan-500/25 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <label htmlFor="utr-input" className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🏦</span> Paid via UPI? Enter Bank UTR / Ref ID:
                  </label>
                  <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    Instant Delivery
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="utr-input"
                    type="text"
                    value={utrInput}
                    onChange={(e) => {
                      setUtrInput(e.target.value);
                      setVerificationError("");
                    }}
                    placeholder="12-digit UTR (e.g. 423456789012)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/15 text-white placeholder-white/30 text-xs font-mono outline-none focus:border-cyan-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleConfirmWithUtr()}
                    disabled={verifyingPayment}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/25 cursor-pointer shrink-0"
                  >
                    {verifyingPayment ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Verifying DB…</span>
                      </>
                    ) : (
                      <>
                        <span>✅ Confirm &amp; Claim</span>
                      </>
                    )}
                  </button>
                </div>

                {verificationError && (
                  <p className="text-xs text-red-400 font-semibold flex items-center gap-1">
                    <span>⚠️</span> {verificationError}
                  </p>
                )}

                <p className="text-[11px] text-slate-400">
                  After completing payment in Google Pay / PhonePe / Paytm, copy the 12-digit UPI Transaction ID or Bank UTR and paste above.
                </p>
              </div>
            </div>
          )}

          {/* Success State */}
          {paymentStatus === "success" && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 dark:text-white">
                  Payment Verified!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your credentials have been generated and dispatched to{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {email}
                  </span>
                </p>
              </div>

              {/* Delivered Credentials Card */}
              {((deliveredList && deliveredList.length > 0) || deliveredCreds) && (
                <div className="space-y-3 text-left">
                  {(deliveredList && deliveredList.length > 0 ? deliveredList : [deliveredCreds!]).map((cred, idx) => {
                    const itemTitle = cred.productName || (deliveredList.length > 1 ? `Unit #${idx + 1}` : currentTitle);
                    const accountId = cred.fields?.id || cred.fields?.username || cred.fields?.login || (cred.email && cred.email !== email && !cred.email.includes("@") ? cred.email : cred.fields?.email || (cred.email !== email ? cred.email : ""));
                    const password = cred.fields?.password || cred.password || cred.emailPassword;
                    const token = cred.fields?.token || cred.token || cred.fields?.key;
                    const pin = cred.fields?.pin || cred.twoFactorKey || cred.fields?.["2fa"];

                    return (
                      <div
                        key={cred.id || idx}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-emerald-500/30 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 pb-1.5 border-b border-slate-200 dark:border-white/10">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            {itemTitle}
                          </span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                            Active Warranty
                          </span>
                        </div>

                        {/* Account ID / Username */}
                        {accountId && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="text-xs">
                              <span className="text-slate-400 block text-[10px] font-bold">
                                ACCOUNT ID / USERNAME
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {accountId}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(accountId, `id-${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 cursor-pointer"
                              title="Copy ID"
                            >
                              {copiedField === `id-${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Password */}
                        {password && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="text-xs">
                              <span className="text-slate-400 block text-[10px] font-bold">
                                PASSWORD / ACCESS
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {password}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(password, `pass-${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedField === `pass-${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* License Key / Token */}
                        {token && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="text-xs">
                              <span className="text-slate-400 block text-[10px] font-bold">
                                LICENSE KEY / CODE
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                                {token}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(token, `token-${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 cursor-pointer"
                              title="Copy Key"
                            >
                              {copiedField === `token-${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* 2FA / PIN */}
                        {pin && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <div className="text-xs">
                              <span className="text-slate-400 block text-[10px] font-bold">
                                2FA / PIN CODE
                              </span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {pin}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(pin, `pin-${idx}`)}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 cursor-pointer"
                              title="Copy PIN"
                            >
                              {copiedField === `pin-${idx}` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Additional Custom Options & Credential Fields */}
                        {cred.fields &&
                          Object.entries(cred.fields).map(([k, v]) => {
                            if (
                              [
                                "id",
                                "email",
                                "username",
                                "login",
                                "password",
                                "emailPassword",
                                "discordPassword",
                                "token",
                                "key",
                                "license",
                                "code",
                                "pin",
                                "twoFactorKey",
                                "2fa",
                                "twoFactor",
                                "domain",
                                "keyweb",
                                "productName",
                              ].includes(k) ||
                              !v
                            ) {
                              return null;
                            }
                            const valStr = String(v);
                            const copyKey = `custom-${idx}-${k}`;
                            return (
                              <div
                                key={k}
                                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
                              >
                                <div className="text-xs min-w-0 pr-2">
                                  <span className="text-slate-400 block text-[10px] font-bold uppercase truncate">
                                    {k}
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 dark:text-white break-all">
                                    {valStr}
                                  </span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(valStr, copyKey)}
                                  className="p-1.5 text-slate-400 hover:text-cyan-500 cursor-pointer shrink-0"
                                  title={`Copy ${k}`}
                                >
                                  {copiedField === copyKey ? (
                                    <Check className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                <a
                  href={APP_CONFIG.discordLink || "/discord"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold transition-all"
                >
                  <Headset className="w-4 h-4" />
                  <span>Join Discord for 24/7 Warranty Support</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-semibold transition-all"
                >
                  Done &amp; Continue Shopping
                </button>
              </div>
            </div>
          )}

          {/* Failed State */}
          {paymentStatus === "failed" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment Not Completed
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {failReason ||
                  "The payment session expired or was interrupted. No charges were made."}
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPaymentStatus("idle")}
                  className="flex-1 py-3 rounded-xl bg-cyan-500 text-white text-xs font-bold"
                >
                  Try Again
                </button>
                <a
                  href={APP_CONFIG.discordLink || "/discord"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Headset className="w-3.5 h-3.5" />
                  <span>Get Help on Discord</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
