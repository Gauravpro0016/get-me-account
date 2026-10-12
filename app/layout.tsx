import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import { ThemeProvider } from "@/lib/theme-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { CartProvider } from "@/lib/cart-context";
import { ClientLayoutWrapper } from "@/components/ClientLayoutWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trinitymart — Digital Keys & Gaming Accounts Marketplace",
  description:
    "India's #1 automated marketplace for Netflix keys, Steam CS2 Prime ID and passwords, Discord Nitro Boosters, Spotify, Minecraft, and PC game keys. Instant UPI & Crypto delivery with full replacement warranty.",
  keywords: [
    "Trinitymart",
    "Digital Keys",
    "Netflix Keys",
    "Steam ID Pass",
    "Steam CS2 Prime",
    "Discord Nitro with 2 Boosts",
    "Spotify Premium Key",
    "Minecraft Java Bedrock Key",
    "Instant Automated Delivery",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-[#0f131c] text-[#dfe2ee] font-sans antialiased selection:bg-[#6366f1] selection:text-white"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <CurrencyProvider>
            <CartProvider>
              <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
              <Analytics />
              <SpeedInsights />
            </CartProvider>
          </CurrencyProvider>
        </ThemeProvider>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4139303489598317"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <Script
          async
          src="https://atlos.io/packages/app/atlos.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
