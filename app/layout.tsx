import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { ThemeProvider } from "@/lib/theme-context";
import { CartProvider } from "@/lib/cart-context";
import { ClientLayoutWrapper } from "@/components/ClientLayoutWrapper";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trinitymart — Buy Netflix Keys, Steam ID & Pass, Discord Nitro & Gaming Accounts",
  description:
    "India's #1 automated marketplace for Netflix keys, Steam CS2 Prime ID and passwords, Discord Nitro Boosters, Spotify, Minecraft, and PC game keys. Instant UPI delivery with full replacement warranty.",
  keywords: [
    "Trinitymart",
    "Netflix Keys",
    "Steam ID Pass",
    "Steam CS2 Prime",
    "Discord Nitro with 2 Boosts",
    "Spotify Premium Key",
    "Minecraft Java Bedrock Key",
    "Instant Automated UPI Delivery",
    "Gaming Marketplace India",
  ],
  other: {
    "google-adsense-account": "ca-pub-4139303489598317",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col transition-colors duration-200 dark"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <CartProvider>
            <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
            <Analytics />
            <SpeedInsights />
          </CartProvider>
        </ThemeProvider>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4139303489598317"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
