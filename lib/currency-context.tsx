"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { APP_CONFIG } from "./config";

export type CurrencyType = "INR" | "USD";

interface CurrencyContextType {
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;
  toggleCurrency: () => void;
  currencySymbol: string;
  inrToUsdRate: number;
  formatPrice: (inrAmount: number) => string;
  formatRawAmount: (inrAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyType>("INR");

  const inrToUsdRate = APP_CONFIG.inrToUsdRate || 0.0118;

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trinitymart_currency") as CurrencyType;
      if (saved === "INR" || saved === "USD") {
        setCurrencyState(saved);
      }
    } catch {}
  }, []);

  const setCurrency = (c: CurrencyType) => {
    setCurrencyState(c);
    try {
      localStorage.setItem("trinitymart_currency", c);
    } catch {}
  };

  const toggleCurrency = () => {
    setCurrency(currency === "INR" ? "USD" : "INR");
  };

  const currencySymbol = currency === "INR" ? "₹" : "$";

  const formatRawAmount = (inrAmount: number): number => {
    if (currency === "USD") {
      return Number((inrAmount * inrToUsdRate).toFixed(2));
    }
    return Math.round(inrAmount);
  };

  const formatPrice = (inrAmount: number): string => {
    if (currency === "USD") {
      const usdVal = (inrAmount * inrToUsdRate).toFixed(2);
      return `$${usdVal}`;
    }
    return `₹${Math.round(inrAmount)}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        currencySymbol,
        inrToUsdRate,
        formatPrice,
        formatRawAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
