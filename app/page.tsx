"use client";

import Image from "next/image";
import { Fascinate_Inline } from "next/font/google";
import { useState } from "react";

const f = Fascinate_Inline({ subsets: ["latin"], weight: "400" });

type Step = 1 | 2 | 3;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");
  const [stockError, setStockError] = useState("");
  const [stockChecking, setStockChecking] = useState(false);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleEmailNext = () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setStep(2);
  };

  const handlePayment = async () => {
    setStockError("");
    setStockChecking(true);

    // ── Pre-check: ensure stock is available before charging the customer ──
    try {
      const res = await fetch("/api/check-stock");
      const data = await res.json();
      if (!data.inStock) {
        setStockError("Sorry, we're currently out of stock. No payment has been taken. Please try again later.");
        setStockChecking(false);
        return; // ← abort: never open the payment widget
      }
    } catch {
      setStockError("Could not verify stock availability. Please try again.");
      setStockChecking(false);
      return;
    }

    setStockChecking(false);

    // Build a unique orderId that embeds the buyer email (base64) + timestamp
    const orderId = `${btoa(email)}_${Date.now()}`;

    // @ts-expect-error - Atlos widget is loaded via CDN script tag
    atlos.Pay({
      merchantId: process.env.NEXT_PUBLIC_ATLOS_MERCHANT_ID,
      orderId,
      orderAmount: 0.01, // USD equivalent – update as needed
      currency: "USD",
      onSuccess: (data: { orderId: string; txId: string }) => {
        setPaymentId(data.txId ?? data.orderId);
        setStep(3);
        verifyPayment(data.orderId, data.txId ?? "");
      },
      onError: () => {
        setPaymentStatus("failed");
        setStep(3);
      },
    });
  };


  const verifyPayment = async (orderId: string, txId: string) => {
    setChecking(true);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orderId, txId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaymentStatus("success");
      } else {
        console.error("Email send error:", data.error);
        setPaymentStatus("failed");
      }
    } catch (err) {
      console.error("Network error:", err);
      setPaymentStatus("failed");
    } finally {
      setChecking(false);
    }
  };


  const steps = [
    { id: 1, label: "Email" },
    { id: 2, label: "Payment" },
    { id: 3, label: "Delivery" },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* ── Left Panel ── */}
      <div className="bg-amber-50 w-full md:w-1/2 min-h-screen flex flex-col">

        {/* Header */}
        <div className={`${f.className} text-2xl sm:text-3xl md:text-4xl pt-5 pl-5 md:pt-6 md:pl-6 text-amber-900`}>
          Get Your Account
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-0 px-5 md:px-6 pt-5 md:pt-6 pb-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 transition-all duration-300
                    ${step > s.id
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : step === s.id
                      ? "bg-white border-indigo-500 text-indigo-600"
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
                    step > s.id ? "bg-indigo-500" : "bg-gray-300"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 flex flex-col justify-center px-5 sm:px-8 pb-10 md:pb-12">

          {/* STEP 1 — Email */}
          {step === 1 && (
            <div className="space-y-5 w-full max-w-sm mx-auto md:mx-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Enter your email</h2>
                <p className="text-sm text-gray-500 mt-1">
                  We&apos;ll send your account details here after payment.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="email-input">
                  Email Address
                </label>
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
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white outline-none text-gray-800 placeholder-gray-400 transition-all duration-200
                    ${emailError
                      ? "border-red-400 focus:border-red-500"
                      : "border-gray-200 focus:border-indigo-400"
                    }`}
                />
                {emailError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span>⚠</span> {emailError}
                  </p>
                )}
              </div>
              <button
                id="email-next-btn"
                onClick={handleEmailNext}
                className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Continue →
              </button>
            </div>
          )}

          {/* STEP 2 — Payment */}
          {step === 2 && (
            <div className="space-y-5 w-full max-w-sm mx-auto md:mx-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Complete Payment</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Paying as <span className="font-medium text-indigo-600 break-all">{email}</span>
                </p>
              </div>

              {/* Order Summary */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 sm:p-5 space-y-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Account Access</span>
                  <span className="font-semibold text-gray-800">₹25</span>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="font-bold text-indigo-600 text-lg">₹25</span>
                </div>
              </div>

              {stockError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{stockError}</span>
                </div>
              )}

              <button
                id="pay-now-btn"
                onClick={handlePayment}
                disabled={stockChecking}
                className="w-full bg-linear-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {stockChecking
                  ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Checking availability…</>
                  : <><span>🔒</span> Pay with Crypto (Atlos)</>}
              </button>

              <button
                id="back-to-email-btn"
                onClick={() => setStep(1)}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
              >
                ← Back
              </button>

              <p className="text-xs text-gray-400 text-center">
                Secured by Atlos Crypto Gateway · 256-bit SSL encryption
              </p>
            </div>
          )}

          {/* STEP 3 — Delivery / Verification */}
          {step === 3 && (
            <div className="space-y-5 w-full max-w-sm mx-auto md:mx-0">
              {checking && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-14 h-14 rounded-full border-4 border-indigo-300 border-t-indigo-600 animate-spin" />
                  <p className="text-gray-600 font-medium">Verifying your payment…</p>
                </div>
              )}

              {!checking && paymentStatus === "success" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
                      ✅
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Payment Successful!</h2>
                    <p className="text-sm text-gray-500 text-center">
                      Your account details are being sent to{" "}
                      <span className="font-semibold text-indigo-600 break-all">{email}</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-green-100 p-4 space-y-2 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> Payment ID:{" "}
                      <span className="font-mono text-xs text-gray-500 truncate">{paymentId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> Details delivered to your email
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> Check your inbox (and spam folder)
                    </div>
                  </div>
                </div>
              )}

              {!checking && paymentStatus === "failed" && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl">
                    ❌
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Payment Failed</h2>
                  <p className="text-sm text-gray-500 text-center">
                    We couldn&apos;t verify your payment. Please try again.
                  </p>
                  <button
                    id="retry-pay-btn"
                    onClick={() => { setStep(2); setPaymentStatus("idle"); }}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile-only mini guide (shown below form on small screens) */}
        <div className="md:hidden flex gap-3 overflow-x-auto px-5 pb-8 scrollbar-hide">
          {[
            { icon: "✉️", title: "Enter Email", desc: "Your delivery address" },
            { icon: "💳", title: "Pay with Crypto", desc: "Via Atlos — instant" },
            { icon: "📬", title: "Get Details", desc: "Delivered instantly" },
          ].map((item, i) => (
            <div
              key={i}
              className={`shrink-0 flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2.5 shadow-sm border transition-all duration-300
                ${step === i + 1 ? "border-indigo-400 scale-105 shadow-md" : "border-gray-200"}`}
            >
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-800 whitespace-nowrap">{item.title}</p>
                <p className="text-xs text-gray-500 whitespace-nowrap">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel (hidden on mobile, visible on md+) ── */}
      <div className="hidden md:flex bg-blue-100 w-1/2 min-h-screen flex-col items-center justify-center gap-6">
        <Image src="/light.svg" alt="light" width={220} height={220} className="drop-shadow-2xl" loading="eager" />

        <div className="text-center space-y-2 px-8">
          <p className="text-blue-900 font-bold text-xl">Simple. Secure. Instant.</p>
          <p className="text-blue-700 text-sm leading-relaxed">
            Enter your email, complete the payment, and receive your account details immediately.
          </p>
        </div>

        {/* Desktop Guide Cards */}
        <div className="flex flex-col gap-3 w-64">
          {[
            { icon: "✉️", title: "Enter Email", desc: "Your delivery address" },
            { icon: "💳", title: "Pay with Crypto", desc: "Via Atlos — instant" },
            { icon: "📬", title: "Get Details", desc: "Delivered instantly" },
          ].map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 bg-white/60 backdrop-blur rounded-xl px-4 py-3 shadow-sm border transition-all duration-300
                ${step === i + 1 ? "border-indigo-400 scale-105 shadow-md" : "border-transparent"}`}
            >
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

