import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base shimmering cyber skeleton block.
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer bg-[#202530] border border-[#2a303d]/40 rounded-md ${className}`}
      {...props}
    />
  );
}

/**
 * Product Card Skeleton:
 * Accurately mirrors Trinitymart's ProductCard dimensions, badge placements,
 * pricing, and button layouts.
 */
export function ProductCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-col justify-between bg-[#181c24] rounded-xl p-5 border border-[#262a33] shadow-md min-h-[380px] animate-pulse-subtle ${className}`}
    >
      <div className="flex flex-col gap-4">
        {/* Header: Visual Emblem + Stock Pill */}
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-[#262a33]" />
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="w-24 h-5 rounded-md" />
            <Skeleton className="w-14 h-3 rounded" />
          </div>
        </div>

        {/* Title & Service Type */}
        <div className="space-y-2 pt-1">
          <Skeleton className="w-28 h-3 rounded" />
          <Skeleton className="w-4/5 h-5 rounded-md" />
          <div className="space-y-1.5 pt-1">
            <Skeleton className="w-full h-3 rounded" />
            <Skeleton className="w-3/4 h-3 rounded" />
          </div>
        </div>

        {/* Guarantee Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Skeleton className="w-24 h-4 rounded" />
          <Skeleton className="w-20 h-4 rounded" />
        </div>
      </div>

      {/* Footer: Price & Action Buttons */}
      <div className="pt-4 mt-4 border-t border-[#262a33] space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <Skeleton className="w-20 h-6 rounded-md" />
            <Skeleton className="w-12 h-4 rounded" />
          </div>
          <Skeleton className="w-16 h-3 rounded" />
        </div>

        {/* Quantity and Action Buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="w-20 h-10 rounded-lg" />
          <Skeleton className="flex-1 h-10 rounded-lg" />
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
        </div>
      </div>
    </div>
  );
}

/**
 * Hero Section Skeleton:
 * Matches the headline, search bar, and hot vector tags on the homepage.
 */
export function HeroSkeleton() {
  return (
    <section className="relative w-full pt-12 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0a0e16] via-[#0f131c] to-[#0f131c] border-b border-[#262a33] overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-6">
        {/* Status Pill */}
        <Skeleton className="w-48 h-7 rounded-full" />

        {/* Big Hero Title */}
        <div className="space-y-3 flex flex-col items-center w-full max-w-3xl">
          <Skeleton className="w-4/5 h-10 sm:h-12 rounded-xl" />
          <Skeleton className="w-3/5 h-10 sm:h-12 rounded-xl" />
        </div>

        {/* Subtitle */}
        <div className="space-y-2 flex flex-col items-center w-full max-w-xl pt-1">
          <Skeleton className="w-full h-4 rounded" />
          <Skeleton className="w-4/5 h-4 rounded" />
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Skeleton className="w-36 h-11 rounded-xl" />
          <Skeleton className="w-40 h-11 rounded-xl" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="w-full max-w-2xl pt-6 space-y-3">
          <div className="relative">
            <Skeleton className="w-full h-14 rounded-2xl border border-[#31353e]" />
          </div>

          {/* Hot Vector Tags */}
          <div className="flex items-center justify-center gap-2 overflow-hidden pt-1">
            <Skeleton className="w-20 h-7 rounded-lg" />
            <Skeleton className="w-24 h-7 rounded-lg" />
            <Skeleton className="w-28 h-7 rounded-lg" />
            <Skeleton className="w-24 h-7 rounded-lg" />
            <Skeleton className="w-20 h-7 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Marquee Track Skeleton:
 * Horizontal stream of cards representing incoming account assets.
 */
export function MarqueeTrackSkeleton() {
  return (
    <section className="w-full bg-[#0a0e16] border-b border-[#262a33] py-5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="w-44 h-4 rounded" />
        </div>
        <Skeleton className="w-32 h-4 rounded hidden sm:block" />
      </div>

      <div className="flex gap-4 overflow-hidden px-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="w-64 sm:w-72 p-3.5 rounded-2xl bg-[#181c24] border border-[#262a33] shrink-0 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="w-16 h-2.5 rounded" />
                  <Skeleton className="w-28 h-3.5 rounded" />
                </div>
              </div>
              <Skeleton className="w-12 h-4 rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#262a33]">
              <Skeleton className="w-16 h-4 rounded" />
              <Skeleton className="w-20 h-4 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Metrics Telemetry Skeleton:
 * 4 metric benchmark cards.
 */
export function MetricsGridSkeleton() {
  return (
    <section className="w-full bg-[#0a0e16] px-4 sm:px-6 lg:px-8 py-10 border-t border-b border-[#262a33]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[#181c24] border border-[#262a33] rounded-xl p-5 flex flex-col gap-2 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-24 h-3.5 rounded" />
              <Skeleton className="w-5 h-5 rounded-md" />
            </div>
            <Skeleton className="w-20 h-7 rounded-md" />
            <Skeleton className="w-32 h-3 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Full Page Storefront Skeleton:
 * Used by app/loading.tsx for instantaneous zero-layout-shift visual skeleton.
 */
export function StorefrontSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[#0f131c] text-[#dfe2ee] overflow-hidden">
      {/* Top glowing loading bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-[#8083ff] via-[#4edea3] to-[#8083ff] animate-pulse" />

      {/* Hero Skeleton */}
      <HeroSkeleton />

      {/* Marquee Skeleton */}
      <MarqueeTrackSkeleton />

      {/* Main Catalog Section */}
      <section className="w-full bg-[#0f131c] px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="w-40 h-3.5 rounded" />
              <Skeleton className="w-64 h-8 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="w-12 h-4 rounded" />
              <Skeleton className="w-24 h-9 rounded-lg" />
              <Skeleton className="w-24 h-9 rounded-lg" />
              <Skeleton className="w-24 h-9 rounded-lg" />
            </div>
          </div>

          {/* Product Grid Skeleton (6 cards) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* Metrics Skeleton */}
      <MetricsGridSkeleton />
    </div>
  );
}

/**
 * Product Details Page Skeleton:
 * Used by app/product/[id]/loading.tsx
 */
export function ProductDetailSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[#0f131c] px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-[#8083ff] via-[#4edea3] to-[#8083ff] animate-pulse" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Link Breadcrumb */}
        <Skeleton className="w-36 h-6 rounded-lg" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Visual Emblem & Guarantees */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#181c24] border border-[#262a33] rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 min-h-[340px]">
              <Skeleton className="w-24 h-24 rounded-2xl" />
              <Skeleton className="w-40 h-6 rounded-lg" />
              <Skeleton className="w-28 h-4 rounded-full" />
            </div>

            {/* Feature guarantees cards */}
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-xl bg-[#181c24]" />
              <Skeleton className="h-20 rounded-xl bg-[#181c24]" />
            </div>
          </div>

          {/* Right Column: Title, Pricing, Actions */}
          <div className="lg:col-span-7 bg-[#181c24] border border-[#262a33] rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-20 h-5 rounded" />
                <Skeleton className="w-24 h-5 rounded" />
              </div>
              <Skeleton className="w-3/4 h-8 sm:h-10 rounded-lg" />
              <Skeleton className="w-full h-4 rounded" />
              <Skeleton className="w-4/5 h-4 rounded" />
            </div>

            {/* Price Row */}
            <div className="p-4 rounded-xl bg-[#10141d] border border-[#262a33] flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="w-16 h-3 rounded" />
                <div className="flex items-baseline gap-2">
                  <Skeleton className="w-28 h-8 rounded-lg" />
                  <Skeleton className="w-16 h-4 rounded" />
                </div>
              </div>
              <Skeleton className="w-28 h-6 rounded-full" />
            </div>

            {/* Quantity and CTA Buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Skeleton className="w-28 h-12 rounded-xl" />
                <Skeleton className="flex-1 h-12 rounded-xl" />
              </div>
              <Skeleton className="w-full h-12 rounded-xl" />
            </div>

            {/* Specifications checklist */}
            <div className="pt-4 border-t border-[#262a33] space-y-2">
              <Skeleton className="w-32 h-4 rounded" />
              <Skeleton className="w-full h-3 rounded" />
              <Skeleton className="w-5/6 h-3 rounded" />
              <Skeleton className="w-4/6 h-3 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Products Catalog Page Skeleton:
 * Used by app/products/loading.tsx
 */
export function ProductsCatalogSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[#0f131c] px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-gradient-to-r from-[#8083ff] via-[#4edea3] to-[#8083ff] animate-pulse" />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="w-32 h-4 rounded" />
          <Skeleton className="w-64 h-9 rounded-xl" />
          <Skeleton className="w-96 max-w-full h-4 rounded" />
        </div>

        {/* Search & Category Filter bar */}
        <div className="bg-[#181c24] border border-[#262a33] rounded-2xl p-4 sm:p-5 space-y-4">
          <Skeleton className="w-full h-12 rounded-xl" />
          <div className="flex items-center gap-2 overflow-hidden pt-1">
            <Skeleton className="w-16 h-8 rounded-lg" />
            <Skeleton className="w-24 h-8 rounded-lg" />
            <Skeleton className="w-28 h-8 rounded-lg" />
            <Skeleton className="w-24 h-8 rounded-lg" />
            <Skeleton className="w-20 h-8 rounded-lg" />
          </div>
        </div>

        {/* 6-8 Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <ProductCardSkeleton key={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Admin Panel Skeleton:
 * Used by app/admin/loading.tsx
 */
export function AdminDashboardSkeleton() {
  return (
    <div className="w-full min-h-screen bg-[#0a0e16] text-[#dfe2ee] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#262a33]">
        <div className="space-y-1">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <Skeleton className="w-64 h-3.5 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-24 h-9 rounded-lg" />
          <Skeleton className="w-28 h-9 rounded-lg" />
        </div>
      </div>

      {/* Metrics 4-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-[#141822] border border-[#262a33] space-y-2"
          >
            <Skeleton className="w-24 h-3.5 rounded" />
            <Skeleton className="w-20 h-7 rounded-lg" />
            <Skeleton className="w-32 h-3 rounded" />
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[#262a33] pb-2">
        <Skeleton className="w-24 h-9 rounded-lg" />
        <Skeleton className="w-28 h-9 rounded-lg" />
        <Skeleton className="w-24 h-9 rounded-lg" />
        <Skeleton className="w-32 h-9 rounded-lg" />
      </div>

      {/* Table block */}
      <div className="bg-[#141822] border border-[#262a33] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="w-48 h-6 rounded-md" />
          <Skeleton className="w-32 h-8 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <Skeleton key={row} className="w-full h-12 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
