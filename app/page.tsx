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
  const [confirmationMsg, setConfirmationMsg] = useState("");
  const [failReason, setFailReason] = useState("");

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
      orderAmount: 0.1, // USD equivalent – update as needed
      currency: "USD",
      asset: "LTC",     // Lock to Litecoin
      onSuccess: (data: { orderId: string; txId: string; paymentId?: string }) => {
        // Atlos may return paymentId (their internal UUID) or txId (the blockchain tx hash)
        const atlasPaymentId = data.paymentId ?? data.txId ?? data.orderId;
        setPaymentId(atlasPaymentId);
        setStep(3);
        verifyPayment(data.orderId, atlasPaymentId);
      },
      onError: () => {
        setPaymentStatus("failed");
        setFailReason("The payment was canceled or encountered an error.");
        setStep(3);
      },
    });
  };


  const verifyPayment = async (orderId: string, paymentId: string) => {
    setChecking(true);
    setFailReason("");
    setConfirmationMsg("Transaction detected — waiting for blockchain confirmation…");

    // Start a message rotation so the user knows we are actively waiting
    const messages = [
      "Transaction detected — waiting for blockchain confirmation…",
      "Confirming on the blockchain (this may take a few minutes)…",
      "Still confirming — crypto networks need a moment…",
      "Almost there — verifying your payment on-chain…",
    ];
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setConfirmationMsg(messages[msgIdx]);
    }, 15_000);

    const startTime = Date.now();
    const maxWaitMs = 15 * 60 * 1000; // 15 minutes client timeout
    const pollIntervalMs = 5000;      // check every 5 seconds

    try {
      while (Date.now() - startTime < maxWaitMs) {
        try {
          const res = await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, orderId, paymentId }),
          });
          const data = await res.json();

          if ((res.ok && data.status === "confirmed") || data.status === "already_sent") {
            setPaymentStatus("success");
            return;
          }

          if (data.status === "failed") {
            console.error("Payment failed:", data);
            setFailReason(data.reason ?? data.error ?? "Payment could not be confirmed.");
            setPaymentStatus("failed");
            return;
          }

          // If pending, continue to wait and poll again
        } catch (fetchErr) {
          console.warn("Polling network blip, retrying...", fetchErr);
        }

        // Wait before next check
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      // If loop times out after 15 minutes
      setFailReason(
        "Confirmation is taking longer than usual on the network. Once the blockchain finishes validating, your account details will still be sent to your email automatically."
      );
      setPaymentStatus("failed");
    } catch (err) {
      console.error("Network error:", err);
      setFailReason("Network error — please check your internet connection.");
      setPaymentStatus("failed");
    } finally {
      clearInterval(msgTimer);
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

              {/* Waiting for on-chain confirmation */}
              {checking && (
                <div className="flex flex-col items-center gap-5 py-8">
                  {/* Pulsing ring animation */}
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-50" />
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-300 border-t-indigo-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🔗</div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-gray-800 font-semibold text-base">Waiting for blockchain confirmation</p>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-xs">{confirmationMsg}</p>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 text-center max-w-xs">
                    This page will update automatically. You do not need to refresh.
                  </p>
                </div>
              )}

              {/* Success */}
              {!checking && paymentStatus === "success" && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
                      ✅
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Payment Confirmed!</h2>
                    <p className="text-sm text-gray-500 text-center">
                      Your account details have been sent to{" "}
                      <span className="font-semibold text-indigo-600 break-all">{email}</span>
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl border-2 border-green-100 p-4 space-y-2 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> On-chain payment verified
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> Account details sent to your email
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-green-500 shrink-0">✔</span> Check your inbox (and spam folder)
                    </div>
                    {paymentId && (
                      <div className="flex items-start gap-2 text-sm text-gray-600 pt-1 border-t border-gray-100">
                        <span className="text-gray-400 shrink-0 mt-0.5">ID</span>
                        <span className="font-mono text-xs text-gray-400 break-all">{paymentId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Failed */}
              {!checking && paymentStatus === "failed" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl">
                    ❌
                  </div>
                  <div className="text-center space-y-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Payment Not Confirmed</h2>
                    <p className="text-sm text-gray-500">
                      {failReason || "We couldn't verify your payment. Please try again."}
                    </p>
                  </div>
                  <button
                    id="retry-pay-btn"
                    onClick={() => { setStep(2); setPaymentStatus("idle"); setFailReason(""); }}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
                  >
                    Try Again
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    If you believe this is an error, contact support with your payment ID:
                    <span className="block font-mono break-all mt-1">{paymentId}</span>
                  </p>
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

