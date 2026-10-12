import React from "react";
import { ProductsCatalogSkeleton } from "@/components/Skeleton";

/**
 * Products Catalog Loading Screen (app/products/loading.tsx):
 * Automatically displayed while /products catalog loads or updates.
 */
export default function ProductsLoading() {
  return <ProductsCatalogSkeleton />;
}
