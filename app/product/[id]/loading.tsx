import React from "react";
import { ProductDetailSkeleton } from "@/components/Skeleton";

/**
 * Product Detail Loading Screen (app/product/[id]/loading.tsx):
 * Displayed while navigating to individual product pages.
 */
export default function ProductLoading() {
  return <ProductDetailSkeleton />;
}
