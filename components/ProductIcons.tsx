import React from "react";
import {
  Film,
  Gamepad2,
  Headphones,
  Music,
  Tv,
  Key,
  ShieldCheck,
  Zap,
  Box,
  Flame,
  Globe,
  Sparkles,
} from "lucide-react";

interface ProductIconProps {
  type?: string;
  className?: string;
  size?: number;
  customLogoUrl?: string;
  logoSize?: "small" | "medium" | "large" | "xl" | string;
}

export function ProductIcon({
  type = "key",
  className = "",
  size = 28,
  customLogoUrl,
  logoSize = "medium",
}: ProductIconProps) {
  const scaleClass =
    logoSize === "small"
      ? "scale-[0.78]"
      : logoSize === "large"
      ? "scale-[1.25]"
      : logoSize === "xl"
      ? "scale-[1.5]"
      : "scale-100";

  // If custom logo image URL is provided, display image with selected scale
  if (customLogoUrl && customLogoUrl.trim()) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-2xl bg-black/40 backdrop-blur-md border border-cyan-500/30 shadow-xl overflow-hidden p-2 transition-transform duration-300 ${className}`}
      >
        <img
          src={customLogoUrl}
          alt="Product Logo"
          className={`w-full h-full object-contain drop-shadow-lg transition-transform duration-300 ${scaleClass}`}
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  const renderIconContent = () => {
    switch (type) {
      case "netflix":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-950 text-white shadow-lg shadow-red-500/20 ${className}`}
          >
            <Film size={size} className={`text-white drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "steam":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-900 to-slate-900 text-white shadow-lg shadow-blue-500/20 ${className}`}
          >
            <Gamepad2 size={size} className={`text-cyan-300 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "discord":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-700 to-purple-900 text-white shadow-lg shadow-indigo-500/20 ${className}`}
          >
            <Headphones size={size} className={`text-white drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "spotify":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-950 text-white shadow-lg shadow-emerald-500/20 ${className}`}
          >
            <Music size={size} className={`text-emerald-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "xbox":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-950 text-white shadow-lg shadow-green-500/20 ${className}`}
          >
            <Zap size={size} className={`text-white drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "minecraft":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-orange-950 text-white shadow-lg shadow-amber-500/20 ${className}`}
          >
            <Box size={size} className={`text-amber-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "gta":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 via-amber-600 to-stone-900 text-white shadow-lg shadow-yellow-500/20 ${className}`}
          >
            <Flame size={size} className={`text-yellow-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "youtube":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-red-950 text-white shadow-lg shadow-rose-500/20 ${className}`}
          >
            <Tv size={size} className={`text-white drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "windows":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-blue-950 text-white shadow-lg shadow-cyan-500/20 ${className}`}
          >
            <Key size={size} className={`text-cyan-100 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "vpn":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-950 text-white shadow-lg shadow-blue-500/20 ${className}`}
          >
            <ShieldCheck size={size} className={`text-blue-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "key":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-700 to-indigo-950 text-white shadow-lg shadow-cyan-500/20 ${className}`}
          >
            <Key size={size} className={`text-cyan-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "flame":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 via-amber-600 to-red-950 text-white shadow-lg shadow-rose-500/20 ${className}`}
          >
            <Flame size={size} className={`text-amber-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "zap":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-900 text-white shadow-lg shadow-amber-500/20 ${className}`}
          >
            <Zap size={size} className={`text-yellow-100 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      case "shield":
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-700 to-emerald-950 text-white shadow-lg shadow-emerald-500/20 ${className}`}
          >
            <ShieldCheck size={size} className={`text-emerald-200 drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
      default:
        return (
          <div
            className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20 ${className}`}
          >
            <Sparkles size={size} className={`text-white drop-shadow-md transition-transform ${scaleClass}`} />
          </div>
        );
    }
  };

  return renderIconContent();
}
