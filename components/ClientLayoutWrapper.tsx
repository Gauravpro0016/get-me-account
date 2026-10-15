"use client";

import React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { FloatingCartButton } from "@/components/FloatingCartButton";
import { Footer } from "@/components/Footer";

const CartDrawer = dynamic(() => import("@/components/CartDrawer").then((m) => m.CartDrawer), {
  ssr: false,
});
const CheckoutModal = dynamic(() => import("@/components/CheckoutModal").then((m) => m.CheckoutModal), {
  ssr: false,
});

export function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  // On /admin route (including password page and dashboard), hide store Navbar, Cart & Footer
  if (isAdmin) {
    return <main className="flex-1 w-full min-h-screen">{children}</main>;
  }

  // On public store routes, render Navbar, cart widgets, and Footer
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-20">{children}</main>
      <CartDrawer />
      <FloatingCartButton />
      <CheckoutModal />
      <Footer />
    </>
  );
}
