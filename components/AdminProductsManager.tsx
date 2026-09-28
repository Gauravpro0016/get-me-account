"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Package,
  Layers,
  Sparkles,
  Zap,
  Key,
  Lock,
  User,
  Shield,
  Search,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Tag,
  Flame,
  Pencil,
  Image as ImageIcon,
  Palette,
  Upload,
  Maximize2,
} from "lucide-react";
import { Product } from "@/lib/products";
import { ProductIcon } from "./ProductIcons";
import { APP_CONFIG } from "@/lib/config";

const GRADIENT_PRESETS = [
  { name: "Cyber Blue", value: "from-blue-600/25 via-cyan-950/40 to-zinc-900", border: "border-cyan-500/40" },
  { name: "Crimson Fire", value: "from-red-600/25 via-rose-950/40 to-zinc-900", border: "border-rose-500/40" },
  { name: "Royal Purple", value: "from-purple-600/25 via-indigo-950/40 to-zinc-900", border: "border-purple-500/40" },
  { name: "Emerald Matrix", value: "from-emerald-600/25 via-teal-950/40 to-zinc-900", border: "border-emerald-500/40" },
  { name: "Sunset Amber", value: "from-amber-600/25 via-orange-950/40 to-zinc-900", border: "border-amber-500/40" },
  { name: "Obsidian Gold", value: "from-yellow-600/25 via-stone-900/60 to-black", border: "border-yellow-500/40" },
  { name: "Synthwave Pink", value: "from-pink-600/25 via-purple-950/40 to-zinc-900", border: "border-pink-500/40" },
  { name: "Stealth Dark", value: "from-zinc-700/25 via-zinc-900/60 to-black", border: "border-zinc-500/40" },
];

const BUILTIN_ICONS = [
  "key",
  "netflix",
  "steam",
  "discord",
  "spotify",
  "xbox",
  "minecraft",
  "gta",
  "youtube",
  "windows",
  "vpn",
  "shield",
  "zap",
  "flame",
  "box",
  "sparkles",
];

const LOGO_SIZES = [
  { id: "small", label: "Small (78%)", desc: "Compact" },
  { id: "medium", label: "Medium (100%)", desc: "Standard" },
  { id: "large", label: "Large (125%)", desc: "Prominent" },
  { id: "xl", label: "Hero XL (150%)", desc: "Hero focus" },
];

const BG_SIZES = [
  { id: "cover", label: "Cover (Fill)", desc: "Crops to fill area" },
  { id: "contain", label: "Contain (Fit)", desc: "Shows whole image" },
  { id: "auto", label: "Original (Auto)", desc: "Native resolution" },
  { id: "100% 100%", label: "Stretch (100%)", desc: "Edge-to-edge stretch" },
];

const handleImageFileToBase64 = (
  file: File,
  onSuccess: (dataUrl: string) => void,
  onError?: (err: string) => void
) => {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image file (PNG, JPG, SVG, WebP, GIF).");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    alert("Image file size must be less than 2MB for fast loading.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") {
      onSuccess(reader.result);
    }
  };
  reader.onerror = () => {
    alert("Failed to read image file.");
    if (onError) onError("Failed to read image file");
  };
  reader.readAsDataURL(file);
};

interface AdminProductsManagerProps {
  adminPassword: string;
}

export function AdminProductsManager({ adminPassword }: AdminProductsManagerProps) {
  const [activeProducts, setActiveProducts] = useState<Product[]>([]);
  const [removedProducts, setRemovedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "removed">("active");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);

  // Stock Inventory Manager Modal State
  const [stockModalTab, setStockModalTab] = useState<"view" | "add">("view");
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [revealedStockPasswords, setRevealedStockPasswords] = useState<Set<string>>(new Set());
  const [showAllStockPasswords, setShowAllStockPasswords] = useState(false);
  const [copiedStockId, setCopiedStockId] = useState<string>("");
  const [deletingStockItemId, setDeletingStockItemId] = useState<string | null>(null);
  const [addingStock, setAddingStock] = useState(false);

  // Single Add form in Stock Manager
  const [singleStockId, setSingleStockId] = useState("");
  const [singleStockPass, setSingleStockPass] = useState("");
  const [singleStockKey, setSingleStockKey] = useState("");
  const [singleStockPin, setSingleStockPin] = useState("");
  const [showSinglePass, setShowSinglePass] = useState(false);

  // Bulk Add form in Stock Manager
  const [stockBulkMode, setStockBulkMode] = useState(false);
  const [stockBulkText, setStockBulkText] = useState("");

  // Edit Product Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Gaming");
  const [editPrice, setEditPrice] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState("");
  const [editStockCount, setEditStockCount] = useState("");
  const [editInStock, setEditInStock] = useState(true);
  const [editBadge, setEditBadge] = useState<string>("None");
  const [editDeliveryType, setEditDeliveryType] = useState<string>("Instant Account ID + Pass");
  const [editWarranty, setEditWarranty] = useState<string>("Full Replacement Warranty");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [editBannerGradient, setEditBannerGradient] = useState("from-blue-600/25 via-cyan-950/40 to-zinc-900");
  const [editIconType, setEditIconType] = useState("key");
  const [editCustomLogoUrl, setEditCustomLogoUrl] = useState("");
  const [editLogoSize, setEditLogoSize] = useState<string>("medium");
  const [editCustomBgUrl, setEditCustomBgUrl] = useState("");
  const [editBgSize, setEditBgSize] = useState<string>("cover");

  // Add Product Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Gaming");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [badge, setBadge] = useState<string>("Instant Key");
  const [deliveryType, setDeliveryType] = useState<string>("Instant Account ID + Pass");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [featureInputs, setFeatureInputs] = useState<string[]>([
    "Instant Automated Delivery",
    "100% Full Replacement Warranty",
    "24/7 Discord Live Support",
  ]);
  const [bannerGradient, setBannerGradient] = useState("from-blue-600/25 via-cyan-950/40 to-zinc-900");
  const [iconType, setIconType] = useState("key");
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [logoSize, setLogoSize] = useState<string>("medium");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [bgSize, setBgSize] = useState<string>("cover");

  // Custom Options / Fields toggles
  const [fieldOptions, setFieldOptions] = useState({
    includeId: true,
    includePassword: true,
    includeKey: false,
    includePin: false,
    customName: "",
  });

  // Stock inventory items to add
  const [inventoryList, setInventoryList] = useState<Record<string, string>[]>([]);
  const [stockInputId, setStockInputId] = useState("");
  const [stockInputPass, setStockInputPass] = useState("");
  const [stockInputKey, setStockInputKey] = useState("");
  const [stockInputPin, setStockInputPin] = useState("");
  const [stockInputCustom, setStockInputCustom] = useState("");
  const [bulkStockText, setBulkStockText] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch products from server
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", {
        headers: { Authorization: `Bearer ${adminPassword}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.allProducts) {
        setActiveProducts(data.allProducts);
      }
      if (data.removedProducts) {
        setRemovedProducts(data.removedProducts);
      }
    } catch (e) {
      console.error("Failed to load products:", e);
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Handle adding a single stock credential to the pending list
  const handleAddStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: Record<string, string> = {};
    if (fieldOptions.includeId && stockInputId.trim()) item.id = stockInputId.trim();
    if (fieldOptions.includePassword && stockInputPass.trim()) item.password = stockInputPass.trim();
    if (fieldOptions.includeKey && stockInputKey.trim()) item.token = stockInputKey.trim();
    if (fieldOptions.includePin && stockInputPin.trim()) item.pin = stockInputPin.trim();
    if (fieldOptions.customName && stockInputCustom.trim()) item[fieldOptions.customName] = stockInputCustom.trim();

    if (Object.keys(item).length === 0) {
      alert("Please provide at least one credential field!");
      return;
    }

    setInventoryList((prev) => [...prev, item]);
    setStockInputId("");
    setStockInputPass("");
    setStockInputKey("");
    setStockInputPin("");
    setStockInputCustom("");
  };

  // Parse bulk text (e.g. user:pass:key or user:pass)
  const handleParseBulk = () => {
    if (!bulkStockText.trim()) return;
    const lines = bulkStockText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: Record<string, string>[] = [];

    for (const line of lines) {
      const parts = line.split(":");
      const item: Record<string, string> = {};
      if (parts.length >= 2) {
        item.id = parts[0].trim();
        item.password = parts[1].trim();
        if (parts[2]) item.token = parts[2].trim();
      } else {
        item.token = line.trim();
      }
      parsed.push(item);
    }

    setInventoryList((prev) => [...prev, ...parsed]);
    setBulkStockText("");
    setBulkMode(false);
  };

  // Submit New Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) {
      setStatusMsg({ type: "error", text: "Product name and price are required." });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    // Build custom fields schema
    const customFields = [];
    if (fieldOptions.includeId) customFields.push({ id: "id", name: "Account ID / Login", type: "text" });
    if (fieldOptions.includePassword) customFields.push({ id: "password", name: "Password", type: "password" });
    if (fieldOptions.includeKey) customFields.push({ id: "token", name: "License Key / Code", type: "key" });
    if (fieldOptions.includePin) customFields.push({ id: "pin", name: "2FA / PIN Code", type: "text" });
    if (fieldOptions.customName) customFields.push({ id: fieldOptions.customName, name: fieldOptions.customName, type: "text" });

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          category,
          price: Number(price),
          originalPrice: originalPrice ? Number(originalPrice) : Number(price) * 1.5,
          badge: badge === "None" ? undefined : badge,
          deliveryType,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          features: featureInputs,
          customFields,
          initialStock: inventoryList,
          bannerGradient,
          iconType,
          customLogoUrl: customLogoUrl.trim() || undefined,
          logoSize,
          customBgUrl: customBgUrl.trim() || undefined,
          bgSize,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to create product");
      }

      setStatusMsg({ type: "success", text: `Product "${name}" added successfully with ${inventoryList.length} stock items!` });
      await loadProducts();

      // Reset form
      setName("");
      setPrice("");
      setOriginalPrice("");
      setShortDescription("");
      setDescription("");
      setInventoryList([]);
      setBannerGradient("from-blue-600/25 via-cyan-950/40 to-zinc-900");
      setIconType("key");
      setCustomLogoUrl("");
      setLogoSize("medium");
      setCustomBgUrl("");
      setBgSize("cover");
      setIsAddModalOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to create product" });
    } finally {
      setSubmitting(false);
    }
  };

  // REMOVE / DELETE ANY PRODUCT
  const handleRemoveProduct = async (id: string, prodName: string) => {
    if (!confirm(`Are you sure you want to remove "${prodName}" from Trinitymart store? It will no longer be visible to buyers.`)) return;

    try {
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminPassword}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: "success", text: `Removed "${prodName}" from active store.` });
        loadProducts();
      } else {
        alert(data.error || "Failed to remove product");
      }
    } catch (e: any) {
      alert(e.message || "Failed to remove product");
    }
  };

  // RESTORE A REMOVED PRODUCT
  const handleRestoreProduct = async (id: string, prodName: string) => {
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify({ id, restore: true }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: "success", text: `Restored "${prodName}" back to active store!` });
        loadProducts();
      } else {
        alert(data.error || "Failed to restore product");
      }
    } catch (e: any) {
      alert(e.message || "Failed to restore product");
    }
  };

  // Open Edit Product Modal prefilled with product details
  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditCategory(prod.category || "Gaming");
    setEditPrice(String(prod.price));
    setEditOriginalPrice(prod.originalPrice ? String(prod.originalPrice) : "");
    setEditStockCount(String(prod.stockCount ?? 0));
    setEditInStock(prod.inStock ?? true);
    setEditBadge(prod.badge || "None");
    setEditDeliveryType(prod.deliveryType || "Instant Account ID + Pass");
    setEditWarranty(prod.warranty || "Full Replacement Warranty");
    setEditShortDescription(prod.shortDescription || "");
    setEditDescription(prod.description || "");
    setEditFeatures(Array.isArray(prod.features) ? [...prod.features] : []);
    setNewFeatureText("");
    setEditBannerGradient(prod.bannerGradient || "from-blue-600/25 via-cyan-950/40 to-zinc-900");
    setEditIconType(prod.iconType || "key");
    setEditCustomLogoUrl(prod.customLogoUrl || "");
    setEditLogoSize(prod.logoSize || "medium");
    setEditCustomBgUrl(prod.customBgUrl || "");
    setEditBgSize(prod.bgSize || "cover");
    setIsEditModalOpen(true);
  };

  // Save Edited Product to Database via PUT /api/admin/products
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim() || !editPrice) {
      alert("Product title and sale price are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify({
          action: "edit",
          id: editingProduct.id,
          name: editName.trim(),
          category: editCategory,
          price: Number(editPrice),
          originalPrice: editOriginalPrice ? Number(editOriginalPrice) : Number(editPrice),
          stockCount: Math.max(0, Number(editStockCount) || 0),
          inStock: editInStock,
          badge: editBadge,
          deliveryType: editDeliveryType,
          warranty: editWarranty,
          shortDescription: editShortDescription.trim(),
          description: editDescription.trim(),
          features: editFeatures,
          bannerGradient: editBannerGradient,
          iconType: editIconType,
          customLogoUrl: editCustomLogoUrl.trim() || undefined,
          logoSize: editLogoSize,
          customBgUrl: editCustomBgUrl.trim() || undefined,
          bgSize: editBgSize,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update product");
      }

      setStatusMsg({
        type: "success",
        text: `Product "${editName}" updated successfully in database!`,
      });
      setIsEditModalOpen(false);
      setEditingProduct(null);
      await loadProducts();
    } catch (err: any) {
      alert(err.message || "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Stock Modal for a product
  const openStockModal = (prod: Product) => {
    setTargetProduct(prod);
    setStockModalTab("view");
    setStockSearchQuery("");
    setRevealedStockPasswords(new Set());
    setShowAllStockPasswords(false);
    setCopiedStockId("");
    setSingleStockId("");
    setSingleStockPass("");
    setSingleStockKey("");
    setSingleStockPin("");
    setShowSinglePass(false);
    setStockBulkText("");
    setStockBulkMode(false);
    setIsStockModalOpen(true);
  };

  const toggleRevealStockPassword = (itemId: string) => {
    setRevealedStockPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleShowAllPasswords = () => {
    if (showAllStockPasswords) {
      setRevealedStockPasswords(new Set());
      setShowAllStockPasswords(false);
    } else {
      const allIds = (targetProduct?.inventory || []).map((i) => i.id);
      setRevealedStockPasswords(new Set(allIds));
      setShowAllStockPasswords(true);
    }
  };

  const copyStockValue = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStockId(id);
    setTimeout(() => setCopiedStockId(""), 2000);
  };

  // Delete an individual stock credential item from database
  const handleDeleteStockItem = async (inventoryItemId: string) => {
    if (!targetProduct) return;
    if (!confirm("Are you sure you want to delete this credential unit from database?")) return;

    setDeletingStockItemId(inventoryItemId);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify({
          id: targetProduct.id,
          action: "delete_stock_item",
          inventoryItemId,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete credential");
      }

      setTargetProduct((prev) =>
        prev
          ? {
              ...prev,
              inventory: data.inventory,
              stockCount: data.stockCount,
              inStock: data.inStock,
            }
          : null
      );

      setActiveProducts((prev) =>
        prev.map((p) =>
          p.id === targetProduct.id
            ? {
                ...p,
                inventory: data.inventory,
                stockCount: data.stockCount,
                inStock: data.inStock,
              }
            : p
        )
      );

      setStatusMsg({
        type: "success",
        text: "Credential successfully removed from database!",
      });
    } catch (err: any) {
      alert(err.message || "Failed to delete credential");
    } finally {
      setDeletingStockItemId(null);
    }
  };

  // Add stock to an existing product (Single or Bulk)
  const handleSaveStockToDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;

    const itemsToAdd: Record<string, string>[] = [];

    if (stockBulkMode) {
      if (!stockBulkText.trim()) {
        alert("Please paste credentials lines (e.g. username:password)");
        return;
      }
      const lines = stockBulkText.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const parts = line.split(":");
        if (parts.length >= 2) {
          itemsToAdd.push({
            id: parts[0].trim(),
            password: parts[1].trim(),
            ...(parts[2] ? { token: parts[2].trim() } : {}),
            ...(parts[3] ? { pin: parts[3].trim() } : {}),
          });
        } else {
          itemsToAdd.push({
            token: line.trim(),
          });
        }
      }
    } else {
      const item: Record<string, string> = {};
      if (singleStockId.trim()) item.id = singleStockId.trim();
      if (singleStockPass.trim()) item.password = singleStockPass.trim();
      if (singleStockKey.trim()) item.token = singleStockKey.trim();
      if (singleStockPin.trim()) item.pin = singleStockPin.trim();

      if (Object.keys(item).length === 0) {
        alert("Please provide at least one credential field (e.g. Account ID or Password)");
        return;
      }
      itemsToAdd.push(item);
    }

    setAddingStock(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
        },
        body: JSON.stringify({
          id: targetProduct.id,
          action: "add_stock",
          stockItems: itemsToAdd,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to save stock to database");
      }

      setTargetProduct((prev) =>
        prev
          ? {
              ...prev,
              inventory: data.inventory,
              stockCount: data.stockCount,
              inStock: data.inStock,
            }
          : null
      );

      setActiveProducts((prev) =>
        prev.map((p) =>
          p.id === targetProduct.id
            ? {
                ...p,
                inventory: data.inventory,
                stockCount: data.stockCount,
                inStock: data.inStock,
              }
            : p
        )
      );

      setStatusMsg({
        type: "success",
        text: `✅ ${data.message || `Added ${itemsToAdd.length} credential(s) to database!`}`,
      });

      // Clear inputs
      setSingleStockId("");
      setSingleStockPass("");
      setSingleStockKey("");
      setSingleStockPin("");
      setStockBulkText("");
      setStockBulkMode(false);

      // Automatically switch to "view" tab to see newly added credentials
      setStockModalTab("view");
    } catch (err: any) {
      alert(err.message || "Failed to update stock");
    } finally {
      setAddingStock(false);
    }
  };

  // Copy all available accounts in username:password format
  const handleCopyAllCredentials = () => {
    if (!targetProduct || !targetProduct.inventory) return;
    const active = targetProduct.inventory.filter((item: any) => !item.claimedAt);
    if (active.length === 0) {
      alert("No available credentials to copy.");
      return;
    }

    const text = active
      .map((item: any) => {
        const id = item.fields?.id || item.fields?.email || item.fields?.username || "";
        const pwd = item.fields?.password || item.fields?.emailPassword || "";
        const token = item.fields?.token || item.fields?.key || "";
        const pin = item.fields?.pin || "";
        if (id && pwd) {
          let line = `${id}:${pwd}`;
          if (token) line += `:${token}`;
          if (pin) line += `:${pin}`;
          return line;
        }
        return token || id || pwd;
      })
      .join("\n");

    copyStockValue(text, "all-credentials");
  };

  // Active / Removed Products list
  const currentList = viewMode === "active" ? activeProducts : removedProducts;

  const filteredProducts = currentList.filter((p) => {
    const matchesCategory = categoryFilter === "All" || p.category.toLowerCase() === categoryFilter.toLowerCase();
    const cleanSearch = search.trim().toLowerCase();
    const matchesSearch = !cleanSearch || p.name.toLowerCase().includes(cleanSearch) || p.category.toLowerCase().includes(cleanSearch);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/60 border border-cyan-500/20 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
              <Package className="w-4 h-4" />
            </span>
            <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400">
              Product Catalog Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Manage Store Products &amp; Custom Options
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Add new products with custom IDs/passes, restock existing products, or remove products anytime.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="underline text-slate-400">
            Dismiss
          </button>
        </div>
      )}

      {/* View Mode Tabs (Active vs Removed) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900/80 border border-cyan-500/20">
          <button
            onClick={() => setViewMode("active")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              viewMode === "active"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Active Products</span>
            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px]">
              {activeProducts.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode("removed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              viewMode === "removed"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Removed / Unlisted</span>
            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px]">
              {removedProducts.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-400">
          {viewMode === "active" ? (
            <span>Showing products currently active on the store.</span>
          ) : (
            <span className="text-rose-400 font-semibold">
              These products are hidden and unlisted from all buyer pages.
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/40 border border-cyan-500/15">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by title or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/40 border border-cyan-500/20 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {["All", "Streaming", "Gaming", "Discord", "Software & Keys"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/30"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-3xl bg-[#0a1120] border border-cyan-500/20 space-y-3">
          <p className="text-sm font-bold text-slate-300">
            {viewMode === "active"
              ? "No active products found matching filters."
              : "No removed or unlisted products."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="p-5 rounded-3xl bg-[#0a1120] border border-cyan-500/20 hover:border-cyan-400/50 transition-all space-y-4 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductIcon type={prod.iconType} className="w-12 h-12 shrink-0" size={20} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate" title={prod.name}>
                      {prod.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-cyan-400">
                        {APP_CONFIG.currencySymbol}{prod.price}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                        {prod.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remove button in header */}
                {viewMode === "active" ? (
                  <button
                    onClick={() => handleRemoveProduct(prod.id, prod.name)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                    title="Remove product from store"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestoreProduct(prod.id, prod.name)}
                    className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer"
                    title="Restore product to store"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Specs Preview */}
              {(() => {
                const activeUnits = (prod.inventory ? prod.inventory.filter((i: any) => !i.claimedAt).length : prod.stockCount) ?? 0;
                return (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery:</span>
                      <span className="font-semibold text-emerald-400">{prod.deliveryType}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Available in DB:</span>
                      <span
                        className={`font-black text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          activeUnits > 0
                            ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                            : "text-rose-400 bg-rose-500/10 border-rose-500/30"
                        }`}
                      >
                        <span>📦</span>
                        <span>{activeUnits} units</span>
                      </span>
                    </div>
                    {prod.customFields && prod.customFields.length > 0 && (
                      <div className="pt-1 border-t border-white/5 flex flex-wrap gap-1">
                        {prod.customFields.map((f: any, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons for this product */}
              {(() => {
                const activeUnits = (prod.inventory ? prod.inventory.filter((i: any) => !i.claimedAt).length : prod.stockCount) ?? 0;
                return (
                  <div className="pt-2 flex items-center gap-2">
                    {viewMode === "active" ? (
                      <>
                        <button
                          onClick={() => openEditModal(prod)}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-500/40"
                          title="Edit product details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => openStockModal(prod)}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-cyan-500/40"
                          title="View and manage available accounts & credentials in database"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Stock ({activeUnits})</span>
                        </button>

                        <button
                          onClick={() => handleRemoveProduct(prod.id, prod.name)}
                          className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/30"
                          title="Remove product from store"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRestoreProduct(prod.id, prod.name)}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Product to Store</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Add New Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setIsAddModalOpen(false)} className="fixed inset-0 bg-black/85 backdrop-blur-md" />

          <div className="relative w-full max-w-2xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 shadow-2xl border border-cyan-500/30 z-10 max-h-[90vh] overflow-y-auto space-y-6 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Create New Store Product</h3>
                  <p className="text-xs text-slate-400">Configure product details and custom ID/Password fields.</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix 4K Key (Private Profile) or Steam CS2 Prime ID"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-bold"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Streaming">Streaming</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Discord">Discord</option>
                    <option value="Software & Keys">Software &amp; Keys</option>
                    <option value="Subscriptions">Subscriptions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Badge</label>
                  <select
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Instant Key">Instant Key</option>
                    <option value="Best Seller">Best Seller</option>
                    <option value="Trending">Trending</option>
                    <option value="Hot Deal">Hot Deal</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              {/* Price & Original Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sale Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 199"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Original Price (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 649 (for discount display)"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-bold"
                  />
                </div>
              </div>

              {/* Delivery Type */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Delivery Method</label>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-sm text-white focus:outline-none cursor-pointer"
                >
                  <option value="Instant Account ID + Pass">Instant Account ID + Pass (Steam / Netflix)</option>
                  <option value="Instant Activation Key">Instant Activation Key / Code (Steam Code / Windows)</option>
                  <option value="Instant Automated Delivery">Instant Automated Delivery (Discord Nitro / Invite)</option>
                </select>
              </div>

              {/* Product Visuals: Custom Logo & Background */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-cyan-500/25 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                      Product Visuals: Custom Logo & Background
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Custom styling &amp; live preview</span>
                </div>

                {/* 1. Custom Logo & Brand Icon */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Custom Product Logo / Brand Icon</span>
                    </label>
                    {customLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setCustomLogoUrl("")}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
                      >
                        Reset to default icon
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Image URL (https://...) or upload image file below"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileToBase64(file, (dataUrl) => setCustomLogoUrl(dataUrl));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Built-in Brand Icons */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Or select from built-in brand icons:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-black/30 rounded-xl border border-white/5">
                      {BUILTIN_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => {
                            setIconType(icon);
                            setCustomLogoUrl("");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                            iconType === icon && !customLogoUrl
                              ? "bg-cyan-500 text-black font-black shadow-md shadow-cyan-500/30"
                              : "bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Size Selection */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Logo / Icon Size:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {LOGO_SIZES.map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setLogoSize(sz.id)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            logoSize === sz.id
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <div className="text-xs font-bold">{sz.label}</div>
                          <div className="text-[10px] text-slate-400">{sz.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Custom Background & Styling */}
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Card Background: Custom Image or Gradient Theme</span>
                    </label>
                    {customBgUrl && (
                      <button
                        type="button"
                        onClick={() => setCustomBgUrl("")}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
                      >
                        Reset to theme gradient
                      </button>
                    )}
                  </div>

                  {/* Gradient presets */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Curated Gradient Themes:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {GRADIENT_PRESETS.map((gp) => (
                        <button
                          key={gp.name}
                          type="button"
                          onClick={() => {
                            setBannerGradient(gp.value);
                            setCustomBgUrl("");
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            bannerGradient === gp.value && !customBgUrl
                              ? `bg-white/15 ${gp.border} text-white shadow-md`
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${gp.value} border border-white/30 shrink-0`}
                          />
                          <span className="truncate">{gp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Background Image URL / Upload */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Custom Background Image URL (https://...) or upload below"
                      value={customBgUrl}
                      onChange={(e) => setCustomBgUrl(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload BG</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileToBase64(file, (dataUrl) => setCustomBgUrl(dataUrl));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Background Size Selection */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Background Image Size (Scaling Mode):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {BG_SIZES.map((bs) => (
                        <button
                          key={bs.id}
                          type="button"
                          onClick={() => setBgSize(bs.id)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            bgSize === bs.id
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <div className="text-xs font-bold">{bs.label}</div>
                          <div className="text-[10px] text-slate-400">{bs.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Live Real-Time Card Preview */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-[11px] font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Live Storefront Card Preview</span>
                  </label>
                  <div className="w-full max-w-xs mx-auto rounded-3xl bg-[#0a1120] border border-cyan-500/30 overflow-hidden shadow-xl">
                    <div
                      className={`relative h-36 w-full p-4 flex flex-col justify-between overflow-hidden ${
                        !customBgUrl ? `bg-gradient-to-br ${bannerGradient}` : "bg-slate-900"
                      }`}
                      style={
                        customBgUrl
                          ? {
                              backgroundImage: `url(${customBgUrl})`,
                              backgroundSize: bgSize || "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }
                          : undefined
                      }
                    >
                      {customBgUrl && (
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1120] via-black/40 to-black/30 pointer-events-none" />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#050811]/70 text-cyan-300 backdrop-blur-md border border-cyan-500/30">
                          {category}
                        </span>
                        {badge && badge !== "None" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-400 text-black shadow-cyan-400/40">
                            {badge}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 flex items-end justify-between mt-auto">
                        <ProductIcon
                          type={iconType}
                          customLogoUrl={customLogoUrl}
                          logoSize={logoSize}
                          className="w-12 h-12"
                          size={24}
                        />
                        <div className="px-2 py-0.5 rounded-lg bg-[#050811]/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                          ⚡ Instant
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#0a1120] border-t border-white/5 space-y-1">
                      <div className="text-xs font-black text-white truncate">
                        {name.trim() || "Product Title Example"}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-black text-white">
                          ₹{price || "199"}
                        </span>
                        {originalPrice && (
                          <span className="text-[10px] text-slate-500 line-through">
                            ₹{originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Options / Credentials Selection */}
              <div className="p-4 rounded-2xl bg-black/40 border border-cyan-500/25 space-y-3">
                <label className="block text-xs font-black text-cyan-300 uppercase tracking-wider">
                  Select Custom Options / Credential Fields to Deliver
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includeId}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includeId: e.target.checked })}
                      className="rounded text-cyan-400"
                    />
                    <span>Account ID / Login</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includePassword}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includePassword: e.target.checked })}
                      className="rounded text-cyan-400"
                    />
                    <span>Password</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includeKey}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includeKey: e.target.checked })}
                      className="rounded text-cyan-400"
                    />
                    <span>License Key</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includePin}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includePin: e.target.checked })}
                      className="rounded text-cyan-400"
                    />
                    <span>PIN / 2FA</span>
                  </label>
                </div>

                {/* Custom extra field name */}
                <div>
                  <input
                    type="text"
                    placeholder="Optional Custom Field Name (e.g. Profile PIN, Web Login, Server)"
                    value={fieldOptions.customName}
                    onChange={(e) => setFieldOptions({ ...fieldOptions, customName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Add Initial Stock Credentials */}
              <div className="p-4 rounded-2xl bg-black/40 border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-cyan-300 uppercase tracking-wider">
                    Add Initial Stock Credentials ({inventoryList.length} items ready)
                  </label>
                  <button
                    type="button"
                    onClick={() => setBulkMode(!bulkMode)}
                    className="text-xs text-cyan-400 underline font-bold"
                  >
                    {bulkMode ? "Switch to Form Mode" : "Bulk Paste Mode (ID:PASS)"}
                  </button>
                </div>

                {bulkMode ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      placeholder="Paste credentials line by line:&#10;username1:pass1&#10;username2:pass2"
                      value={bulkStockText}
                      onChange={(e) => setBulkStockText(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white font-mono placeholder:text-slate-500 resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleParseBulk}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold"
                    >
                      Parse and Add Lines
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {fieldOptions.includeId && (
                        <input
                          type="text"
                          placeholder="Account ID / Username"
                          value={stockInputId}
                          onChange={(e) => setStockInputId(e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white"
                        />
                      )}
                      {fieldOptions.includePassword && (
                        <input
                          type="text"
                          placeholder="Password"
                          value={stockInputPass}
                          onChange={(e) => setStockInputPass(e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white"
                        />
                      )}
                      {fieldOptions.includeKey && (
                        <input
                          type="text"
                          placeholder="License Key / Token"
                          value={stockInputKey}
                          onChange={(e) => setStockInputKey(e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white"
                        />
                      )}
                      {fieldOptions.includePin && (
                        <input
                          type="text"
                          placeholder="PIN / 2FA"
                          value={stockInputPin}
                          onChange={(e) => setStockInputPin(e.target.value)}
                          className="px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStockItem}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15"
                    >
                      + Add Item to Stock Batch
                    </button>
                  </div>
                )}

                {/* Display added items in batch */}
                {inventoryList.length > 0 && (
                  <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-black/60 rounded-xl border border-white/10 text-[11px] font-mono">
                    {inventoryList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-300">
                        <span className="truncate">
                          {item.id || item.token} {item.password ? `| ${item.password}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInventoryList(inventoryList.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description & Features */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. Ultra HD 4K streaming key with private PIN profile."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-cyan-500/30 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Publishing Product to Store..." : "Publish Product to Trinitymart Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Stock & Credentials Inventory Manager Modal */}
      {isStockModalOpen && targetProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-5">
          <div onClick={() => setIsStockModalOpen(false)} className="fixed inset-0 bg-black/85 backdrop-blur-md" />

          <div className="relative w-full max-w-3xl bg-[#090f1d] rounded-3xl p-5 sm:p-7 shadow-2xl border border-cyan-500/30 z-10 max-h-[92vh] overflow-y-auto space-y-5 text-white">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-cyan-500/20 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white truncate">
                      {targetProduct.name}
                    </h3>
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        ((targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : targetProduct.stockCount) ?? 0) > 0
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      📦 {((targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : targetProduct.stockCount) ?? 0)} Available in DB
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live database stock linked directly to account credentials (ID, Password, Token).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs inside Stock Modal */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-900/90 border border-cyan-500/20">
              <button
                type="button"
                onClick={() => setStockModalTab("view")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  stockModalTab === "view"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>📋 Available Credentials</span>
                <span className="bg-black/40 px-2 py-0.5 rounded-full text-[10px]">
                  {(targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : 0)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStockModalTab("add")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  stockModalTab === "add"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>➕ Add Stock (Single &amp; Bulk)</span>
              </button>
            </div>

            {/* TAB 1: VIEW AVAILABLE CREDENTIALS IN DATABASE */}
            {stockModalTab === "view" && (
              <div className="space-y-4">
                {/* Search & Actions Bar */}
                {targetProduct.inventory && targetProduct.inventory.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by ID, username, token, or PIN…"
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-black/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleShowAllPasswords}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {showAllStockPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showAllStockPasswords ? "Hide All Passwords" : "Show All Passwords"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAllCredentials}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedStockId === "all-credentials" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedStockId === "all-credentials" ? "Copied All!" : "Copy All (ID:PASS)"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!targetProduct.inventory || targetProduct.inventory.length === 0) && (
                  <div className="text-center py-10 px-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xl">
                      📦
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white">
                        No Credentials Stored in Database Yet
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Add account IDs, passwords, or license keys using the &ldquo;Add Stock&rdquo; tab so this product has available units in the database and shows as In Stock to buyers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStockModalTab("add")}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-xs shadow-lg shadow-cyan-500/25 cursor-pointer hover:scale-105 transition-all"
                    >
                      ➕ Add First Account ID &amp; Password
                    </button>
                  </div>
                )}

                {/* Credentials List */}
                {targetProduct.inventory && targetProduct.inventory.length > 0 && (
                  <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                    {targetProduct.inventory
                      .filter((item: any) => {
                        if (!stockSearchQuery.trim()) return true;
                        const q = stockSearchQuery.toLowerCase().trim();
                        const fieldsStr = Object.values(item.fields || {}).join(" ").toLowerCase();
                        return fieldsStr.includes(q) || item.id.toLowerCase().includes(q);
                      })
                      .map((item: any, idx: number) => {
                        const isClaimed = Boolean(item.claimedAt);
                        const isPwdRevealed = revealedStockPasswords.has(item.id) || showAllStockPasswords;
                        const accountId = item.fields?.id || item.fields?.email || item.fields?.username || "";
                        const password = item.fields?.password || item.fields?.emailPassword || "";
                        const token = item.fields?.token || item.fields?.key || "";
                        const pin = item.fields?.pin || item.fields?.twoFactorKey || "";

                        return (
                          <div
                            key={item.id || idx}
                            className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                              isClaimed
                                ? "bg-white/[0.02] border-white/5 opacity-60"
                                : "bg-black/50 border-cyan-500/20 hover:border-cyan-500/40"
                            }`}
                          >
                            {/* Card Top: Index, Status, Added At, Delete Button */}
                            <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20 text-[10px]">
                                  #{idx + 1}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isClaimed
                                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                                  }`}
                                >
                                  {isClaimed ? "Delivered / Claimed" : "Available in DB"}
                                </span>
                                {item.addedAt && (
                                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                                    Added: {new Date(item.addedAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                                    {new Date(item.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={deletingStockItemId === item.id}
                                onClick={() => handleDeleteStockItem(item.id)}
                                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                title="Delete this credential from database"
                              >
                                {deletingStockItemId === item.id ? (
                                  <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </div>

                            {/* Credentials Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                              {/* Account ID / Username */}
                              {accountId && (
                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                                        Account ID / Login
                                      </span>
                                      <span className="text-white font-bold truncate block select-all">
                                        {accountId}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStockValue(accountId, `id-${item.id}`)}
                                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Copy Account ID"
                                  >
                                    {copiedStockId === `id-${item.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Password */}
                              {password && (
                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                                        Password
                                      </span>
                                      <span className="text-white font-bold truncate block select-all">
                                        {isPwdRevealed ? password : "••••••••••••"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleRevealStockPassword(item.id)}
                                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                      title={isPwdRevealed ? "Hide Password" : "Show Password"}
                                    >
                                      {isPwdRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyStockValue(password, `pwd-${item.id}`)}
                                      className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                      title="Copy Password"
                                    >
                                      {copiedStockId === `pwd-${item.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* License Key / Token */}
                              {token && (
                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                                        License Key / Code
                                      </span>
                                      <span className="text-indigo-300 font-bold truncate block select-all">
                                        {token}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStockValue(token, `tok-${item.id}`)}
                                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Copy Key"
                                  >
                                    {copiedStockId === `tok-${item.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* 2FA / PIN */}
                              {pin && (
                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                                        PIN / 2FA Secret
                                      </span>
                                      <span className="text-amber-300 font-bold truncate block select-all">
                                        {pin}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStockValue(pin, `pin-${item.id}`)}
                                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Copy PIN"
                                  >
                                    {copiedStockId === `pin-${item.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Other custom fields if present */}
                              {item.fields &&
                                Object.entries(item.fields).map(([k, v]) => {
                                  if (["id", "email", "username", "password", "emailPassword", "token", "key", "pin", "twoFactorKey"].includes(k)) {
                                    return null;
                                  }
                                  return (
                                    <div key={k} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                                          {k}
                                        </span>
                                        <span className="text-white font-bold truncate block select-all">
                                          {String(v)}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyStockValue(String(v), `custom-${item.id}-${k}`)}
                                        className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                                      >
                                        {copiedStockId === `custom-${item.id}-${k}` ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADD STOCK TO DATABASE (SINGLE OR BULK) */}
            {stockModalTab === "add" && (
              <form onSubmit={handleSaveStockToDatabase} className="space-y-4">
                {/* Switcher: Single vs Bulk Paste */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10">
                  <div>
                    <span className="text-xs font-bold text-white block">Input Mode</span>
                    <span className="text-[10px] text-slate-400">
                      {stockBulkMode ? "Paste multiple accounts (one per line)" : "Add a single account credential"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStockBulkMode(!stockBulkMode)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
                  >
                    {stockBulkMode ? "Switch to Form Mode" : "⚡ Switch to Bulk Paste Mode"}
                  </button>
                </div>

                {stockBulkMode ? (
                  /* Bulk Paste Mode */
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      Paste Account Credentials (one per line)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Accepted format: <code className="text-cyan-300">username:password</code> or{" "}
                      <code className="text-cyan-300">username:password:licenseKey</code> or{" "}
                      <code className="text-cyan-300">licenseKeyCode</code>
                    </p>
                    <textarea
                      rows={6}
                      placeholder={`steam_user_01:Pass1234\nsteam_user_02:Pass5678\nnetflix_user1@gmail.com:Pass9999`}
                      value={stockBulkText}
                      onChange={(e) => setStockBulkText(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl bg-black/60 border border-cyan-500/30 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
                    />
                    <div className="text-[11px] text-slate-400">
                      Lines detected:{" "}
                      <span className="font-bold text-cyan-400">
                        {stockBulkText.split("\n").map((l) => l.trim()).filter(Boolean).length}
                      </span>{" "}
                      accounts ready to add.
                    </div>
                  </div>
                ) : (
                  /* Single Form Mode */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Account ID / Login / Username / Email
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. steam_pro_acc10 or buyer@netflix.com"
                        value={singleStockId}
                        onChange={(e) => setSingleStockId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        Account Password
                      </label>
                      <div className="relative">
                        <input
                          type={showSinglePass ? "text" : "password"}
                          placeholder="Account password"
                          value={singleStockPass}
                          onChange={(e) => setSingleStockPass(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-black/50 border border-cyan-500/30 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSinglePass(!showSinglePass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showSinglePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          License Key / Redeem Code (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. STEAM-XXXX-YYYY or Activation Token"
                          value={singleStockKey}
                          onChange={(e) => setSingleStockKey(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-xs text-white placeholder:text-slate-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          2FA / Backup PIN / Profile PIN (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1234 or 2FA backup codes"
                          value={singleStockPin}
                          onChange={(e) => setSingleStockPin(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-cyan-500/30 text-xs text-white placeholder:text-slate-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={addingStock}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-cyan-500/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addingStock ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving to Database…</span>
                      </>
                    ) : (
                      <>
                        <span>💾 Save Stock Credentials to Database</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div onClick={() => setIsEditModalOpen(false)} className="fixed inset-0 bg-black/85 backdrop-blur-md" />
          <div className="relative w-full max-w-2xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/30 z-10 max-h-[90vh] overflow-y-auto space-y-6 text-white">
            <div className="flex items-center justify-between pb-4 border-b border-indigo-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Edit Product Details</h3>
                  <p className="text-xs text-slate-400">Update title, pricing, database stock units, and description.</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Product Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white font-bold focus:outline-none focus:border-indigo-400"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Streaming">Streaming</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Discord">Discord</option>
                    <option value="Software & Keys">Software &amp; Keys</option>
                    <option value="Subscriptions">Subscriptions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Badge</label>
                  <select
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="None">None</option>
                    <option value="Instant Key">Instant Key</option>
                    <option value="Best Seller">Best Seller</option>
                    <option value="Trending">Trending</option>
                    <option value="Hot Deal">Hot Deal</option>
                    <option value="Limited Stock">Limited Stock</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Database Stock Units */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sale Price (₹ INR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white font-bold focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Original Price (₹ INR)</label>
                  <input
                    type="number"
                    value={editOriginalPrice}
                    onChange={(e) => setEditOriginalPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white font-bold focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Database Stock Units</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editStockCount}
                    onChange={(e) => setEditStockCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white font-bold focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Delivery Type & Stock Status Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Delivery Method</label>
                  <select
                    value={editDeliveryType}
                    onChange={(e) => setEditDeliveryType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-sm text-white focus:outline-none cursor-pointer"
                  >
                    <option value="Instant Account ID + Pass">Instant Account ID + Pass (Steam / Netflix)</option>
                    <option value="Instant Activation Key">Instant Activation Key / Code</option>
                    <option value="Instant Automated Delivery">Instant Automated Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Stock Availability</label>
                  <button
                    type="button"
                    onClick={() => setEditInStock(!editInStock)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                      editInStock
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${editInStock ? "bg-emerald-400" : "bg-rose-400"}`} />
                    <span>{editInStock ? "In Stock (Available)" : "Marked Out of Stock"}</span>
                  </button>
                </div>
              </div>

              {/* Warranty */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Warranty Guarantee</label>
                <input
                  type="text"
                  value={editWarranty}
                  onChange={(e) => setEditWarranty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-xs text-white"
                />
              </div>

              {/* Product Visuals: Custom Logo & Background */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-indigo-500/25 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                      Product Visuals: Custom Logo & Background
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Custom styling &amp; live preview</span>
                </div>

                {/* 1. Custom Logo & Brand Icon */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Custom Product Logo / Brand Icon</span>
                    </label>
                    {editCustomLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCustomLogoUrl("")}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
                      >
                        Reset to default icon
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Image URL (https://...) or upload image file below"
                      value={editCustomLogoUrl}
                      onChange={(e) => setEditCustomLogoUrl(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileToBase64(file, (dataUrl) => setEditCustomLogoUrl(dataUrl));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Built-in Brand Icons */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Or select from built-in brand icons:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-black/30 rounded-xl border border-white/5">
                      {BUILTIN_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => {
                            setEditIconType(icon);
                            setEditCustomLogoUrl("");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                            editIconType === icon && !editCustomLogoUrl
                              ? "bg-indigo-500 text-white font-black shadow-md shadow-indigo-500/30"
                              : "bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Size Selection */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Logo / Icon Size:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {LOGO_SIZES.map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setEditLogoSize(sz.id)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            editLogoSize === sz.id
                              ? "bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-md shadow-indigo-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <div className="text-xs font-bold">{sz.label}</div>
                          <div className="text-[10px] text-slate-400">{sz.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Custom Background & Styling */}
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Card Background: Custom Image or Gradient Theme</span>
                    </label>
                    {editCustomBgUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCustomBgUrl("")}
                        className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer"
                      >
                        Reset to theme gradient
                      </button>
                    )}
                  </div>

                  {/* Gradient presets */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Curated Gradient Themes:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {GRADIENT_PRESETS.map((gp) => (
                        <button
                          key={gp.name}
                          type="button"
                          onClick={() => {
                            setEditBannerGradient(gp.value);
                            setEditCustomBgUrl("");
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                            editBannerGradient === gp.value && !editCustomBgUrl
                              ? `bg-white/15 ${gp.border} text-white shadow-md`
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${gp.value} border border-white/30 shrink-0`}
                          />
                          <span className="truncate">{gp.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Background Image URL / Upload */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Custom Background Image URL (https://...) or upload below"
                      value={editCustomBgUrl}
                      onChange={(e) => setEditCustomBgUrl(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload BG</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileToBase64(file, (dataUrl) => setEditCustomBgUrl(dataUrl));
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  {/* Background Size Selection */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1.5">
                      Background Image Size (Scaling Mode):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {BG_SIZES.map((bs) => (
                        <button
                          key={bs.id}
                          type="button"
                          onClick={() => setEditBgSize(bs.id)}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                            editBgSize === bs.id
                              ? "bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-md shadow-indigo-500/20"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <div className="text-xs font-bold">{bs.label}</div>
                          <div className="text-[10px] text-slate-400">{bs.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Live Real-Time Card Preview */}
                <div className="pt-2 border-t border-white/10">
                  <label className="block text-[11px] font-bold text-indigo-300 mb-2 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Live Storefront Card Preview</span>
                  </label>
                  <div className="w-full max-w-xs mx-auto rounded-3xl bg-[#0a1120] border border-indigo-500/30 overflow-hidden shadow-xl">
                    <div
                      className={`relative h-36 w-full p-4 flex flex-col justify-between overflow-hidden ${
                        !editCustomBgUrl ? `bg-gradient-to-br ${editBannerGradient}` : "bg-slate-900"
                      }`}
                      style={
                        editCustomBgUrl
                          ? {
                              backgroundImage: `url(${editCustomBgUrl})`,
                              backgroundSize: editBgSize || "cover",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }
                          : undefined
                      }
                    >
                      {editCustomBgUrl && (
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1120] via-black/40 to-black/30 pointer-events-none" />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#050811]/70 text-indigo-300 backdrop-blur-md border border-indigo-500/30">
                          {editCategory}
                        </span>
                        {editBadge && editBadge !== "None" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-400 text-black shadow-indigo-400/40">
                            {editBadge}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 flex items-end justify-between mt-auto">
                        <ProductIcon
                          type={editIconType}
                          customLogoUrl={editCustomLogoUrl}
                          logoSize={editLogoSize}
                          className="w-12 h-12"
                          size={24}
                        />
                        <div className="px-2 py-0.5 rounded-lg bg-[#050811]/80 backdrop-blur-md border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                          ⚡ Instant
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#0a1120] border-t border-white/5 space-y-1">
                      <div className="text-xs font-black text-white truncate">
                        {editName.trim() || "Product Title Example"}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-black text-white">
                          ₹{editPrice || "199"}
                        </span>
                        {editOriginalPrice && (
                          <span className="text-[10px] text-slate-500 line-through">
                            ₹{editOriginalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Short Description</label>
                <input
                  type="text"
                  value={editShortDescription}
                  onChange={(e) => setEditShortDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-xs text-white"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Detailed Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-indigo-500/30 text-xs text-white resize-none"
                />
              </div>

              {/* Features List Editor */}
              <div className="p-4 rounded-2xl bg-black/40 border border-indigo-500/25 space-y-2">
                <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider">
                  Product Features / Highlights ({editFeatures.length})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Ultra HD 4K, 1-Month Warranty, Instant Credentials"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newFeatureText.trim()) {
                          setEditFeatures([...editFeatures, newFeatureText.trim()]);
                          setNewFeatureText("");
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-black/60 border border-white/15 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFeatureText.trim()) {
                        setEditFeatures([...editFeatures, newFeatureText.trim()]);
                        setNewFeatureText("");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                  {editFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs text-slate-300">
                      <span className="truncate">{feat}</span>
                      <button
                        type="button"
                        onClick={() => setEditFeatures(editFeatures.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:text-rose-300 ml-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-black text-sm shadow-xl shadow-indigo-500/30 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving Changes to Database..." : "Save Product Changes to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
