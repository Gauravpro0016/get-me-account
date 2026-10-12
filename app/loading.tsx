import React from "react";
import { StorefrontSkeleton } from "@/components/Skeleton";

/**
 * Root Loading Screen (app/loading.tsx):
 * Next.js automatically mounts this skeleton during page loads, transitions,
 * or server rendering to provide an instant, seamless visual experience.
 */
export default function Loading() {
  return <StorefrontSkeleton />;
}
