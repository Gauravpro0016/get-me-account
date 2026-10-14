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
  Coins,
  Wallet,
  Ticket,
  Tag,
  Percent,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";
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

interface CryptoOrderData {
  order_id: string;
  amount_inr: number;
  amount_usd: number;
  quantity: number;
  merchant_id: string;
  email: string;
  productName: string;
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
    checkoutQuantity,
    setCheckoutQuantity,
    items,
    subtotal,
    clearCart,
  } = useCart();
  const { currency, formatPrice, inrToUsdRate } = useCurrency();

  const ACTIVE_ORDER_STORAGE_KEY = "trinitymart_active_checkout_v2";

  // Selected payment gateway method: "upi" (FamGateway) or "crypto" (Atlos)
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "crypto">("upi");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<FamGatewayOrder | null>(null);
  const [cryptoOrder, setCryptoOrder] = useState<CryptoOrderData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [timeLeft, setTimeLeft] = useState(300);
  const [deliveredCreds, setDeliveredCreds] = useState<CredentialResult | null>(
    null,
  );
  const [deliveredList, setDeliveredList] = useState<CredentialResult[]>([]);
  const [failReason, setFailReason] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Bank UTR submission & verification state (for UPI)
  const [utrInput, setUtrInput] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // Blockchain Transaction Hash (TxID) verification state (for Crypto)
  const [cryptoHashInput, setCryptoHashInput] = useState("");
  const [verifyingCryptoHash, setVerifyingCryptoHash] = useState(false);
  const [cryptoHashError, setCryptoHashError] = useState("");
  const [mempoolDetected, setMempoolDetected] = useState(false);

  // Coupon / Promo code state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountType: string;
    discountValue: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponSuccessMsg, setCouponSuccessMsg] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Automatically recommend crypto for USD users and UPI for INR users (after states are initialized)
  useEffect(() => {
    if (isCheckoutOpen && paymentStatus === "idle") {
      if (currency === "USD") {
        setPaymentMethod("crypto");
      } else {
        setPaymentMethod("upi");
      }
    }
  }, [isCheckoutOpen, currency, paymentStatus]);

  // Determine active purchase items & total amount
  const isSingleProduct = checkoutProduct !== null;
  const activeQuantity = isSingleProduct
    ? Math.max(1, checkoutQuantity || 1)
    : items.reduce((acc, curr) => acc + curr.quantity, 0);
  const rawSubtotal = isSingleProduct
    ? checkoutProduct.price * activeQuantity
    : subtotal;
  const currentTitle = isSingleProduct
    ? checkoutProduct.name
    : `${items.length} items in cart`;

  // Apply coupon discount if active (keep minimum 1 INR for gateway processing)
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const currentTotal = Math.max(1, Math.round(rawSubtotal - discountAmount));

  // Calculated USD amount for Atlos crypto gateway
  const inrRate = inrToUsdRate || APP_CONFIG.inrToUsdRate || 0.0118;
  const equivalentUsd = Math.max(
    0.01,
    Number((currentTotal * inrRate).toFixed(2)),
  );

  const isOutOfStock = isSingleProduct
    ? !checkoutProduct.inStock ||
      (checkoutProduct.stockCount !== undefined &&
        checkoutProduct.stockCount <= 0)
    : items.some(
        (item) =>
          !item.product.inStock ||
          (item.product.stockCount !== undefined &&
            item.product.stockCount <= 0),
      );

  // Poll for payment confirmation (supports both UPI and Atlos Crypto auto-checks)
  const startPolling = (
    orderId: string,
    emailToPoll?: string,
    method: "upi" | "crypto" = paymentMethod,
  ) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const targetEmail = (emailToPoll || email).trim().toLowerCase();

    pollIntervalRef.current = setInterval(async () => {
      // Guard against overlapping poll requests choking browser socket pool
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const queryParams = new URLSearchParams({
          order_id: orderId,
          orderId,
          method,
        });
        if (targetEmail) queryParams.set("email", targetEmail);

        const res = await fetch(
          `/api/confirm-payment?${queryParams.toString()}`,
          {
            cache: "no-store",
          },
        );
        const data = await res.json();

        // Automatic mempool detection indicator
        if (data.status === "mempool_detected") {
          setMempoolDetected(true);
        } else if (
          data.status === "COMPLETED" ||
          data.status === "SUCCESS" ||
          data.status === "confirmed"
        ) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setPaymentStatus("success");
          if (
            data.credentials &&
            Array.isArray(data.credentials) &&
            data.credentials.length > 0
          ) {
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
          setFailReason(
            data.message || data.reason || "Payment transaction was rejected.",
          );
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
        if (age < 15 * 60 * 1000 && (saved.order || saved.cryptoOrder)) {
          setEmail(saved.email || "");
          if (saved.order) setOrder(saved.order);
          if (saved.cryptoOrder) setCryptoOrder(saved.cryptoOrder);
          if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
          setPaymentStatus(saved.paymentStatus || "pending");
          if (saved.timeLeft) {
            const remaining = Math.max(
              10,
              saved.timeLeft - Math.floor(age / 1000),
            );
            setTimeLeft(remaining);
          }
          if (saved.deliveredCreds) setDeliveredCreds(saved.deliveredCreds);
          if (saved.deliveredList) setDeliveredList(saved.deliveredList);
          setIsCheckoutOpen(true);

          if (saved.paymentStatus === "pending") {
            const activeId =
              saved.cryptoOrder?.order_id || saved.order?.order_id;
            if (activeId) {
              startPolling(activeId, saved.email, saved.paymentMethod || "upi");
            }
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
    if (paymentStatus === "pending" && (order || cryptoOrder)) {
      try {
        localStorage.setItem(
          ACTIVE_ORDER_STORAGE_KEY,
          JSON.stringify({
            order,
            cryptoOrder,
            paymentMethod,
            email,
            paymentStatus,
            timeLeft,
            timestamp: Date.now(),
            deliveredCreds,
            deliveredList,
          }),
        );
      } catch {}
    } else if (paymentStatus === "success" && (order || cryptoOrder)) {
      try {
        localStorage.setItem(
          ACTIVE_ORDER_STORAGE_KEY,
          JSON.stringify({
            order,
            cryptoOrder,
            paymentMethod,
            email,
            paymentStatus,
            timestamp: Date.now(),
            deliveredCreds,
            deliveredList,
          }),
        );
      } catch {}
    } else if (paymentStatus === "idle" || paymentStatus === "failed") {
      try {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      } catch {}
    }
  }, [
    paymentStatus,
    order,
    cryptoOrder,
    paymentMethod,
    email,
    timeLeft,
    deliveredCreds,
    deliveredList,
  ]);

  // Dispatch beacon when user cuts, refreshes, or closes the payment window
  const notifyWindowCut = () => {
    const activeId = cryptoOrder?.order_id || order?.order_id;
    if (!activeId) return;
    const targetEmail = email?.trim().toLowerCase();
    const payload = JSON.stringify({
      orderId: activeId,
      email: targetEmail,
      method: paymentMethod,
    });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/payment/on-window-cut", blob);
      } else {
        fetch("/api/payment/on-window-cut", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("Could not send window-cut beacon:", e);
    }
  };

  // Window beforeunload & pagehide protection:
  // Warns user if they refresh, and automatically dispatches a beacon so server continues
  // monitoring the gateway and auto-sends the fulfillment email even if window is cut!
  useEffect(() => {
    if (paymentStatus !== "pending") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      notifyWindowCut();
      e.preventDefault();
      e.returnValue =
        "Payment in progress! Safe to close if paid: your credentials will automatically be sent to your email.";
      return e.returnValue;
    };

    const handlePageHide = () => {
      notifyWindowCut();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [paymentStatus, order, cryptoOrder, email, paymentMethod]);

  // Reset modal state on close
  const handleClose = () => {
    if (paymentStatus === "pending") {
      notifyWindowCut();
    }
    setIsCheckoutOpen(false);
    if (paymentStatus === "success") {
      clearCart();
      try {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      } catch {}
    }
    setOrder(null);
    setCryptoOrder(null);
    setPaymentStatus("idle");
    setUtrInput("");
    setVerificationError("");
    setCryptoHashInput("");
    setCryptoHashError("");
    setMempoolDetected(false);
    setShowCancelConfirm(false);
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
    setCouponSuccessMsg("");
    isPollingRef.current = false;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  };

  const handleForceClose = () => {
    if (paymentStatus === "pending") {
      notifyWindowCut();
    }
    try {
      localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
    } catch {}
    handleClose();
  };

  // Coupon application logic
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = couponInput.trim().toUpperCase();
    if (!clean) {
      setCouponError("Please enter a coupon code");
      return;
    }
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: clean,
          amount: rawSubtotal,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error || "Invalid coupon code");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: data.code,
          discountAmount: data.discountAmount,
          discountType: data.discountType,
          discountValue: data.discountValue,
        });
        setCouponSuccessMsg(data.message || `Coupon ${data.code} applied!`);
        setCouponError("");
      }
    } catch {
      setCouponError("Could not validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponSuccessMsg("");
    setCouponError("");
  };

  // Timer countdown
  useEffect(() => {
    if (paymentStatus !== "pending") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPaymentStatus("failed");
          setFailReason(
            "Payment session expired (5 minutes). Please try again.",
          );
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

  // Helper to launch Atlos Crypto Payment modal
  const handleOpenAtlosModal = (customCrypto?: CryptoOrderData) => {
    const activeCrypto = customCrypto || cryptoOrder;
    const targetOrderId = activeCrypto?.order_id || order?.order_id;
    const targetUsd = activeCrypto?.amount_usd || equivalentUsd;
    const merchantId =
      activeCrypto?.merchant_id ||
      APP_CONFIG.atlosMerchantId ||
      process.env.ATLOS_MERCHANT_ID ||
      process.env.ATLOS_MERCHANT_ID ||
      "ADK7QABYR0";

    if (!targetOrderId) return;

    if (typeof window !== "undefined" && (window as any).atlos) {
      try {
        (window as any).atlos.Pay({
          merchantId: merchantId || "demo",
          orderId: targetOrderId,
          orderAmount: targetUsd,
          orderCurrency: "USD",
          userEmail: email,
          theme: "dark",
          onSuccess: (blockchain: string, asset: string, txid: string) => {
            console.log(
              "Atlos tx broadcast detected:",
              blockchain,
              asset,
              txid,
            );
            setMempoolDetected(true);
            if (txid) {
              setCryptoHashInput(txid);
              // Immediately auto-verify and fulfill order with broadcast txid
              handleConfirmWithCryptoHash(txid);
            }
          },
          onCompleted: () => {
            console.log("Atlos onCompleted callback triggered");
            startPolling(targetOrderId, email, "crypto");
          },
          onCanceled: () => {
            console.log("Atlos modal closed");
          },
        });
      } catch (err) {
        console.warn("Could not invoke atlos.Pay:", err);
      }
    } else {
      console.warn("Atlos widget script not loaded yet");
    }
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOutOfStock) {
      setEmailError(
        isSingleProduct
          ? `"${checkoutProduct.name}" is currently out of stock.`
          : "Your cart contains out-of-stock items. Please remove them before checkout.",
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
      const quantity = activeQuantity;

      const cartItemsPayload = isSingleProduct
        ? [
            {
              productId: checkoutProduct.id,
              productName: checkoutProduct.name,
              quantity: activeQuantity,
              price: checkoutProduct.price,
            },
          ]
        : items.map((item) => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          }));

      if (paymentMethod === "crypto") {
        const res = await fetch("/api/crypto/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            quantity,
            amount: currentTotal,
            productId: isSingleProduct ? checkoutProduct.id : "cart",
            productName: currentTitle,
            cartItems: cartItemsPayload,
            couponCode: appliedCoupon?.code,
            discountAmount,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error || !json.data) {
          setEmailError(
            json.error ||
              "Unable to generate live Atlos crypto checkout session. Please try again.",
          );
        } else {
          const cryptoData: CryptoOrderData = json.data;
          setCryptoOrder(cryptoData);
          setOrder({
            order_id: cryptoData.order_id,
            amount: currentTotal,
            payable_amount: cryptoData.amount_usd,
            quantity: activeQuantity,
            qr_url: "",
            checkout_url: "",
            upi_intent: "",
          });
          setPaymentStatus("pending");
          setTimeLeft(300);
          startPolling(cryptoData.order_id, cleanEmail, "crypto");
          handleOpenAtlosModal(cryptoData);
        }
      } else {
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
            couponCode: appliedCoupon?.code,
            discountAmount,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.error || !json.data) {
          setEmailError(
            json.error ||
              "Unable to generate live UPI payment session. Please try again.",
          );
        } else {
          setOrder(json.data);
          setPaymentStatus("pending");
          setTimeLeft(300);
          startPolling(json.data.order_id, cleanEmail, "upi");
        }
      }
    } catch {
      setEmailError(
        "Failed to connect to payment gateway. Please check your internet connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Verify and confirm payment with Blockchain Transaction Hash (TxID)
  const handleConfirmWithCryptoHash = async (providedHash?: string) => {
    const targetOrderId = cryptoOrder?.order_id || order?.order_id;
    if (!targetOrderId) return;

    const finalHash = (providedHash || cryptoHashInput).trim();
    if (!finalHash) {
      setCryptoHashError(
        "Please enter your blockchain Transaction Hash (TxID).",
      );
      return;
    }

    setVerifyingCryptoHash(true);
    setCryptoHashError("");

    try {
      const res = await fetch("/api/crypto/verify-hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: targetOrderId,
          email,
          txHash: finalHash,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setPaymentStatus("success");
        if (
          data.credentials &&
          Array.isArray(data.credentials) &&
          data.credentials.length > 0
        ) {
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
        setCryptoHashError(
          data.error ||
            "Transaction verification failed. Please check the TxID or allow 30-60 seconds for blockchain confirmation.",
        );
      }
    } catch {
      setCryptoHashError("Network error while verifying transaction hash.");
    } finally {
      setVerifyingCryptoHash(false);
    }
  };

  // Confirm payment in database with UTR (for UPI)
  const handleConfirmWithUtr = async (providedUtr?: string) => {
    if (!order) return;
    setVerifyingPayment(true);
    setVerificationError("");

    const finalUtr = (providedUtr || utrInput).trim();
    if (!finalUtr) {
      setVerificationError(
        "Please enter your 12-digit UPI Bank Reference / UTR number.",
      );
      setVerifyingPayment(false);
      return;
    }
    if (!/^\d{12}$/.test(finalUtr)) {
      setVerificationError(
        "Invalid UTR: Bank Transaction Reference must be exactly 12 numeric digits (e.g. 423456789012).",
      );
      setVerifyingPayment(false);
      return;
    }

    try {
      const quantity = activeQuantity;

      const cartItemsPayload = isSingleProduct
        ? [
            {
              productId: checkoutProduct.id,
              productName: checkoutProduct.name,
              quantity: activeQuantity,
              price: checkoutProduct.price,
            },
          ]
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
        if (
          data.credentials &&
          Array.isArray(data.credentials) &&
          data.credentials.length > 0
        ) {
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
            "Payment verification failed: No matching bank settlement found. Please ensure payment is completed in UPI.",
        );
      }
    } catch {
      setVerificationError(
        "Network error while verifying payment with database.",
      );
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
      <div className="relative w-full max-w-lg bg-[#0f131c] rounded-2xl shadow-2xl border border-[#262a33] text-[#dfe2ee] z-10 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Cancel Confirmation Prompt for Active Payment */}
        {showCancelConfirm && (
          <div className="absolute inset-0 z-30 bg-[#0f131c]/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-[#93000a]/20 text-[#ffb4ab] flex items-center justify-center border border-[#ffb4ab]/30 animate-pulse">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#dfe2ee]">
                Payment In Progress!
              </h4>
              <p className="text-xs text-[#c7c4d7] mt-1.5 max-w-sm leading-relaxed">
                If you already sent payment or opened your UPI / Crypto app,{" "}
                <strong>rest assured:</strong> your credentials and receipt will{" "}
                <span className="text-emerald-400 font-bold">automatically be sent to {email || "your email"}</span>{" "}
                as soon as the gateway confirms your payment, even if you close this window now.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs pt-1">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Keep Open &amp; Enter UTR
              </button>
              <button
                type="button"
                onClick={handleForceClose}
                className="w-full py-2.5 rounded-xl bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] text-xs font-semibold border border-[#ffb4ab]/30 transition-all cursor-pointer"
              >
                Cancel Session
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262a33] bg-[#0a0e16]/95">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#262a33] text-[#8083ff] border border-[#31353e]">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#dfe2ee]">
              Instant Automated Checkout
            </h3>
          </div>
          <button
            onClick={handleCloseButtonClick}
            className="p-1.5 rounded-lg text-[#908fa0] hover:text-white transition-colors cursor-pointer"
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
              <div className="p-4 rounded-2xl bg-[#181c24] border border-[#262a33] flex items-center gap-3.5">
                {isSingleProduct ? (
                  <ProductIcon
                    type={checkoutProduct.iconType}
                    customLogoUrl={checkoutProduct.customLogoUrl}
                    logoSize={checkoutProduct.logoSize}
                    className="w-12 h-12 shrink-0 rounded-xl bg-[#0f131c] border border-[#262a33] p-1"
                    size={22}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-[#8083ff] flex items-center justify-center text-[#0d0096] font-black text-sm">
                    {items.length}x
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#dfe2ee] truncate">
                    {currentTitle}
                  </h4>
                  <div className="flex items-baseline flex-wrap gap-2 mt-1">
                    <span className="text-base font-black text-[#8083ff] font-mono">
                      {formatPrice(currentTotal)}
                    </span>
                    {discountAmount > 0 && (
                      <span className="text-xs text-[#908fa0] line-through font-mono">
                        {formatPrice(rawSubtotal)}
                      </span>
                    )}
                    <span className="text-xs text-[#908fa0] font-mono">
                      {currency === "USD"
                        ? `(~₹${currentTotal} INR)`
                        : `(~$${equivalentUsd} USD)`}
                    </span>
                    {isSingleProduct && activeQuantity > 1 && (
                      <span className="text-xs text-[#908fa0] font-mono">
                        ({formatPrice(checkoutProduct.price)} × {activeQuantity}
                        )
                      </span>
                    )}
                    {discountAmount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30">
                        -₹{discountAmount} COUPON
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        isOutOfStock
                          ? "text-[#ffb4ab] bg-[#93000a]/20 border border-[#ffb4ab]/30"
                          : "text-[#4edea3] bg-[#005236]/30 border border-[#4edea3]/30"
                      }`}
                    >
                      {isOutOfStock
                        ? "Out of Stock"
                        : "Instant Automated Delivery"}
                    </span>
                  </div>

                  {isSingleProduct && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] text-[#908fa0] font-medium">
                        Quantity:
                      </span>
                      <div className="inline-flex items-center rounded-lg bg-[#10141d] border border-[#262a33] p-0.5">
                        <button
                          type="button"
                          disabled={activeQuantity <= 1}
                          onClick={() =>
                            setCheckoutQuantity(Math.max(1, activeQuantity - 1))
                          }
                          className="w-6 h-6 rounded flex items-center justify-center text-xs text-[#908fa0] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-[#dfe2ee] font-mono">
                          {activeQuantity}
                        </span>
                        <button
                          type="button"
                          disabled={
                            checkoutProduct.stockCount !== undefined &&
                            activeQuantity >= checkoutProduct.stockCount
                          }
                          onClick={() => {
                            const maxStock = checkoutProduct.stockCount ?? 99;
                            setCheckoutQuantity(
                              Math.min(maxStock, activeQuantity + 1),
                            );
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center text-xs text-[#908fa0] hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      {checkoutProduct.stockCount !== undefined && (
                        <span className="text-[10px] text-[#908fa0] font-mono">
                          ({checkoutProduct.stockCount} in stock)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#c7c4d7]">
                  Recipient Email (For Keys & Credentials Delivery)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#908fa0] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    placeholder="your-email@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#10141d] border border-[#262a33] text-sm text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-[#ffb4ab] font-medium">
                    {emailError}
                  </p>
                )}
                <p className="text-[11px] text-[#908fa0]">
                  Your credentials and order receipt will be instantly
                  dispatched here.
                </p>
              </div>

              {/* Coupon / Promo Code Section */}
              <div className="p-3.5 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#c7c4d7] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#8083ff]" />
                    <span>Have a Promo / Coupon Code?</span>
                  </label>
                  {appliedCoupon && (
                    <span className="text-[10px] font-mono text-[#4edea3] font-bold bg-[#00a572]/20 px-2 py-0.5 rounded-md border border-[#00a572]/30">
                      ✓ APPLIED
                    </span>
                  )}
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xs font-mono font-bold text-emerald-300">
                          {appliedCoupon.code}
                        </div>
                        <div className="text-[10px] text-emerald-400/80">
                          {appliedCoupon.discountType === "percentage"
                            ? `${appliedCoupon.discountValue}% OFF`
                            : `Flat ₹${appliedCoupon.discountValue} OFF`}{" "}
                          (Saved ₹{appliedCoupon.discountAmount})
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          if (couponError) setCouponError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyCoupon();
                          }
                        }}
                        placeholder="ENTER CODE (e.g. WELCOME10)"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#181c24] border border-[#262a33] text-xs font-mono text-[#dfe2ee] placeholder-[#908fa0]/50 uppercase outline-none focus:border-[#8083ff]"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-[#262a33] hover:bg-[#8083ff] hover:text-[#0d0096] disabled:opacity-40 disabled:hover:bg-[#262a33] disabled:hover:text-inherit text-[#dfe2ee] text-xs font-bold font-mono transition-all cursor-pointer shrink-0"
                      >
                        {couponLoading ? "Applying…" : "Apply"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-[#ffb4ab] font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{couponError}</span>
                      </p>
                    )}
                    {couponSuccessMsg && !couponError && (
                      <p className="text-xs text-[#4edea3] font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{couponSuccessMsg}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Gateway Method Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#c7c4d7]">
                    Select Payment Gateway
                  </label>
                  <span className="text-[10px] text-[#908fa0] font-mono">
                    Currency: {currency}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-[#10141d] border border-[#262a33]">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upi")}
                    className={`py-3 px-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === "upi"
                        ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-lg shadow-[#8083ff]/20 border border-[#8083ff]"
                        : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24] font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <Zap
                        className={`w-3.5 h-3.5 ${paymentMethod === "upi" ? "text-[#0d0096]" : "text-amber-400"}`}
                      />
                      <span>UPI (FamGateway)</span>
                    </div>
                    <span className="text-[10px] opacity-90 font-mono">
                      ₹{currentTotal} INR • Instant QR
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("crypto")}
                    className={`py-3 px-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === "crypto"
                        ? "bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white font-bold shadow-lg shadow-orange-500/25 border border-orange-400/40"
                        : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24] font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <Coins
                        className={`w-3.5 h-3.5 ${paymentMethod === "crypto" ? "text-yellow-200" : "text-amber-400"}`}
                      />
                      <span>Crypto (ATLOS)</span>
                    </div>
                    <span className="text-[10px] opacity-90 font-mono">
                      ${equivalentUsd} USD • 0% Fees
                    </span>
                  </button>
                </div>
              </div>

              {/* Payment Methods Pill */}
              {paymentMethod === "upi" ? (
                <div className="p-3 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between text-xs text-[#908fa0]">
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#8083ff]" />
                    <span>Instant UPI Settlement • ₹{currentTotal} INR</span>
                  </div>
                  <span className="font-semibold text-[#4edea3]">0% Extra</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#181c24] border border-amber-500/25 flex items-center justify-between text-xs text-[#908fa0]">
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>
                      Non-Custodial Atlos Gateway • ${equivalentUsd} USD
                    </span>
                  </div>
                  <span className="font-semibold text-[#4edea3]">
                    0% Platform Fee
                  </span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading || isOutOfStock}
                className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  paymentMethod === "crypto"
                    ? "bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 text-white shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.01] active:scale-[0.99]"
                    : "bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white shadow-[#8083ff]/25 hover:shadow-[#8083ff]/40 hover:scale-[1.01] active:scale-[0.99]"
                }`}
              >
                {loading ? (
                  <span>
                    {paymentMethod === "crypto"
                      ? "Initializing Atlos Crypto Session..."
                      : "Generating Secure UPI Session..."}
                  </span>
                ) : isOutOfStock ? (
                  <span>Product Out of Stock — Cannot Proceed</span>
                ) : paymentMethod === "crypto" ? (
                  <>
                    <span>Proceed with Crypto (${equivalentUsd} USD)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>
                      Generate Instant UPI Payment (₹{currentTotal} INR)
                    </span>
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

              {/* Order ID & Live Tracking Card */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-[#141923] border border-[#262f40] flex items-center justify-between gap-3 text-left shadow-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">
                    <Tag className="w-3 h-3 text-[#8083ff]" />
                    <span>Order ID (Save to Track)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-black text-xs sm:text-sm text-[#8083ff] truncate select-all">
                      {order.order_id}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.order_id, "active-order-id")}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1f2430] hover:bg-[#2b3242] text-xs font-bold text-[#dfe2ee] flex items-center gap-1 border border-[#2e374a] transition-all cursor-pointer"
                    title="Copy Order ID"
                  >
                    {copiedField === "active-order-id" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#4edea3]" />
                        <span className="text-[#4edea3]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#908fa0]" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`/orders/lookup?orderId=${encodeURIComponent(order.order_id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-[#8083ff]/15 hover:bg-[#8083ff]/25 text-[#8083ff] text-xs font-bold flex items-center gap-1 border border-[#8083ff]/30 transition-all"
                    title="Track order status in live lookup dashboard"
                  >
                    <span>Track</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {paymentMethod === "crypto" ? (
                <>
                  {/* Auto-email on confirmation banner */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-teal-500/10 border border-amber-400/30 flex items-start gap-2.5 text-left shadow-sm">
                    <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                        <span>⚡ Safe to close window: Auto-email delivery guaranteed</span>
                      </p>
                      <p className="text-[11px] text-[#dfe2ee]/90 leading-snug">
                        Order confirmation &amp; tracking ID <span className="font-mono font-bold text-amber-300">#{order.order_id}</span> has been dispatched to <strong className="text-emerald-400">{email || "your email"}</strong>. Once on-chain payment settles, your credentials deliver automatically.
                      </p>
                    </div>
                  </div>

                  {/* Amount to pay */}
                  <div>
                    <span className="text-xs text-[#908fa0]">
                      Total Payable in Crypto
                    </span>
                    <div className="text-3xl font-black text-amber-400 font-mono mt-0.5">
                      ${order.payable_amount}{" "}
                      <span className="text-base text-[#908fa0] font-normal font-sans">
                        USD
                      </span>
                    </div>
                    <span className="text-[11px] text-[#908fa0] font-mono">
                      (Equivalent to ₹{order.amount || currentTotal} INR for{" "}
                      {order.quantity || activeQuantity}{" "}
                      {(order.quantity || activeQuantity) === 1
                        ? "unit"
                        : "units"}
                      )
                    </span>
                  </div>

                  {/* Mempool live detection indicator banner */}
                  {mempoolDetected && (
                    <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse shadow-lg shadow-amber-500/20">
                      <span>⚡</span>
                      <span>
                        Coin transaction detected in Mempool! Confirming
                        on-chain...
                      </span>
                    </div>
                  )}

                  {/* Atlos Pay Launch Card */}
                  <div className="p-5 rounded-2xl bg-[#181c24] border border-[#262a33] flex flex-col items-center justify-center space-y-3.5">
                    <button
                      type="button"
                      onClick={() => handleOpenAtlosModal()}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-orange-500/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    >
                      <Coins className="w-4 h-4 text-yellow-200" />
                      <span>
                        Open Atlos Crypto Checkout (Select Coin &amp; Wallet)
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-white/80" />
                    </button>

                    <div className="w-full flex items-center justify-center gap-1.5 flex-wrap text-[11px] text-[#dfe2ee] font-mono pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        USDT
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        USDC
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        BTC
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        ETH
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        SOL
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        LTC
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-[#10141d] border border-[#262a33]">
                        TRX
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[#4edea3]">
                      <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping" />
                      <span>
                        Auto-detecting incoming coin on blockchain every 2.5s
                      </span>
                    </div>
                  </div>

                  {/* Blockchain Transaction Hash / TxID Verification Section */}
                  <div className="p-4 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="crypto-hash-input"
                        className="text-xs font-bold text-[#dfe2ee] flex items-center gap-1.5"
                      >
                        <span>🔗</span> Sent Crypto? Enter Blockchain Tx Hash
                        (TxID):
                      </label>
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                        Instant Auto-Verify
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="crypto-hash-input"
                        type="text"
                        value={cryptoHashInput}
                        onChange={(e) => {
                          setCryptoHashInput(e.target.value);
                          if (cryptoHashError) setCryptoHashError("");
                        }}
                        placeholder="0x... or Solana / BTC TxID"
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/50 text-xs font-mono outline-none focus:border-amber-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmWithCryptoHash()}
                        disabled={verifyingCryptoHash}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-teal-600 hover:from-amber-400 hover:to-teal-500 disabled:opacity-50 text-white flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/25 cursor-pointer shrink-0"
                      >
                        {verifyingCryptoHash ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            <span>Verifying Tx…</span>
                          </>
                        ) : (
                          <>
                            <span>⚡ Verify TxID &amp; Claim</span>
                          </>
                        )}
                      </button>
                    </div>

                    {cryptoHashError && (
                      <p className="text-xs text-[#ffb4ab] font-semibold flex items-center gap-1">
                        <span>⚠️</span> {cryptoHashError}
                      </p>
                    )}

                    <p className="text-[11px] text-[#908fa0]">
                      After sending coin from MetaMask, Phantom, Trust Wallet,
                      Binance, or your exchange, copy the Transaction Hash
                      (TxID) and paste here for instant verification.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Auto-email on UPI payment banner */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-[#8083ff]/10 to-teal-500/10 border border-emerald-400/30 flex items-start gap-2.5 text-left shadow-sm">
                    <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                        <span>⚡ Safe to close window: Auto-email delivery guaranteed</span>
                      </p>
                      <p className="text-[11px] text-[#dfe2ee]/90 leading-snug">
                        Order confirmation &amp; tracking ID <span className="font-mono font-bold text-emerald-300">#{order.order_id}</span> has been dispatched to <strong className="text-emerald-400">{email || "your email"}</strong>. Once UPI payment settles, your credentials deliver automatically.
                      </p>
                    </div>
                  </div>

                  {/* Amount to pay */}
                  <div>
                    <span className="text-xs text-[#908fa0]">
                      Amount Payable via UPI
                    </span>
                    <div className="text-3xl font-black text-[#dfe2ee] font-mono mt-0.5">
                      ₹{order.payable_amount || order.amount || currentTotal}{" "}
                      <span className="text-base text-[#908fa0] font-normal font-sans">
                        INR
                      </span>
                    </div>
                    <span className="text-[11px] text-[#908fa0] font-mono">
                      (~${equivalentUsd} USD)
                    </span>
                    {(order.quantity || activeQuantity) > 1 && (
                      <span className="text-[11px] text-[#908fa0] font-mono block mt-0.5">
                        ({order.quantity || activeQuantity} units @ ₹
                        {Math.round(
                          Number(
                            order.payable_amount ||
                              order.amount ||
                              currentTotal,
                          ) / (order.quantity || activeQuantity),
                        )}{" "}
                        each)
                      </span>
                    )}
                  </div>

                  {/* UPI QR Display or UPI link */}
                  <div className="p-5 rounded-2xl bg-[#181c24] border border-[#262a33] flex flex-col items-center justify-center space-y-3">
                    {order.qr_url ? (
                      <div className="relative w-48 h-48 rounded-xl overflow-hidden shadow-md bg-white p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={order.qr_url}
                          alt="UPI QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-44 h-44 rounded-2xl bg-[#10141d] border-2 border-dashed border-[#8083ff]/40 flex flex-col items-center justify-center p-4">
                        <QrCode className="w-16 h-16 text-[#8083ff] mb-2 animate-pulse" />
                        <span className="text-xs font-bold text-[#dfe2ee]">
                          Scan with any UPI App
                        </span>
                        <span className="text-[11px] text-[#908fa0] font-mono">
                          {order.upi_id || "trinitymart@upi"}
                        </span>
                        <span className="text-[10px] text-[#8083ff] font-mono mt-1">
                          Ref Order: #{order.order_id}
                        </span>
                      </div>
                    )}

                    {/* Mobile Intent link */}
                    <a
                      href={order.upi_intent || "#"}
                      className="w-full py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                    </a>
                  </div>

                  {/* Bank Reference / UTR Input Section */}
                  <div className="p-4 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="utr-input"
                        className="text-xs font-bold text-[#dfe2ee] flex items-center gap-1.5"
                      >
                        <span>🏦</span> Paid via UPI? Enter Bank UTR / Ref ID:
                      </label>
                      <span className="text-[10px] text-[#8083ff] font-semibold bg-[#8083ff]/10 px-2 py-0.5 rounded-full border border-[#8083ff]/20 font-mono">
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
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/50 text-xs font-mono outline-none focus:border-[#8083ff] transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmWithUtr()}
                        disabled={verifyingPayment}
                        className="px-4 py-2.5 rounded-xl font-bold text-xs bg-[#4edea3] hover:bg-[#3ec48e] text-[#003822] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#4edea3]/20 cursor-pointer shrink-0"
                      >
                        {verifyingPayment ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-[#003822]/40 border-t-[#003822] rounded-full animate-spin" />
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
                      <p className="text-xs text-[#ffb4ab] font-semibold flex items-center gap-1">
                        <span>⚠️</span> {verificationError}
                      </p>
                    )}

                    <p className="text-[11px] text-[#908fa0]">
                      After completing payment in Google Pay / PhonePe / Paytm,
                      copy the 12-digit UPI Transaction ID or Bank UTR and paste
                      above.
                    </p>
                  </div>
                </>
              )}
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

              {/* Order ID & Live Tracking Reference on Success */}
              {(order?.order_id || cryptoOrder?.order_id) && (
                <div className="p-3.5 rounded-2xl bg-[#141923] border border-[#262f40] flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-[#908fa0] tracking-wider block">
                      Order ID (Save for Tracking &amp; Warranty)
                    </span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-[#4edea3] truncate block mt-0.5 select-all">
                      {order?.order_id || cryptoOrder?.order_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          order?.order_id || cryptoOrder?.order_id || "",
                          "success-order-id",
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-[#1f2430] hover:bg-[#2b3242] text-xs font-bold text-[#dfe2ee] flex items-center gap-1 border border-[#2e374a] transition-all cursor-pointer"
                      title="Copy Order ID"
                    >
                      {copiedField === "success-order-id" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#4edea3]" />
                          <span className="text-[#4edea3]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#908fa0]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`/orders/lookup?orderId=${encodeURIComponent(order?.order_id || cryptoOrder?.order_id || "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center gap-1 border border-emerald-500/30 transition-all"
                      title="Open Track Order page"
                    >
                      <span>Track Order</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Delivered Credentials Card */}
              {((deliveredList && deliveredList.length > 0) ||
                deliveredCreds) && (
                <div className="space-y-3 text-left">
                  {(deliveredList && deliveredList.length > 0
                    ? deliveredList
                    : [deliveredCreds!]
                  ).map((cred, idx) => {
                    const itemTitle =
                      cred.productName ||
                      (deliveredList.length > 1
                        ? `Unit #${idx + 1}`
                        : currentTitle);
                    const accountId =
                      cred.fields?.id ||
                      cred.fields?.username ||
                      cred.fields?.login ||
                      (cred.email &&
                      cred.email !== email &&
                      !cred.email.includes("@")
                        ? cred.email
                        : cred.fields?.email ||
                          (cred.email !== email ? cred.email : ""));
                    const password =
                      cred.fields?.password ||
                      cred.password ||
                      cred.emailPassword;
                    const token =
                      cred.fields?.token || cred.token || cred.fields?.key;
                    const pin =
                      cred.fields?.pin ||
                      cred.twoFactorKey ||
                      cred.fields?.["2fa"];

                    return (
                      <div
                        key={cred.id || idx}
                        className="p-4 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-[#4edea3] pb-1.5 border-b border-[#262a33]">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            {itemTitle}
                          </span>
                          <span className="text-[10px] bg-[#005236]/30 text-[#4edea3] border border-[#4edea3]/30 px-2 py-0.5 rounded-full font-semibold">
                            Active Warranty
                          </span>
                        </div>

                        {/* Account ID / Username */}
                        {accountId && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-[#10141d] border border-[#262a33]">
                            <div className="text-xs">
                              <span className="text-[#908fa0] block text-[10px] font-bold">
                                ACCOUNT ID / USERNAME
                              </span>
                              <span className="font-mono font-bold text-[#dfe2ee]">
                                {accountId}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(accountId, `id-${idx}`)
                              }
                              className="p-1.5 text-[#908fa0] hover:text-[#8083ff] cursor-pointer"
                              title="Copy ID"
                            >
                              {copiedField === `id-${idx}` ? (
                                <Check className="w-4 h-4 text-[#4edea3]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Password */}
                        {password && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-[#10141d] border border-[#262a33]">
                            <div className="text-xs">
                              <span className="text-[#908fa0] block text-[10px] font-bold">
                                PASSWORD / ACCESS
                              </span>
                              <span className="font-mono font-bold text-[#dfe2ee]">
                                {password}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(password, `pass-${idx}`)
                              }
                              className="p-1.5 text-[#908fa0] hover:text-[#8083ff] cursor-pointer"
                              title="Copy Password"
                            >
                              {copiedField === `pass-${idx}` ? (
                                <Check className="w-4 h-4 text-[#4edea3]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* License Key / Token */}
                        {token && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-[#10141d] border border-[#262a33]">
                            <div className="text-xs">
                              <span className="text-[#908fa0] block text-[10px] font-bold">
                                LICENSE KEY / CODE
                              </span>
                              <span className="font-mono font-bold text-[#dfe2ee] break-all">
                                {token}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                copyToClipboard(token, `token-${idx}`)
                              }
                              className="p-1.5 text-[#908fa0] hover:text-[#8083ff] cursor-pointer"
                              title="Copy Key"
                            >
                              {copiedField === `token-${idx}` ? (
                                <Check className="w-4 h-4 text-[#4edea3]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* 2FA / PIN */}
                        {pin && (
                          <div className="flex items-center justify-between p-2 rounded-lg bg-[#10141d] border border-[#262a33]">
                            <div className="text-xs">
                              <span className="text-[#908fa0] block text-[10px] font-bold">
                                2FA / PIN CODE
                              </span>
                              <span className="font-mono font-bold text-[#dfe2ee]">
                                {pin}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(pin, `pin-${idx}`)}
                              className="p-1.5 text-[#908fa0] hover:text-[#8083ff] cursor-pointer"
                              title="Copy PIN"
                            >
                              {copiedField === `pin-${idx}` ? (
                                <Check className="w-4 h-4 text-[#4edea3]" />
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
                                className="flex items-center justify-between p-2 rounded-lg bg-[#10141d] border border-[#262a33]"
                              >
                                <div className="text-xs min-w-0 pr-2">
                                  <span className="text-[#908fa0] block text-[10px] font-bold uppercase truncate">
                                    {k}
                                  </span>
                                  <span className="font-mono font-bold text-[#dfe2ee] break-all">
                                    {valStr}
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    copyToClipboard(valStr, copyKey)
                                  }
                                  className="p-1.5 text-[#908fa0] hover:text-[#8083ff] cursor-pointer shrink-0"
                                  title={`Copy ${k}`}
                                >
                                  {copiedField === copyKey ? (
                                    <Check className="w-4 h-4 text-[#4edea3]" />
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
                {(order?.order_id || cryptoOrder?.order_id) && (
                  <a
                    href={`/orders/lookup?orderId=${encodeURIComponent(order?.order_id || cryptoOrder?.order_id || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1c2230] hover:bg-[#262e40] border border-[#2e394e] text-[#dfe2ee] text-xs font-bold transition-all"
                  >
                    <span>🔍 View Order Details &amp; Track Status</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#8083ff]" />
                  </a>
                )}

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
                  className="w-full py-2.5 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] text-xs font-bold transition-all cursor-pointer"
                >
                  Done &amp; Continue Shopping
                </button>
              </div>
            </div>
          )}

          {/* Failed State */}
          {paymentStatus === "failed" && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/30 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-[#dfe2ee]">
                Payment Not Completed
              </h4>
              <p className="text-xs text-[#908fa0] max-w-sm mx-auto">
                {failReason ||
                  "The payment session expired or was interrupted. No charges were made."}
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setPaymentStatus("idle")}
                  className="flex-1 py-3 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white text-xs font-bold cursor-pointer"
                >
                  Try Again
                </button>
                <a
                  href={APP_CONFIG.discordLink || "/discord"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-[#181c24] border border-[#262a33] text-[#dfe2ee] hover:bg-[#262a33] text-xs font-bold flex items-center justify-center gap-1.5"
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
