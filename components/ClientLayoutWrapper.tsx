"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { CartDrawer } from "@/components/CartDrawer";
import { FloatingCartButton } from "@/components/FloatingCartButton";
import { CheckoutModal } from "@/components/CheckoutModal";
import { Footer } from "@/components/Footer";

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
