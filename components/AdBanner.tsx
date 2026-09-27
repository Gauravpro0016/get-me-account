"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

type AdBannerProps = {
  dataAdSlot: string;
  dataAdFormat?: string;
  dataFullWidthResponsive?: boolean;
  className?: string;
};

export default function AdBanner({
  dataAdSlot,
  dataAdFormat = "auto",
  dataFullWidthResponsive = true,
  className = "",
}: AdBannerProps) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.warn("AdSense push error:", err);
    }
  }, []);

  return (
    <div className={`overflow-hidden my-4 text-center ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4139303489598317"
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive.toString()}
      />
    </div>
  );
}
