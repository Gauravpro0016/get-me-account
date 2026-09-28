"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Product } from "./products";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  checkoutProduct: Product | null;
  setCheckoutProduct: (product: Product | null) => void;
  totalItems: number;
  subtotal: number;
  discount: number;
  promoCode: string;
  promoError: string;
  applyPromo: (code: string) => boolean;
  removePromo: () => void;
  notification: string | null;
  openCheckoutWithProduct: (product: Product) => void;
  openCheckoutWithCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [promoError, setPromoError] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("trinitymart_cart");
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load cart:", e);
    }
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("trinitymart_cart", JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to save cart:", e);
    }
  }, [items]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const isOutOfStock =
      !product.inStock ||
      (product.stockCount !== undefined && product.stockCount <= 0);
    if (isOutOfStock) {
      showNotification(`"${product.name.slice(0, 24)}" is currently out of stock.`);
      return;
    }

    const existing = items.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    if (
      product.stockCount !== undefined &&
      currentQty + quantity > product.stockCount
    ) {
      showNotification(`Cannot add more. Only ${product.stockCount} in stock.`);
      return;
    }

    setItems((prev) => {
      const match = prev.find((item) => item.product.id === product.id);
      if (match) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    showNotification(`Added ${product.name.slice(0, 24)}... to cart!`);
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const item = items.find((i) => i.product.id === productId);
    if (
      item &&
      item.product.stockCount !== undefined &&
      quantity > item.product.stockCount
    ) {
      showNotification(`Only ${item.product.stockCount} available in stock.`);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const applyPromo = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === "TRINITY10" || clean === "DISCORD10") {
      setPromoCode(clean);
      setDiscountPercent(10);
      setPromoError("");
      showNotification("10% discount applied!");
      return true;
    } else if (clean === "TRINITY20") {
      setPromoCode(clean);
      setDiscountPercent(20);
      setPromoError("");
      showNotification("20% VIP discount applied!");
      return true;
    } else {
      setPromoError("Invalid coupon code. Try TRINITY10");
      return false;
    }
  };

  const removePromo = () => {
    setPromoCode("");
    setDiscountPercent(0);
    setPromoError("");
  };

  const openCheckoutWithProduct = (product: Product) => {
    const isOutOfStock =
      !product.inStock ||
      (product.stockCount !== undefined && product.stockCount <= 0);
    if (isOutOfStock) {
      showNotification(`"${product.name.slice(0, 24)}" is out of stock.`);
      return;
    }
    setCheckoutProduct(product);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const openCheckoutWithCart = () => {
    const outOfStockItem = items.find(
      (item) =>
        !item.product.inStock ||
        (item.product.stockCount !== undefined && item.product.stockCount <= 0)
    );
    if (outOfStockItem) {
      showNotification(
        `"${outOfStockItem.product.name.slice(0, 24)}" is out of stock. Please remove it from your cart.`
      );
      return;
    }
    setCheckoutProduct(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const totalItems = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const rawSubtotal = items.reduce(
    (acc, curr) => acc + curr.product.price * curr.quantity,
    0
  );
  const discount = Math.round((rawSubtotal * discountPercent) / 100);
  const subtotal = Math.max(0, rawSubtotal - discount);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        checkoutProduct,
        setCheckoutProduct,
        totalItems,
        subtotal,
        discount,
        promoCode,
        promoError,
        applyPromo,
        removePromo,
        notification,
        openCheckoutWithProduct,
        openCheckoutWithCart,
      }}
    >
      {children}
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-zinc-900/95 dark:bg-zinc-900/95 text-white border border-cyan-500/40 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-bounce text-sm font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{notification}</span>
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
