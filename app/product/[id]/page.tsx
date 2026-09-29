"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Star,
  Zap,
  ShieldCheck,
  Headset,
  ShoppingCart,
  ArrowRight,
  Check,
  ExternalLink,
  ChevronLeft,
  Plus,
  Minus,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import {
  getProductById,
  getAllProducts,
  getClientInitialProducts,
  Product,
  ACTIVE_PRODUCTS_CACHE_KEY,
  REMOVED_IDS_CACHE_KEY,
} from "@/lib/products";
import { ProductIcon } from "@/components/ProductIcons";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductListScrollBar } from "@/components/ProductListScrollBar";
import { useCart } from "@/lib/cart-context";
import { APP_CONFIG } from "@/lib/config";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [product, setProduct] = useState<Product | undefined>(() => getProductById(id));
  const [allProducts, setAllProducts] = useState<Product[]>(getClientInitialProducts);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addToCart, openCheckoutWithProduct, setIsCartOpen } = useCart();

  useEffect(() => {
    async function loadProductData() {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json();
        if (data.products && Array.isArray(data.products)) {
          setAllProducts(data.products);
          const found = data.products.find((p: Product) => p.id === id);
          if (found) setProduct(found);
          try {
            localStorage.setItem(ACTIVE_PRODUCTS_CACHE_KEY, JSON.stringify(data.products));
            if (data.removedIds && Array.isArray(data.removedIds)) {
              localStorage.setItem(REMOVED_IDS_CACHE_KEY, JSON.stringify(data.removedIds));
            }
          } catch {}
        }
      } catch (e) {
        console.warn("Failed to load dynamic product:", e);
      }
    }
    loadProductData();
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-4 bg-[#050811] text-white">
        <h2 className="text-2xl font-black text-white">
          Product Not Found
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
          The requested digital key or account could not be located.
        </p>
        <Link
          href="/products"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/30"
        >
          Return to Store Catalog
        </Link>
      </div>
    );
  }

  const relatedProducts = allProducts.filter(
    (p) => p.id !== product.id && p.category === product.category
  );

  const isOutOfStock =
    !product.inStock ||
    (product.stockCount !== undefined && product.stockCount <= 0);

  const discountPercent = Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100
  );

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    openCheckoutWithProduct(product);
  };

  return (
    <div className="min-h-screen bg-[#050811] dark:bg-[#050811] light:bg-[#f1f5f9] text-white dark:text-white light:text-slate-900 py-10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Back Link */}
        <div>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Products</span>
          </button>
        </div>

        {/* Product Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Visual Showcase */}
          <div className="lg:col-span-5 space-y-4">
            <div
              className={`relative h-[340px] sm:h-[420px] rounded-3xl p-8 flex flex-col justify-between overflow-hidden shadow-2xl border border-cyan-500/30 ${
                !product.customBgUrl
                  ? `bg-gradient-to-br ${product.bannerGradient || "from-blue-600/25 via-cyan-950/40 to-zinc-900"}`
                  : "bg-slate-900"
              }`}
              style={
                product.customBgUrl
                  ? {
                      backgroundImage: `url(${product.customBgUrl})`,
                      backgroundSize: product.bgSize || "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : undefined
              }
            >
              {/* Overlay for text readability when custom background image is applied */}
              {product.customBgUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-black/50 to-black/30 pointer-events-none" />
              )}
              <div className="absolute -top-16 -right-16 w-52 h-52 bg-cyan-500/25 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-[#050811]/70 text-cyan-300 backdrop-blur-md border border-cyan-500/30">
                  {product.category}
                </span>
                {product.badge && (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400 text-black shadow-lg shadow-amber-500/40">
                    {product.badge}
                  </span>
                )}
              </div>

              {/* Big Product Icon */}
              <div className="flex flex-col items-center justify-center my-auto relative z-10 py-6">
                <ProductIcon
                  type={product.iconType}
                  customLogoUrl={product.customLogoUrl}
                  logoSize={product.logoSize}
                  className="w-28 h-28 sm:w-36 sm:h-36 shadow-2xl"
                  size={56}
                />
              </div>

              <div className="flex items-center justify-between relative z-10 pt-2 border-t border-cyan-500/20">
                <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>{product.deliveryType}</span>
                </div>
                <span className="text-xs font-bold text-slate-200">
                  {!isOutOfStock
                    ? `📦 ${product.stockCount} Available in Pool`
                    : "⚠️ Out of Stock"}
                </span>
              </div>
            </div>

            {/* Quick Guarantees Box */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#0a1120] border border-cyan-500/20 flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  {product.warranty}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#0a1120] border border-cyan-500/20 flex items-center gap-2.5">
                <Zap className="w-5 h-5 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  10-Second UPI Delivery
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Specs, and Purchase Controls */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              {/* Star Rating */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(product.reviewsCount > 0 ? product.rating : 5)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-black text-white">
                  {product.reviewsCount > 0 ? product.rating : "5.0"} / 5.0
                </span>
                <span className="text-xs text-slate-400">
                  ({product.reviewsCount} customer {product.reviewsCount === 1 ? "review" : "reviews"})
                </span>
              </div>

              {/* Title - Bold White Font */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight font-sans">
                {product.name}
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed font-medium">
                {product.description}
              </p>
            </div>

            {/* Price section */}
            <div className="p-5 rounded-2xl bg-[#0a1120] border border-cyan-500/25 space-y-2 shadow-lg">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-white">
                  {APP_CONFIG.currencySymbol}
                  {product.price * quantity}
                </span>
                {product.originalPrice > product.price && (
                  <span className="text-base text-slate-400 line-through">
                    {APP_CONFIG.currencySymbol}
                    {product.originalPrice * quantity}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                    SAVE {discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Instant delivery to screen and email upon UPI payment completion.
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-300">
                Quantity:
              </span>
              <div className="flex items-center rounded-xl border border-cyan-500/30 bg-[#0a1120]">
                <button
                  disabled={isOutOfStock || quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 text-sm font-black text-white">
                  {isOutOfStock ? 0 : quantity}
                </span>
                <button
                  disabled={
                    isOutOfStock ||
                    (product.stockCount !== undefined &&
                      quantity >= product.stockCount)
                  }
                  onClick={() =>
                    setQuantity((prev) =>
                      product.stockCount !== undefined
                        ? Math.min(product.stockCount, prev + 1)
                        : prev + 1
                    )
                  }
                  className="p-2 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {product.stockCount !== undefined && product.stockCount > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  (Max available: {product.stockCount})
                </span>
              )}
            </div>

            {/* Action Buttons: Add to Cart and Buy Now, or Out of Stock Notice */}
            {isOutOfStock ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center gap-3 text-rose-400 font-black text-sm select-none shadow-lg">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 animate-pulse" />
                <span>Currently Out of Stock — Automated Restocking in Progress</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  className={`flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-lg ${
                    added
                      ? "bg-emerald-500 text-white shadow-emerald-500/40"
                      : "bg-[#0f1a30] hover:bg-[#18284c] text-white border-2 border-cyan-400/50 hover:border-cyan-400 shadow-cyan-900/30"
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 text-cyan-400" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleBuyNow}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-cyan-500/30 hover:shadow-cyan-400/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>Instant Buy Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Key Features Checklist */}
            <div className="p-6 rounded-3xl bg-[#0a1120] border border-cyan-500/20 space-y-3 shadow-lg">
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                What&apos;s Included in this Order
              </h4>
              <ul className="space-y-2.5">
                {product.features.map((feat, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-200 font-medium"
                  >
                    <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {product.customFields && product.customFields.length > 0 && (
                <div className="pt-3 border-t border-cyan-500/10 space-y-1.5">
                  <span className="text-[11px] font-bold text-cyan-400 block uppercase tracking-wider">
                    Credentials &amp; Access Details Provided:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {product.customFields.map((f, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium"
                      >
                        ✓ {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 24/7 Discord Support Callout for this product */}
            <div className="p-4 rounded-2xl bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-white">
                <Headset className="w-4 h-4 text-cyan-300" />
                <span>Need help with activation? Staff is active on Discord</span>
              </div>
              <a
                href={APP_CONFIG.discordLink || "/discord"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-black text-cyan-300 hover:underline flex items-center gap-1"
              >
                <span>Join Discord</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Customer Reviews for this specific product */}
        <ProductReviews
          productId={product.id}
          initialReviews={product.reviews}
          productTitle={product.name}
        />

        {/* Related Products Scroll Bar */}
        {relatedProducts.length > 0 && (
          <div className="pt-6">
            <ProductListScrollBar
              products={relatedProducts}
              title={`More in ${product.category}`}
              subtitle="Explore similar digital products and gaming deals"
            />
          </div>
        )}
      </div>
    </div>
  );
}
