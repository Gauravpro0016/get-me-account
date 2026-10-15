"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { Product, CustomFieldDefinition, ACTIVE_PRODUCTS_CACHE_KEY, REMOVED_IDS_CACHE_KEY } from "@/lib/products";
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

export function parseBulkCredentialLine(line: string): Record<string, string> {
  const trimmed = line.trim();
  if (!trimmed) return {};

  let parts: string[] = [];
  if (trimmed.includes("----")) {
    parts = trimmed.split("----");
  } else if (trimmed.includes(" | ")) {
    parts = trimmed.split(" | ");
  } else if (trimmed.includes("|")) {
    parts = trimmed.split("|");
  } else if (trimmed.includes("\t")) {
    parts = trimmed.split("\t");
  } else if (trimmed.includes(" : ")) {
    parts = trimmed.split(" : ");
  } else if (trimmed.includes(";")) {
    parts = trimmed.split(";");
  } else if (trimmed.includes(":")) {
    parts = trimmed.split(":");
  } else if (trimmed.includes(",")) {
    parts = trimmed.split(",");
  } else {
    parts = [trimmed];
  }

  const cleaned = parts.map((p) => p.trim()).filter((p) => p.length > 0);
  if (cleaned.length >= 2) {
    const item: Record<string, string> = {
      id: cleaned[0],
      email: cleaned[0].includes("@") ? cleaned[0] : "",
      password: cleaned[1],
    };
    if (cleaned[2]) {
      item.token = cleaned[2];
      item.key = cleaned[2];
    }
    if (cleaned[3]) {
      item.pin = cleaned[3];
      item.twoFactorKey = cleaned[3];
    }
    if (cleaned[4]) {
      item.twoFactorKey = cleaned[4];
      item.pin = cleaned[4];
    }
    if (cleaned[5]) {
      item.notes = cleaned.slice(5).join(" | ");
    }
    return item;
  } else if (cleaned.length === 1) {
    const single = cleaned[0];
    if (single.includes("@")) {
      return { id: single, email: single };
    }
    return { token: single, id: single };
  }
  return {};
}

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
  const [stockBulkDedup, setStockBulkDedup] = useState(true);
  const [stockBulkError, setStockBulkError] = useState("");
  const [stockBulkPreviewExpanded, setStockBulkPreviewExpanded] = useState(true);
  const [showBulkPasswords, setShowBulkPasswords] = useState(false);

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
  // Edit Modal Custom Options State
  const [editIncludeId, setEditIncludeId] = useState(true);
  const [editIncludePassword, setEditIncludePassword] = useState(true);
  const [editIncludeKey, setEditIncludeKey] = useState(false);
  const [editIncludePin, setEditIncludePin] = useState(false);
  const [editCustomOptionsList, setEditCustomOptionsList] = useState<string[]>([]);
  const [editNewCustomOptionInput, setEditNewCustomOptionInput] = useState("");

  // Stock Inventory Manager Custom Options State
  const [stockModalCustomFields, setStockModalCustomFields] = useState<string[]>([]);
  const [singleStockCustomValues, setSingleStockCustomValues] = useState<Record<string, string>>({});
  const [newStockModalCustomOption, setNewStockModalCustomOption] = useState("");

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
  const [newAddFeatureText, setNewAddFeatureText] = useState("");
  const [bannerGradient, setBannerGradient] = useState("from-blue-600/25 via-cyan-950/40 to-zinc-900");
  const [iconType, setIconType] = useState("key");
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const [logoSize, setLogoSize] = useState<string>("medium");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [bgSize, setBgSize] = useState<string>("cover");

  // Custom Options / Fields toggles for Add Product
  const [fieldOptions, setFieldOptions] = useState({
    includeId: true,
    includePassword: true,
    includeKey: false,
    includePin: false,
  });
  const [customOptionNames, setCustomOptionNames] = useState<string[]>([]);
  const [newCustomOptionInput, setNewCustomOptionInput] = useState("");
  const [customStockInputs, setCustomStockInputs] = useState<Record<string, string>>({});

  // Stock inventory items to add
  const [inventoryList, setInventoryList] = useState<Record<string, string>[]>([]);
  const [stockInputId, setStockInputId] = useState("");
  const [stockInputPass, setStockInputPass] = useState("");
  const [stockInputKey, setStockInputKey] = useState("");
  const [stockInputPin, setStockInputPin] = useState("");
  const [bulkStockText, setBulkStockText] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [createBulkDedup, setCreateBulkDedup] = useState(true);
  const [createBulkError, setCreateBulkError] = useState("");
  const [createBulkPreviewExpanded, setCreateBulkPreviewExpanded] = useState(true);
  const [showCreateBulkPasswords, setShowCreateBulkPasswords] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add / Remove custom option in Add Product form
  const handleAddCustomOption = () => {
    const trimmed = newCustomOptionInput.trim();
    if (!trimmed) return;
    if (customOptionNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      alert("This custom option already exists!");
      return;
    }
    setCustomOptionNames((prev) => [...prev, trimmed]);
    setNewCustomOptionInput("");
  };

  const handleRemoveCustomOption = (nameToRemove: string) => {
    setCustomOptionNames((prev) => prev.filter((n) => n !== nameToRemove));
    setCustomStockInputs((prev) => {
      const next = { ...prev };
      delete next[nameToRemove];
      return next;
    });
  };

  // Add / Remove custom option in Edit Product modal
  const handleAddEditCustomOption = () => {
    const trimmed = editNewCustomOptionInput.trim();
    if (!trimmed) return;
    if (editCustomOptionsList.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      alert("This custom option already exists!");
      return;
    }
    setEditCustomOptionsList((prev) => [...prev, trimmed]);
    setEditNewCustomOptionInput("");
  };

  const handleRemoveEditCustomOption = (nameToRemove: string) => {
    setEditCustomOptionsList((prev) => prev.filter((n) => n !== nameToRemove));
  };

  // Fetch products from server
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", {
        headers: {
          Authorization: `Bearer ${adminPassword}`,
          "x-admin-password": adminPassword,
        },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.allProducts) {
        setActiveProducts(data.allProducts);
        try {
          localStorage.setItem(ACTIVE_PRODUCTS_CACHE_KEY, JSON.stringify(data.allProducts));
          if (data.removedIds && Array.isArray(data.removedIds)) {
            localStorage.setItem(REMOVED_IDS_CACHE_KEY, JSON.stringify(data.removedIds));
          }
        } catch {}
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

  // Quick format sample injector
  const handleInsertSample = (type: "userpass" | "userpass2fa" | "keys" | "tab", target: "stock" | "create") => {
    let sample = "";
    if (type === "userpass") {
      sample = [
        "john_gamer_01:P@ssw0rd99",
        "sarah_pro_user:Secur3Pass#12",
        "alex_elite_acc:ThunderPass991",
        "crypto_vault_user:CryptoVault!4",
      ].join("\n");
    } else if (type === "userpass2fa") {
      sample = [
        "netflix_fan1@gmail.com:Pass#7890:4921",
        "netflix_fan2@gmail.com:Pass#1234:8812",
        "spotify_user3@outlook.com:StreamMusic2026:3349",
      ].join("\n");
    } else if (type === "keys") {
      sample = [
        "STEAM-XXXXX-YYYYY-ZZZZ1",
        "STEAM-XXXXX-YYYYY-ZZZZ2",
        "STEAM-XXXXX-YYYYY-ZZZZ3",
      ].join("\n");
    } else if (type === "tab") {
      sample = [
        "valorant_pro1\tViperPass#2026\tVALO-KEY-881",
        "valorant_pro2\tJettSpeed#992\tVALO-KEY-882",
      ].join("\n");
    }

    if (target === "stock") {
      setStockBulkText(sample);
      setStockBulkError("");
    } else {
      setBulkStockText(sample);
      setCreateBulkError("");
    }
  };

  // Real-time parsed items & preview for Stock Manager Bulk Paste
  const stockBulkParsed = useMemo(() => {
    if (!stockBulkText.trim()) {
      return { totalLines: 0, items: [], validCount: 0, duplicateCount: 0, emptyCount: 0, invalidCount: 0, preview: [] };
    }
    const lines = stockBulkText.split("\n");
    const seenBatchKeys = new Set<string>();

    const existingDbKeys = new Set<string>();
    if (targetProduct && Array.isArray(targetProduct.inventory)) {
      for (const item of targetProduct.inventory) {
        if (item.id) existingDbKeys.add(item.id.toLowerCase());
        const f = item.fields || {};
        if (f.id) existingDbKeys.add(String(f.id).toLowerCase());
        if (f.email) existingDbKeys.add(String(f.email).toLowerCase());
        if (f.token) existingDbKeys.add(String(f.token).toLowerCase());
        if (f.key) existingDbKeys.add(String(f.key).toLowerCase());
      }
    }

    const items: Record<string, string>[] = [];
    const preview: {
      lineNum: number;
      raw: string;
      item: Record<string, string>;
      isDuplicateInBatch: boolean;
      existsInDb: boolean;
      isValid: boolean;
    }[] = [];

    let duplicateCount = 0;
    let emptyCount = 0;
    let invalidCount = 0;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const trimmed = rawLine.trim();
      if (!trimmed) {
        emptyCount++;
        return;
      }
      const item = parseBulkCredentialLine(trimmed);
      const isValid = Object.keys(item).length > 0;
      if (!isValid) {
        invalidCount++;
        preview.push({
          lineNum,
          raw: trimmed,
          item: {},
          isDuplicateInBatch: false,
          existsInDb: false,
          isValid: false,
        });
        return;
      }

      const uniqueKey = (item.id || item.email || item.token || item.key || JSON.stringify(item)).toLowerCase();
      const isDuplicateInBatch = seenBatchKeys.has(uniqueKey);
      const existsInDb = existingDbKeys.has(uniqueKey);

      if (isDuplicateInBatch || existsInDb) {
        duplicateCount++;
      } else {
        seenBatchKeys.add(uniqueKey);
      }

      const shouldInclude = !stockBulkDedup || (!isDuplicateInBatch && !existsInDb);
      if (shouldInclude) {
        items.push(item);
      }

      preview.push({
        lineNum,
        raw: trimmed,
        item,
        isDuplicateInBatch,
        existsInDb,
        isValid: true,
      });
    });

    return {
      totalLines: lines.length,
      items,
      validCount: items.length,
      duplicateCount,
      emptyCount,
      invalidCount,
      preview,
    };
  }, [stockBulkText, stockBulkDedup, targetProduct]);

  // Real-time parsed items & preview for Add Product Bulk Paste
  const createBulkParsed = useMemo(() => {
    if (!bulkStockText.trim()) {
      return { totalLines: 0, items: [], validCount: 0, duplicateCount: 0, emptyCount: 0, invalidCount: 0, preview: [] };
    }
    const lines = bulkStockText.split("\n");
    const seenBatchKeys = new Set<string>();

    const existingListKeys = new Set<string>();
    for (const inv of inventoryList) {
      if (inv.id) existingListKeys.add(inv.id.toLowerCase());
      if (inv.email) existingListKeys.add(inv.email.toLowerCase());
      if (inv.token) existingListKeys.add(inv.token.toLowerCase());
      if (inv.key) existingListKeys.add(inv.key.toLowerCase());
    }

    const items: Record<string, string>[] = [];
    const preview: {
      lineNum: number;
      raw: string;
      item: Record<string, string>;
      isDuplicateInBatch: boolean;
      existsInList: boolean;
      isValid: boolean;
    }[] = [];

    let duplicateCount = 0;
    let emptyCount = 0;
    let invalidCount = 0;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const trimmed = rawLine.trim();
      if (!trimmed) {
        emptyCount++;
        return;
      }
      const item = parseBulkCredentialLine(trimmed);
      const isValid = Object.keys(item).length > 0;
      if (!isValid) {
        invalidCount++;
        preview.push({
          lineNum,
          raw: trimmed,
          item: {},
          isDuplicateInBatch: false,
          existsInList: false,
          isValid: false,
        });
        return;
      }

      const uniqueKey = (item.id || item.email || item.token || item.key || JSON.stringify(item)).toLowerCase();
      const isDuplicateInBatch = seenBatchKeys.has(uniqueKey);
      const existsInList = existingListKeys.has(uniqueKey);

      if (isDuplicateInBatch || existsInList) {
        duplicateCount++;
      } else {
        seenBatchKeys.add(uniqueKey);
      }

      const shouldInclude = !createBulkDedup || (!isDuplicateInBatch && !existsInList);
      if (shouldInclude) {
        items.push(item);
      }

      preview.push({
        lineNum,
        raw: trimmed,
        item,
        isDuplicateInBatch,
        existsInList,
        isValid: true,
      });
    });

    return {
      totalLines: lines.length,
      items,
      validCount: items.length,
      duplicateCount,
      emptyCount,
      invalidCount,
      preview,
    };
  }, [bulkStockText, createBulkDedup, inventoryList]);

  // Handle adding a single stock credential to the pending list
  const handleAddStockItem = (e: React.FormEvent) => {
    e.preventDefault();
    const item: Record<string, string> = {};
    if (fieldOptions.includeId && stockInputId.trim()) item.id = stockInputId.trim();
    if (fieldOptions.includePassword && stockInputPass.trim()) item.password = stockInputPass.trim();
    if (fieldOptions.includeKey && stockInputKey.trim()) item.token = stockInputKey.trim();
    if (fieldOptions.includePin && stockInputPin.trim()) item.pin = stockInputPin.trim();

    // Include all custom option values
    for (const optName of customOptionNames) {
      const val = (customStockInputs[optName] || "").trim();
      if (val) {
        item[optName] = val;
      }
    }

    if (Object.keys(item).length === 0) {
      alert("Please provide at least one credential or custom option field!");
      return;
    }

    setInventoryList((prev) => [...prev, item]);
    setStockInputId("");
    setStockInputPass("");
    setStockInputKey("");
    setStockInputPin("");
    setCustomStockInputs({});
  };

  // Parse bulk text (e.g. user:pass:key, user|pass, user----pass, etc.)
  const handleParseBulk = () => {
    setCreateBulkError("");
    if (!bulkStockText.trim()) {
      setCreateBulkError("Please paste credential lines into the box before parsing.");
      return;
    }
    if (createBulkParsed.items.length === 0) {
      setCreateBulkError(
        createBulkParsed.duplicateCount > 0
          ? "All accounts were detected as duplicates. Uncheck 'Auto-Dedup' if you want to allow duplicates."
          : "No valid credentials found. Please verify your formatting."
      );
      return;
    }

    setInventoryList((prev) => [...prev, ...createBulkParsed.items]);
    setStatusMsg({
      type: "success",
      text: `✅ Added ${createBulkParsed.items.length} credential(s) to the initial inventory queue!`,
    });
    setBulkStockText("");
    setBulkMode(false);
    setCreateBulkError("");

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
    const customFields: CustomFieldDefinition[] = [];
    if (fieldOptions.includeId) customFields.push({ id: "id", name: "Account ID / Login", type: "text" });
    if (fieldOptions.includePassword) customFields.push({ id: "password", name: "Password", type: "password" });
    if (fieldOptions.includeKey) customFields.push({ id: "token", name: "License Key / Code", type: "key" });
    if (fieldOptions.includePin) customFields.push({ id: "pin", name: "2FA / PIN Code", type: "text" });
    for (const optName of customOptionNames) {
      const slugId = optName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      customFields.push({ id: slugId || optName, name: optName, type: "text" });
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
          "x-admin-password": adminPassword,
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
      setFieldOptions({
        includeId: true,
        includePassword: true,
        includeKey: false,
        includePin: false,
      });
      setCustomOptionNames([]);
      setNewCustomOptionInput("");
      setCustomStockInputs({});
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
        headers: {
          Authorization: `Bearer ${adminPassword}`,
          "x-admin-password": adminPassword,
        },
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: "success", text: `Removed "${prodName}" from active store.` });
        try {
          const removedRaw = localStorage.getItem(REMOVED_IDS_CACHE_KEY);
          const currentRemoved = removedRaw ? JSON.parse(removedRaw) : [];
          if (!currentRemoved.includes(id)) currentRemoved.push(id);
          localStorage.setItem(REMOVED_IDS_CACHE_KEY, JSON.stringify(currentRemoved));

          const activeRaw = localStorage.getItem(ACTIVE_PRODUCTS_CACHE_KEY);
          if (activeRaw) {
            const currentActive: Product[] = JSON.parse(activeRaw);
            localStorage.setItem(
              ACTIVE_PRODUCTS_CACHE_KEY,
              JSON.stringify(currentActive.filter((p) => p.id !== id))
            );
          }
        } catch {}
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
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ id, restore: true }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: "success", text: `Restored "${prodName}" back to active store!` });
        try {
          const removedRaw = localStorage.getItem(REMOVED_IDS_CACHE_KEY);
          if (removedRaw) {
            const currentRemoved = JSON.parse(removedRaw).filter((rid: string) => rid !== id);
            localStorage.setItem(REMOVED_IDS_CACHE_KEY, JSON.stringify(currentRemoved));
          }
          localStorage.removeItem(ACTIVE_PRODUCTS_CACHE_KEY);
        } catch {}
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

    const cFields = prod.customFields || [
      { id: "id", name: "Account ID / Login", type: "text" },
      { id: "password", name: "Password", type: "password" },
    ];
    setEditIncludeId(cFields.some((f) => f.id === "id"));
    setEditIncludePassword(cFields.some((f) => f.id === "password"));
    setEditIncludeKey(cFields.some((f) => f.id === "token" || f.id === "key"));
    setEditIncludePin(cFields.some((f) => f.id === "pin" || f.id === "2fa"));
    setEditCustomOptionsList(
      cFields
        .filter((f) => !["id", "password", "token", "key", "pin", "2fa"].includes(f.id))
        .map((f) => f.name || f.id)
    );
    setEditNewCustomOptionInput("");
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

    const updatedCustomFields: CustomFieldDefinition[] = [];
    if (editIncludeId) updatedCustomFields.push({ id: "id", name: "Account ID / Login", type: "text" });
    if (editIncludePassword) updatedCustomFields.push({ id: "password", name: "Password", type: "password" });
    if (editIncludeKey) updatedCustomFields.push({ id: "token", name: "License Key / Code", type: "key" });
    if (editIncludePin) updatedCustomFields.push({ id: "pin", name: "2FA / PIN Code", type: "text" });
    for (const opt of editCustomOptionsList) {
      const slugId = opt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      updatedCustomFields.push({ id: slugId || opt, name: opt, type: "text" });
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPassword}`,
          "x-admin-password": adminPassword,
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
          customFields: updatedCustomFields,
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
    setStockBulkDedup(true);
    setStockBulkError("");
    setStockBulkPreviewExpanded(true);
    setShowBulkPasswords(false);

    // Extract custom options defined on target product
    const existingCustom = (prod.customFields || [])
      .filter((f) => !["id", "password", "token", "pin"].includes(f.id))
      .map((f) => f.name || f.id);
    setStockModalCustomFields(existingCustom);
    setSingleStockCustomValues({});
    setNewStockModalCustomOption("");
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
          "x-admin-password": adminPassword,
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
    setStockBulkError("");

    let itemsToAdd: Record<string, string>[] = [];

    if (stockBulkMode) {
      if (!stockBulkText.trim()) {
        setStockBulkError("Please paste account credentials into the bulk text area.");
        return;
      }
      if (stockBulkParsed.items.length === 0) {
        setStockBulkError(
          stockBulkParsed.duplicateCount > 0
            ? "All entered accounts are duplicates or already exist in the database! Disable 'Auto-Dedup' if you want to force add them."
            : "No valid credentials found. Please check your formatting."
        );
        return;
      }
      itemsToAdd = stockBulkParsed.items;
    } else {
      const item: Record<string, string> = {};
      if (singleStockId.trim()) item.id = singleStockId.trim();
      if (singleStockPass.trim()) item.password = singleStockPass.trim();
      if (singleStockKey.trim()) item.token = singleStockKey.trim();
      if (singleStockPin.trim()) item.pin = singleStockPin.trim();

      // Collect all custom option field values
      for (const [key, val] of Object.entries(singleStockCustomValues)) {
        if (val && val.trim()) {
          item[key] = val.trim();
        }
      }

      if (Object.keys(item).length === 0) {
        setStockBulkError("Please provide at least one credential or custom option field!");
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
          "x-admin-password": adminPassword,
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
      setSingleStockCustomValues({});
      setStockBulkText("");
      setStockBulkMode(false);
      setStockBulkError("");

      // Automatically switch to "view" tab to see newly added credentials
      setStockModalTab("view");
    } catch (err: any) {
      setStockBulkError(err.message || "Failed to update stock");
      setStatusMsg({
        type: "error",
        text: err.message || "Failed to update stock",
      });
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
    <div className="space-y-6 text-[#dfe2ee]">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded bg-[#262a33] text-[#8083ff] border border-[#31353e]">
              <Package className="w-3.5 h-3.5" />
            </span>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#8083ff]">
              Trinitymart Product Operations
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#dfe2ee] tracking-tight">
            Inventory &amp; Stock Catalog
          </h2>
          <p className="font-mono text-xs text-[#908fa0] mt-1">
            Publish accounts, restock credentials, configure custom fields, or hide products.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs sm:text-sm shadow-lg shadow-[#8083ff]/20 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-mono font-bold ${
            statusMsg.type === "success"
              ? "bg-[#00a572]/15 border-[#00a572]/30 text-[#4edea3]"
              : "bg-[#93000a]/20 border-[#ffb4ab]/30 text-[#ffb4ab]"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="underline text-[#908fa0] hover:text-[#dfe2ee]">
            Dismiss
          </button>
        </div>
      )}

      {/* View Mode Tabs (Active vs Removed) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#181c24] border border-[#262a33]">
          <button
            onClick={() => setViewMode("active")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              viewMode === "active"
                ? "bg-[#8083ff] text-[#0d0096] shadow-md"
                : "text-[#c7c4d7] hover:text-[#dfe2ee]"
            }`}
          >
            <span>Active Products</span>
            <span className="bg-[#0f131c] px-2 py-0.5 rounded-full text-[10px] text-[#dfe2ee]">
              {activeProducts.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode("removed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              viewMode === "removed"
                ? "bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/30 shadow-md"
                : "text-[#c7c4d7] hover:text-[#dfe2ee]"
            }`}
          >
            <span>Removed / Unlisted</span>
            <span className="bg-[#0f131c] px-2 py-0.5 rounded-full text-[10px] text-[#dfe2ee]">
              {removedProducts.length}
            </span>
          </button>
        </div>

        <div className="font-mono text-xs text-[#908fa0]">
          {viewMode === "active" ? (
            <span>Live products displayed on storefront catalog.</span>
          ) : (
            <span className="text-[#ffb4ab]">
              These products are unlisted and hidden from buyer views.
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-[#181c24] border border-[#262a33]">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#908fa0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by title or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 font-mono focus:outline-none focus:border-[#8083ff]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {["All", "Streaming", "Gaming", "Discord", "Software & Keys"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-[#8083ff] text-[#0d0096]"
                  : "bg-[#0f131c] text-[#c7c4d7] hover:text-[#dfe2ee] border border-[#262a33]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3">
          <p className="font-mono text-sm font-bold text-[#908fa0]">
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
              className="p-5 rounded-2xl bg-[#181c24] border border-[#262a33] hover:border-[#8083ff]/40 transition-all space-y-4 shadow-xl relative overflow-hidden group"
              style={
                prod.customBgUrl
                  ? {
                      backgroundImage: `linear-gradient(to bottom, rgba(24, 28, 36, 0.90), rgba(15, 19, 28, 0.98)), url(${prod.customBgUrl})`,
                      backgroundSize: prod.bgSize || "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProductIcon
                    type={prod.iconType}
                    customLogoUrl={prod.customLogoUrl}
                    logoSize={prod.logoSize}
                    className="w-12 h-12 shrink-0 rounded-xl bg-[#0f131c] border border-[#262a33] p-1.5"
                    size={22}
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-[#dfe2ee] truncate" title={prod.name}>
                      {prod.name}
                    </h3>
                    <div className="flex items-baseline gap-2 mt-1 font-mono">
                      <span className="text-sm font-black text-[#8083ff]">
                        ₹{prod.price}
                      </span>
                      <span className="text-[11px] text-[#908fa0]">
                        (~${(prod.price * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD)
                      </span>
                      <span className="text-[9px] uppercase font-bold text-[#c7c4d7] bg-[#262a33] px-1.5 py-0.5 rounded">
                        {prod.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Remove button in header */}
                {viewMode === "active" ? (
                  <button
                    onClick={() => handleRemoveProduct(prod.id, prod.name)}
                    className="p-2 text-[#908fa0] hover:text-[#ffb4ab] hover:bg-[#93000a]/20 rounded-xl transition-all cursor-pointer"
                    title="Remove product from store"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestoreProduct(prod.id, prod.name)}
                    className="p-2 text-[#4edea3] hover:bg-[#00a572]/20 rounded-xl transition-all cursor-pointer"
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
                  <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-[#908fa0] gap-2 min-w-0">
                      <span className="shrink-0">Delivery:</span>
                      <span className="font-semibold text-[#4edea3] truncate text-right">{prod.deliveryType}</span>
                    </div>
                    <div className="flex justify-between items-center text-[#908fa0] gap-2 min-w-0">
                      <span className="shrink-0">Database Stock:</span>
                      <span
                        className={`font-black text-[11px] px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                          activeUnits > 0
                            ? "text-[#4edea3] bg-[#00a572]/15 border-[#00a572]/30"
                            : "text-[#ffb4ab] bg-[#93000a]/20 border-[#ffb4ab]/30"
                        }`}
                      >
                        <span>📦</span>
                        <span>{activeUnits} units</span>
                      </span>
                    </div>
                    {prod.customFields && prod.customFields.length > 0 && (
                      <div className="pt-1 border-t border-[#262a33] flex flex-wrap gap-1 max-w-full overflow-hidden">
                        {prod.customFields.map((f: any, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#262a33] text-[#c7c4d7] border border-[#31353e] max-w-full truncate break-all">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons for this product (Responsive 3-column grid that never overflows) */}
              {(() => {
                const activeUnits = (prod.inventory ? prod.inventory.filter((i: any) => !i.claimedAt).length : prod.stockCount) ?? 0;
                return (
                  <div className="pt-2 font-mono text-xs">
                    {viewMode === "active" ? (
                      <div className="grid grid-cols-3 gap-1.5 w-full">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="py-2 px-1.5 rounded-lg bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] font-bold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1 cursor-pointer border border-[#31353e] min-w-0"
                          title="Edit product details"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#8083ff] shrink-0" />
                          <span className="truncate">Edit</span>
                        </button>

                        <button
                          onClick={() => openStockModal(prod)}
                          className="py-2 px-1.5 rounded-lg bg-[#00a572]/15 hover:bg-[#00a572]/25 text-[#4edea3] font-bold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1 cursor-pointer border border-[#00a572]/30 min-w-0"
                          title="View and manage available accounts & credentials in database"
                        >
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Stock ({activeUnits})</span>
                        </button>

                        <button
                          onClick={() => handleRemoveProduct(prod.id, prod.name)}
                          className="py-2 px-1.5 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] font-bold text-[11px] sm:text-xs transition-all flex items-center justify-center gap-1 cursor-pointer border border-[#ffb4ab]/30 min-w-0"
                          title="Remove product from store"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Remove</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRestoreProduct(prod.id, prod.name)}
                        className="w-full py-2.5 px-3 rounded-lg bg-[#00a572]/20 hover:bg-[#00a572]/40 text-[#4edea3] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-[#00a572]/40"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
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

          <div className="relative w-full max-w-2xl bg-[#181c24] rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#262a33] z-10 max-h-[90vh] overflow-y-auto space-y-6 text-[#dfe2ee]">
            <div className="flex items-center justify-between pb-4 border-b border-[#262a33]">
              <div className="flex items-center gap-2.5">
                <ProductIcon
                  type={iconType}
                  customLogoUrl={customLogoUrl}
                  logoSize={logoSize}
                  className="w-10 h-10 shrink-0 rounded-xl bg-[#0f131c] border border-[#262a33] p-1"
                  size={20}
                />
                <div>
                  <h3 className="text-lg font-black text-[#dfe2ee]">Create New Store Product</h3>
                  <p className="font-mono text-xs text-[#908fa0]">Configure product details, pricing, and custom ID/Password fields.</p>
                </div>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#908fa0] hover:text-[#dfe2ee]">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix 4K Key (Private Profile) or Steam CS2 Prime ID"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-bold"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] focus:outline-none cursor-pointer"
                  >
                    <option value="Streaming">Streaming</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Discord">Discord</option>
                    <option value="Software & Keys">Software &amp; Keys</option>
                    <option value="Subscriptions">Subscriptions</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Badge</label>
                  <select
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] focus:outline-none cursor-pointer"
                  >
                    <option value="Instant Key">Instant Key</option>
                    <option value="Best Seller">Best Seller</option>
                    <option value="Trending">Trending</option>
                    <option value="Hot Deal">Hot Deal</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              {/* Price & Original Price (Dual Currency Live Converter) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono text-xs font-bold text-[#c7c4d7]">Sale Price (₹ INR)</label>
                    {Number(price) > 0 && (
                      <span className="font-mono text-[11px] text-[#4edea3]">
                        ~${(Number(price) * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 199"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-bold font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono text-xs font-bold text-[#c7c4d7]">Original Price (₹ INR)</label>
                    {Number(originalPrice) > 0 && (
                      <span className="font-mono text-[11px] text-[#908fa0]">
                        ~${(Number(originalPrice) * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="e.g. 649 (for discount display)"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-bold font-mono"
                  />
                </div>
              </div>

              {/* Delivery Type */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Delivery Method</label>
                <select
                  value={deliveryType}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] focus:outline-none focus:border-[#8083ff] cursor-pointer"
                >
                  <option value="Instant Account ID + Pass">Instant Account ID + Pass (Steam / Netflix)</option>
                  <option value="Instant Activation Key">Instant Activation Key / Code (Steam Code / Windows)</option>
                  <option value="Instant Automated Delivery">Instant Automated Delivery (Discord Nitro / Invite)</option>
                </select>
              </div>

              {/* Product Visuals: Custom Logo & Background */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#262a33]">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#8083ff]" />
                    <span className="text-xs font-black text-[#dfe2ee] uppercase tracking-wider">
                      Product Visuals: Custom Logo & Background
                    </span>
                  </div>
                  <span className="text-[11px] text-[#908fa0] font-mono">Custom styling &amp; live preview</span>
                </div>

                {/* 1. Custom Logo & Brand Icon */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#c7c4d7] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#8083ff]" />
                      <span>Custom Product Logo / Brand Icon</span>
                    </label>
                    {customLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setCustomLogoUrl("")}
                        className="text-[11px] text-[#ffb4ab] hover:underline font-semibold cursor-pointer"
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
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
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
                    <label className="block text-[11px] text-[#908fa0] mb-1.5">
                      Or select from built-in brand icons:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#0f131c] rounded-xl border border-[#262a33]">
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
                              ? "bg-[#8083ff] text-[#0d0096] font-black shadow-md shadow-[#8083ff]/20"
                              : "bg-[#181c24] hover:bg-[#262a33] text-[#dfe2ee] border border-[#262a33]"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Size Selection */}
                  <div>
                    <label className="block text-[11px] text-[#908fa0] mb-1.5">
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
                              ? "bg-[#8083ff]/15 border-[#8083ff] text-[#8083ff] shadow-md shadow-[#8083ff]/10"
                              : "bg-[#0f131c] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                          }`}
                        >
                          <div className="text-xs font-bold">{sz.label}</div>
                          <div className="text-[10px] text-[#908fa0]">{sz.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Custom Background & Styling */}
                <div className="space-y-2.5 pt-2 border-t border-[#262a33]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#c7c4d7] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#8083ff]" />
                      <span>Card Background: Custom Image or Gradient Theme</span>
                    </label>
                    {customBgUrl && (
                      <button
                        type="button"
                        onClick={() => setCustomBgUrl("")}
                        className="text-[11px] text-[#ffb4ab] hover:underline font-semibold cursor-pointer"
                      >
                        Reset to theme gradient
                      </button>
                    )}
                  </div>

                  {/* Gradient presets */}
                  <div>
                    <label className="block text-[11px] text-[#908fa0] mb-1.5">
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
                              : "bg-[#0f131c] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
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
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
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
                    <label className="block text-[11px] text-[#908fa0] mb-1.5">
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
                              ? "bg-[#8083ff]/15 border-[#8083ff] text-[#8083ff] shadow-md shadow-[#8083ff]/10"
                              : "bg-[#0f131c] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                          }`}
                        >
                          <div className="text-xs font-bold">{bs.label}</div>
                          <div className="text-[10px] text-[#908fa0]">{bs.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Live Real-Time Card Preview */}
                <div className="pt-2 border-t border-[#262a33]">
                  <label className="block text-[11px] font-bold text-[#dfe2ee] mb-2 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-[#8083ff]" />
                    <span>Live Storefront Card Preview</span>
                  </label>
                  <div className="w-full max-w-xs mx-auto rounded-2xl bg-[#181c24] border border-[#262a33] overflow-hidden shadow-xl">
                    <div
                      className={`relative h-36 w-full p-4 flex flex-col justify-between overflow-hidden ${
                        !customBgUrl ? `bg-gradient-to-br ${bannerGradient}` : "bg-[#0f131c]"
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
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0f131c] via-black/40 to-black/30 pointer-events-none" />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#0f131c]/80 text-[#8083ff] backdrop-blur-md border border-[#262a33]">
                          {category}
                        </span>
                        {badge && badge !== "None" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#8083ff] text-[#0d0096]">
                            {badge}
                          </span>
                        )}
                      </div>

                      <div className="relative z-10 flex items-end justify-between mt-auto">
                        <ProductIcon
                          type={iconType}
                          customLogoUrl={customLogoUrl}
                          logoSize={logoSize}
                          className="w-12 h-12 rounded-xl bg-[#0f131c] border border-[#262a33] p-1"
                          size={24}
                        />
                        <div className="px-2 py-0.5 rounded-lg bg-[#0f131c]/80 backdrop-blur-md border border-[#262a33] text-[#4edea3] text-[10px] font-bold">
                          ⚡ Instant
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#181c24] border-t border-[#262a33] space-y-1">
                      <div className="text-xs font-black text-[#dfe2ee] truncate">
                        {name.trim() || "Product Title Example"}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-black text-[#8083ff] font-mono">
                          ₹{price || "199"}
                        </span>
                        <span className="text-[11px] text-[#908fa0] font-mono">
                          ~${(Number(price || 199) * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD
                        </span>
                        {originalPrice && (
                          <span className="text-[10px] text-[#908fa0] line-through font-mono">
                            ₹{originalPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Options / Credentials Selection */}
              <div className="p-4 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-[#dfe2ee] uppercase tracking-wider">
                    Select Custom Options / Credential Fields to Deliver
                  </label>
                  <span className="text-[11px] text-[#908fa0] font-mono">
                    Define what buyer receives
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:bg-[#181c24] text-[#dfe2ee] transition-colors">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includeId}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includeId: e.target.checked })}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>Account ID / Login</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:bg-[#181c24] text-[#dfe2ee] transition-colors">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includePassword}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includePassword: e.target.checked })}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>Password</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:bg-[#181c24] text-[#dfe2ee] transition-colors">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includeKey}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includeKey: e.target.checked })}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>License Key</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:bg-[#181c24] text-[#dfe2ee] transition-colors">
                    <input
                      type="checkbox"
                      checked={fieldOptions.includePin}
                      onChange={(e) => setFieldOptions({ ...fieldOptions, includePin: e.target.checked })}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>PIN / 2FA</span>
                  </label>
                </div>

                {/* Additional Custom Options (e.g. Profile PIN, Server, Region, Access URL) */}
                <div className="space-y-2 pt-2 border-t border-[#262a33]">
                  <label className="block text-[11px] font-bold text-[#c7c4d7]">
                    Add Extra Custom Options (e.g. Profile PIN, Server, Backup Code, Region)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type custom option name (e.g. Profile PIN)..."
                      value={newCustomOptionInput}
                      onChange={(e) => setNewCustomOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomOption();
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomOption}
                      className="px-4 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      + Add Option
                    </button>
                  </div>

                  {/* Badges for active custom options */}
                  {customOptionNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customOptionNames.map((optName) => (
                        <span
                          key={optName}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8083ff]/15 border border-[#8083ff]/30 text-[#8083ff] text-xs font-semibold"
                        >
                          <span>{optName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomOption(optName)}
                            className="hover:text-[#ffb4ab] text-[#908fa0] font-bold ml-1 cursor-pointer"
                            title="Remove custom option"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add Initial Stock Credentials */}
              <div className="p-4 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-[#dfe2ee] uppercase tracking-wider">
                    Add Initial Stock Credentials ({inventoryList.length} items ready)
                  </label>
                  <button
                    type="button"
                    onClick={() => setBulkMode(!bulkMode)}
                    className="text-xs text-[#8083ff] hover:underline font-bold cursor-pointer font-mono"
                  >
                    {bulkMode ? "Switch to Form Mode" : "Bulk Paste Mode (ID:PASS)"}
                  </button>
                </div>

                {bulkMode ? (
                  <div className="space-y-3">
                    {/* Header with Quick Presets & Controls */}
                    <div className="p-3 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[#dfe2ee] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#8083ff]" />
                          <span>Initial Stock Bulk Ingestion</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCreateBulkDedup(!createBulkDedup);
                              setCreateBulkError("");
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              createBulkDedup
                                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                                : "bg-[#181c24] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee]"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${createBulkDedup ? "bg-emerald-400 animate-pulse" : "bg-[#908fa0]"}`} />
                            <span>{createBulkDedup ? "Auto-Dedup: ON" : "Auto-Dedup: OFF"}</span>
                          </button>
                          {bulkStockText && (
                            <button
                              type="button"
                              onClick={() => {
                                setBulkStockText("");
                                setCreateBulkError("");
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-[#181c24] hover:bg-rose-950/40 text-[#908fa0] hover:text-rose-300 border border-[#262a33] transition-all cursor-pointer"
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick Sample Format Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#1e222b]">
                        <span className="text-[10px] font-mono text-[#908fa0] mr-1">Presets:</span>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("userpass", "create")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] transition-colors cursor-pointer"
                        >
                          + user:pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("userpass2fa", "create")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] transition-colors cursor-pointer"
                        >
                          + user:pass:2fa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("keys", "create")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] transition-colors cursor-pointer"
                        >
                          + License Keys
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={5}
                      placeholder={`Paste credentials lines here (one per line). Supported: user:pass, user:pass:token, user|pass, keys`}
                      value={bulkStockText}
                      onChange={(e) => {
                        setBulkStockText(e.target.value);
                        if (createBulkError) setCreateBulkError("");
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#090d14] border border-[#262a33] text-[#dfe2ee] font-mono placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff] resize-y leading-relaxed"
                    />

                    {/* Summary Badges & Live Preview Toggle */}
                    {bulkStockText.trim() && (
                      <div className="p-2.5 rounded-xl bg-[#10141d] border border-[#262a33] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-[#908fa0]">
                            Lines: <strong className="text-[#dfe2ee]">{createBulkParsed.totalLines}</strong>
                          </span>
                          <span className="text-[#262a33]">|</span>
                          <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <strong>{createBulkParsed.validCount}</strong> valid accounts
                          </span>
                          {createBulkParsed.duplicateCount > 0 && (
                            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25">
                              <strong>{createBulkParsed.duplicateCount}</strong> duplicates {createBulkDedup ? "skipped" : "detected"}
                            </span>
                          )}
                        </div>

                        {createBulkParsed.preview.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCreateBulkPreviewExpanded(!createBulkPreviewExpanded)}
                            className="text-[11px] text-[#8083ff] hover:text-[#9fa1ff] font-bold cursor-pointer underline flex items-center gap-1"
                          >
                            <span>{createBulkPreviewExpanded ? "Hide Preview" : "Show Preview"}</span>
                            <span>{createBulkPreviewExpanded ? "▲" : "▼"}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Live Preview List */}
                    {bulkStockText.trim() && createBulkPreviewExpanded && createBulkParsed.preview.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-[#090d14] border border-[#262a33] space-y-1.5 max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between pb-1 text-[10px] font-mono text-[#908fa0] border-b border-[#1e222b]">
                          <span>Previewing Parsed Accounts</span>
                          <button
                            type="button"
                            onClick={() => setShowCreateBulkPasswords(!showCreateBulkPasswords)}
                            className="text-[#8083ff] hover:underline cursor-pointer"
                          >
                            {showCreateBulkPasswords ? "Hide Passwords" : "Show Passwords"}
                          </button>
                        </div>
                        {createBulkParsed.preview.map((p, idx) => {
                          const isSkipped = createBulkDedup && (p.isDuplicateInBatch || p.existsInList);
                          return (
                            <div
                              key={idx}
                              className={`p-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 border ${
                                !p.isValid
                                  ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                                  : isSkipped
                                  ? "bg-amber-950/20 border-amber-500/30 text-amber-200/80 opacity-70"
                                  : "bg-[#10141d] border-[#262a33] text-[#dfe2ee]"
                              }`}
                            >
                              <span className="text-[10px] text-[#908fa0] w-6 shrink-0">#{p.lineNum}</span>
                              <span className="truncate flex-1 min-w-0 text-[11px]">
                                {p.isValid ? (
                                  <>
                                    <strong className="text-white">{p.item.id || p.item.email || "—"}</strong>
                                    {p.item.password && (
                                      <span className="text-[#908fa0] ml-2">
                                        pass: {showCreateBulkPasswords ? p.item.password : "••••••••"}
                                      </span>
                                    )}
                                    {p.item.token && <span className="text-[#8083ff] ml-2">key: {p.item.token}</span>}
                                  </>
                                ) : (
                                  <span className="text-rose-300">Invalid: {p.raw}</span>
                                )}
                              </span>
                              <span className="text-[10px] font-bold shrink-0">
                                {!p.isValid ? (
                                  <span className="text-rose-400">Invalid</span>
                                ) : isSkipped ? (
                                  <span className="text-amber-400">Duplicate</span>
                                ) : (
                                  <span className="text-emerald-400">Ready</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Error */}
                    {createBulkError && (
                      <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 font-mono">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{createBulkError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCreateBulkError("")}
                          className="text-rose-400 hover:text-white px-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleParseBulk}
                      disabled={createBulkParsed.validCount === 0}
                      className="w-full py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 font-mono shadow-md shadow-[#8083ff]/20"
                    >
                      ⚡ Parse &amp; Queue {createBulkParsed.validCount} Accounts
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {fieldOptions.includeId && (
                        <div>
                          <label className="block text-[10px] text-[#908fa0] uppercase font-bold mb-0.5">Account ID / Username</label>
                          <input
                            type="text"
                            placeholder="e.g. user_account_01"
                            value={stockInputId}
                            onChange={(e) => setStockInputId(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                          />
                        </div>
                      )}
                      {fieldOptions.includePassword && (
                        <div>
                          <label className="block text-[10px] text-[#908fa0] uppercase font-bold mb-0.5">Password</label>
                          <input
                            type="text"
                            placeholder="Account Password"
                            value={stockInputPass}
                            onChange={(e) => setStockInputPass(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                          />
                        </div>
                      )}
                      {fieldOptions.includeKey && (
                        <div>
                          <label className="block text-[10px] text-[#908fa0] uppercase font-bold mb-0.5">License Key / Token</label>
                          <input
                            type="text"
                            placeholder="XXXX-YYYY-ZZZZ"
                            value={stockInputKey}
                            onChange={(e) => setStockInputKey(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                          />
                        </div>
                      )}
                      {fieldOptions.includePin && (
                        <div>
                          <label className="block text-[10px] text-[#908fa0] uppercase font-bold mb-0.5">PIN / 2FA Secret</label>
                          <input
                            type="text"
                            placeholder="PIN or 2FA code"
                            value={stockInputPin}
                            onChange={(e) => setStockInputPin(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                          />
                        </div>
                      )}
                      {/* Render inputs for EVERY custom option! */}
                      {customOptionNames.map((optName) => (
                        <div key={optName}>
                          <label className="block text-[10px] text-[#8083ff] uppercase font-bold mb-0.5">
                            {optName}
                          </label>
                          <input
                            type="text"
                            placeholder={`Enter ${optName}`}
                            value={customStockInputs[optName] || ""}
                            onChange={(e) =>
                              setCustomStockInputs({
                                ...customStockInputs,
                                [optName]: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] focus:outline-none focus:border-[#8083ff] font-mono"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStockItem}
                      className="px-4 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#dfe2ee] text-xs font-bold border border-[#31353e] transition-all cursor-pointer"
                    >
                      + Add Item to Stock Batch
                    </button>
                  </div>
                )}

                {/* Display added items in batch (Responsive container that never overflows) */}
                {inventoryList.length > 0 && (
                  <div className="space-y-1.5 p-2.5 bg-[#0f131c] rounded-xl border border-[#262a33] text-[11px] font-mono">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#262a33]/60 px-0.5">
                      <span className="text-[10px] uppercase font-bold text-[#8083ff] flex items-center gap-1.5">
                        <span>📦</span>
                        <span>Pending Stock Batch ({inventoryList.length} accounts ready)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setInventoryList([])}
                        className="text-[10px] text-[#ffb4ab] hover:underline cursor-pointer font-bold"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                      {inventoryList.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#141822] border border-[#262a33] text-[#c7c4d7] min-w-0"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-[#8083ff]/20 text-[#8083ff] font-bold text-[10px] shrink-0">
                              #{idx + 1}
                            </span>
                            {Object.entries(item).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0f131c] text-[#dfe2ee] border border-[#262a33] text-[10px] max-w-full truncate"
                              >
                                <span className="text-[#908fa0] uppercase text-[9px] font-semibold">{k}:</span>
                                <span className="font-bold truncate select-all">{v}</span>
                              </span>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setInventoryList(inventoryList.filter((_, i) => i !== idx))}
                            className="p-1 text-[#ffb4ab] hover:text-white hover:bg-[#93000a]/20 rounded font-bold cursor-pointer shrink-0 transition-colors"
                            title="Remove item from batch"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description & Features */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Short Description</label>
                <input
                  type="text"
                  placeholder="e.g. Ultra HD 4K streaming key with private PIN profile."
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Product Features / Highlights */}
              <div className="p-3.5 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-bold text-[#8083ff] uppercase tracking-wider">
                    Product Features / Highlights ({featureInputs.length})
                  </label>
                  <span className="text-[10px] text-[#908fa0] font-mono">Store card badges</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Instant Delivery, Full Replacement Warranty"
                    value={newAddFeatureText}
                    onChange={(e) => setNewAddFeatureText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newAddFeatureText.trim()) {
                          setFeatureInputs([...featureInputs, newAddFeatureText.trim()]);
                          setNewAddFeatureText("");
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAddFeatureText.trim()) {
                        setFeatureInputs([...featureInputs, newAddFeatureText.trim()]);
                        setNewAddFeatureText("");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs cursor-pointer transition-all shrink-0"
                  >
                    + Add
                  </button>
                </div>
                {featureInputs.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1 font-mono">
                    {featureInputs.map((feat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-lg bg-[#0f131c] border border-[#262a33] text-xs text-[#c7c4d7] min-w-0"
                      >
                        <span className="truncate flex-1 min-w-0">{feat}</span>
                        <button
                          type="button"
                          onClick={() => setFeatureInputs(featureInputs.filter((_, i) => i !== idx))}
                          className="text-[#ffb4ab] hover:text-white shrink-0 p-1 rounded hover:bg-[#93000a]/20 cursor-pointer font-bold"
                          title="Remove feature"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-black text-sm shadow-xl shadow-[#8083ff]/20 cursor-pointer disabled:opacity-50 transition-all"
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

          <div className="relative w-full max-w-3xl bg-[#181c24] rounded-2xl p-5 sm:p-7 shadow-2xl border border-[#262a33] z-10 max-h-[92vh] overflow-y-auto space-y-5 text-[#dfe2ee]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#262a33] gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ProductIcon
                  type={targetProduct.iconType}
                  customLogoUrl={targetProduct.customLogoUrl}
                  logoSize={targetProduct.logoSize}
                  className="w-11 h-11 shrink-0 rounded-xl bg-[#0f131c] border border-[#262a33] p-1"
                  size={22}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#dfe2ee] truncate">
                      {targetProduct.name}
                    </h3>
                    <span
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        ((targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : targetProduct.stockCount) ?? 0) > 0
                          ? "bg-[#005236]/30 text-[#4edea3] border-[#4edea3]/30"
                          : "bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/30"
                      }`}
                    >
                      📦 {((targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : targetProduct.stockCount) ?? 0)} Available in DB
                    </span>
                  </div>
                  <p className="text-xs text-[#908fa0] mt-0.5 font-mono">
                    Live database stock linked directly to account credentials (ID, Password, Token).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="p-1.5 rounded-xl bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs inside Stock Modal */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-[#10141d] border border-[#262a33]">
              <button
                type="button"
                onClick={() => setStockModalTab("view")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  stockModalTab === "view"
                    ? "bg-[#8083ff] text-[#0d0096] shadow-md shadow-[#8083ff]/20 font-black"
                    : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                }`}
              >
                <span>📋 Available Credentials</span>
                <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] font-mono">
                  {(targetProduct.inventory ? targetProduct.inventory.filter((i: any) => !i.claimedAt).length : 0)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStockModalTab("add")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  stockModalTab === "add"
                    ? "bg-[#8083ff] text-[#0d0096] shadow-md shadow-[#8083ff]/20 font-black"
                    : "text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
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
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#908fa0]" />
                      <input
                        type="text"
                        placeholder="Search by ID, username, token, or PIN…"
                        value={stockSearchQuery}
                        onChange={(e) => setStockSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={toggleShowAllPasswords}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-[#262a33] hover:bg-[#31353e] border border-[#31353e] text-[#dfe2ee] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {showAllStockPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showAllStockPasswords ? "Hide All Passwords" : "Show All Passwords"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyAllCredentials}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-[#8083ff]/15 hover:bg-[#8083ff]/25 border border-[#8083ff]/30 text-[#8083ff] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedStockId === "all-credentials" ? <Check className="w-3.5 h-3.5 text-[#4edea3]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedStockId === "all-credentials" ? "Copied All!" : "Copy All (ID:PASS)"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!targetProduct.inventory || targetProduct.inventory.length === 0) && (
                  <div className="text-center py-10 px-4 rounded-2xl bg-[#10141d] border border-[#262a33] space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#8083ff]/10 border border-[#8083ff]/20 flex items-center justify-center text-[#8083ff] text-xl">
                      📦
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-[#dfe2ee]">
                        No Credentials Stored in Database Yet
                      </h4>
                      <p className="text-xs text-[#908fa0] max-w-sm mx-auto">
                        Add account IDs, passwords, or license keys using the &ldquo;Add Stock&rdquo; tab so this product has available units in the database and shows as In Stock to buyers.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStockModalTab("add")}
                      className="px-4 py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-black text-xs shadow-lg shadow-[#8083ff]/25 cursor-pointer transition-all"
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
                        if (item.claimedAt) return false;
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
                            className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                              isClaimed
                                ? "bg-[#10141d]/50 border-[#262a33]/50 opacity-60"
                                : "bg-[#10141d] border-[#262a33] hover:border-[#3b3f49]"
                            }`}
                          >
                            {/* Card Top: Index, Status, Added At, Delete Button */}
                            <div className="flex items-center justify-between pb-2 border-b border-[#262a33] text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-[#8083ff] bg-[#8083ff]/10 px-2 py-0.5 rounded-lg border border-[#8083ff]/20 text-[10px]">
                                  #{idx + 1}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    isClaimed
                                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                      : "bg-[#005236]/30 text-[#4edea3] border-[#4edea3]/30"
                                  }`}
                                >
                                  {isClaimed ? "Delivered / Claimed" : "Available in DB"}
                                </span>
                                {item.addedAt && (
                                  <span className="text-[10px] text-[#908fa0] font-mono hidden sm:inline">
                                    Added: {new Date(item.addedAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                                    {new Date(item.addedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={deletingStockItemId === item.id}
                                onClick={() => handleDeleteStockItem(item.id)}
                                className="text-[#908fa0] hover:text-[#ffb4ab] p-1.5 rounded-lg hover:bg-[#93000a]/20 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                                title="Delete this credential from database"
                              >
                                {deletingStockItemId === item.id ? (
                                  <span className="w-3.5 h-3.5 border-2 border-[#ffb4ab] border-t-transparent rounded-full animate-spin" />
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
                                <div className="p-2.5 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-[#8083ff] shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-[#908fa0] block font-sans">
                                        Account ID / Login
                                      </span>
                                      <span className="text-[#dfe2ee] font-bold truncate block select-all">
                                        {accountId}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStockValue(accountId, `id-${item.id}`)}
                                    className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer shrink-0"
                                    title="Copy Account ID"
                                  >
                                    {copiedStockId === `id-${item.id}` ? (
                                      <Check className="w-3 h-3 text-[#4edea3]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Password */}
                              {password && (
                                <div className="p-2.5 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 text-[#8083ff] shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-[#908fa0] block font-sans">
                                        Password
                                      </span>
                                      <span className="text-[#dfe2ee] font-bold truncate block select-all">
                                        {isPwdRevealed ? password : "••••••••••••"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => toggleRevealStockPassword(item.id)}
                                      className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer"
                                      title={isPwdRevealed ? "Hide Password" : "Show Password"}
                                    >
                                      {isPwdRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyStockValue(password, `pwd-${item.id}`)}
                                      className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer"
                                      title="Copy Password"
                                    >
                                      {copiedStockId === `pwd-${item.id}` ? (
                                        <Check className="w-3 h-3 text-[#4edea3]" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* License Key / Token */}
                              {token && (
                                <div className="p-2.5 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-[#8083ff] shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-[#908fa0] block font-sans">
                                        License Key / Code
                                      </span>
                                      <span className="text-[#8083ff] font-bold truncate block select-all">
                                        {token}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyStockValue(token, `tok-${item.id}`)}
                                    className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer shrink-0"
                                    title="Copy Key"
                                  >
                                    {copiedStockId === `tok-${item.id}` ? (
                                      <Check className="w-3 h-3 text-[#4edea3]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* 2FA / PIN */}
                              {pin && (
                                <div className="p-2.5 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="text-[9px] uppercase tracking-wider text-[#908fa0] block font-sans">
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
                                    className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer shrink-0"
                                    title="Copy PIN"
                                  >
                                    {copiedStockId === `pin-${item.id}` ? (
                                      <Check className="w-3 h-3 text-[#4edea3]" />
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
                                    <div key={k} className="p-2.5 rounded-xl bg-[#181c24] border border-[#262a33] flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <span className="text-[9px] uppercase tracking-wider text-[#908fa0] block font-sans">
                                          {k}
                                        </span>
                                        <span className="text-[#dfe2ee] font-bold truncate block select-all">
                                          {String(v)}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyStockValue(String(v), `custom-${item.id}-${k}`)}
                                        className="p-1 rounded-md bg-[#0f131c] hover:bg-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] transition-colors cursor-pointer shrink-0"
                                      >
                                        {copiedStockId === `custom-${item.id}-${k}` ? (
                                          <Check className="w-3 h-3 text-[#4edea3]" />
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
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#10141d] border border-[#262a33]">
                  <div>
                    <span className="text-xs font-bold text-[#dfe2ee] block">Input Mode</span>
                    <span className="text-[10px] text-[#908fa0] font-mono">
                      {stockBulkMode ? "Paste multiple accounts (one per line)" : "Add a single account credential"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStockBulkMode(!stockBulkMode)}
                    className="px-3 py-1.5 rounded-xl bg-[#262a33] text-[#8083ff] border border-[#31353e] text-xs font-bold hover:bg-[#8083ff] hover:text-[#0d0096] transition-all cursor-pointer font-mono"
                  >
                    {stockBulkMode ? "Switch to Form Mode" : "⚡ Switch to Bulk Paste Mode"}
                  </button>
                </div>

                {stockBulkMode ? (
                  /* Redesigned Bulk Paste Mode */
                  <div className="space-y-3">
                    {/* Header with Quick Presets & Controls */}
                    <div className="p-3.5 rounded-xl bg-[#0f131c] border border-[#262a33] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="font-mono text-xs font-bold text-[#dfe2ee] flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-[#8083ff]" />
                          <span>Bulk Credential Paste Engine</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStockBulkDedup(!stockBulkDedup);
                              setStockBulkError("");
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                              stockBulkDedup
                                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                                : "bg-[#181c24] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee]"
                            }`}
                            title="When enabled, duplicates within pasted lines or accounts already in database will be filtered out automatically"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stockBulkDedup ? "bg-emerald-400 animate-pulse" : "bg-[#908fa0]"}`} />
                            <span>{stockBulkDedup ? "Auto-Dedup: ON" : "Auto-Dedup: OFF"}</span>
                          </button>
                          {stockBulkText && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockBulkText("");
                                setStockBulkError("");
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-mono font-semibold bg-[#181c24] hover:bg-rose-950/40 text-[#908fa0] hover:text-rose-300 border border-[#262a33] hover:border-rose-500/30 transition-all cursor-pointer"
                              title="Clear all pasted text"
                            >
                              ✕ Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quick Sample Format Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-[#1e222b]">
                        <span className="text-[10px] font-mono text-[#908fa0] mr-1">Quick Presets:</span>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("userpass", "stock")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] hover:border-[#8083ff]/40 transition-colors cursor-pointer"
                        >
                          + user:pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("userpass2fa", "stock")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] hover:border-[#8083ff]/40 transition-colors cursor-pointer"
                        >
                          + user:pass:2fa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("keys", "stock")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] hover:border-[#8083ff]/40 transition-colors cursor-pointer"
                        >
                          + License Keys
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertSample("tab", "stock")}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#181c24] hover:bg-[#8083ff]/20 text-[#c7c4d7] hover:text-[#8083ff] border border-[#262a33] hover:border-[#8083ff]/40 transition-colors cursor-pointer"
                        >
                          + Tab-Separated
                        </button>
                      </div>

                      {/* Delimiters Supported */}
                      <div className="text-[10px] font-mono text-[#908fa0] flex items-center gap-1.5 flex-wrap">
                        <span>Delimiters supported:</span>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">:</code>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">|</code>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">\t (tab)</code>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">;</code>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">,</code>
                        <code className="text-[#8083ff] bg-[#181c24] px-1.5 py-0.5 rounded border border-[#262a33]">----</code>
                      </div>
                    </div>

                    {/* Textarea */}
                    <div>
                      <textarea
                        rows={6}
                        placeholder={`Paste credentials lines here (one per line). Examples:\nuser1:Password123\nuser2@email.com:SecretPass:2FA_PIN\nSTEAM-LICENSE-KEY-XXXXX\nuser4 | pass4 | token4`}
                        value={stockBulkText}
                        onChange={(e) => {
                          setStockBulkText(e.target.value);
                          if (stockBulkError) setStockBulkError("");
                        }}
                        className="w-full px-3.5 py-3 rounded-xl bg-[#090d14] border border-[#262a33] text-xs text-[#dfe2ee] font-mono placeholder-[#908fa0]/50 focus:outline-none focus:border-[#8083ff] focus:ring-1 focus:ring-[#8083ff]/40 resize-y leading-relaxed"
                      />
                    </div>

                    {/* Live Parse Summary Badges */}
                    {stockBulkText.trim() && (
                      <div className="p-2.5 rounded-xl bg-[#10141d] border border-[#262a33] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-[#908fa0]">
                            Total lines: <strong className="text-[#dfe2ee]">{stockBulkParsed.totalLines}</strong>
                          </span>
                          <span className="text-[#262a33]">|</span>
                          <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <strong>{stockBulkParsed.validCount}</strong> ready to save
                          </span>
                          {stockBulkParsed.duplicateCount > 0 && (
                            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25 flex items-center gap-1" title="Duplicate accounts">
                              <AlertCircle className="w-3 h-3" />
                              <strong>{stockBulkParsed.duplicateCount}</strong> duplicates {stockBulkDedup ? "filtered" : "detected"}
                            </span>
                          )}
                          {stockBulkParsed.invalidCount > 0 && (
                            <span className="text-[11px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                              <strong>{stockBulkParsed.invalidCount}</strong> invalid lines
                            </span>
                          )}
                        </div>

                        {stockBulkParsed.preview.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setStockBulkPreviewExpanded(!stockBulkPreviewExpanded)}
                            className="text-[11px] text-[#8083ff] hover:text-[#9fa1ff] font-bold cursor-pointer underline flex items-center gap-1"
                          >
                            <span>{stockBulkPreviewExpanded ? "Hide Preview" : "Live Preview Table"}</span>
                            <span>{stockBulkPreviewExpanded ? "▲" : "▼"}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Live Preview Table */}
                    {stockBulkText.trim() && stockBulkPreviewExpanded && stockBulkParsed.preview.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#090d14] border border-[#262a33] space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#1e222b] text-[11px] font-mono text-[#908fa0]">
                          <span className="font-bold text-[#dfe2ee]">
                            Live Parsed Preview ({stockBulkParsed.preview.length} lines parsed)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowBulkPasswords(!showBulkPasswords)}
                            className="text-[#8083ff] hover:underline cursor-pointer text-[10px] flex items-center gap-1"
                          >
                            {showBulkPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showBulkPasswords ? "Hide Passwords" : "Reveal Passwords"}</span>
                          </button>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                          {stockBulkParsed.preview.map((p, idx) => {
                            const isSkipped = stockBulkDedup && (p.isDuplicateInBatch || p.existsInDb);
                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded-lg text-xs font-mono flex items-center justify-between gap-2 border transition-all ${
                                  !p.isValid
                                    ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                                    : isSkipped
                                    ? "bg-amber-950/20 border-amber-500/30 text-amber-200/80 opacity-70"
                                    : "bg-[#10141d] border-[#262a33] text-[#dfe2ee]"
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-[10px] text-[#908fa0] w-6 shrink-0">#{p.lineNum}</span>
                                  {p.isValid ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-1.5 flex-1 min-w-0 text-[11px]">
                                      <div className="truncate">
                                        <span className="text-[9px] text-[#908fa0] block">LOGIN / ID:</span>
                                        <span className="font-bold text-white truncate block">
                                          {p.item.id || p.item.email || "—"}
                                        </span>
                                      </div>
                                      <div className="truncate">
                                        <span className="text-[9px] text-[#908fa0] block">PASSWORD:</span>
                                        <span className="text-[#dfe2ee] truncate block">
                                          {p.item.password
                                            ? showBulkPasswords
                                              ? p.item.password
                                              : "••••••••"
                                            : "—"}
                                        </span>
                                      </div>
                                      <div className="truncate">
                                        <span className="text-[9px] text-[#908fa0] block">KEY / TOKEN:</span>
                                        <span className="text-[#8083ff] truncate block">
                                          {p.item.token || p.item.key || "—"}
                                        </span>
                                      </div>
                                      <div className="truncate">
                                        <span className="text-[9px] text-[#908fa0] block">2FA / PIN:</span>
                                        <span className="text-cyan-300 truncate block">
                                          {p.item.pin || p.item.twoFactorKey || "—"}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-rose-300 truncate">
                                      Invalid format: {p.raw}
                                    </span>
                                  )}
                                </div>

                                <div className="shrink-0 text-[10px] font-bold">
                                  {!p.isValid ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                      Invalid
                                    </span>
                                  ) : p.existsInDb ? (
                                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30">
                                      {stockBulkDedup ? "Skipped (In DB)" : "Warning: In DB"}
                                    </span>
                                  ) : p.isDuplicateInBatch ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      {stockBulkDedup ? "Skipped (Duplicate)" : "Duplicate"}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      ✓ Ready
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Inline Error Banner */}
                    {stockBulkError && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2.5 font-mono">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{stockBulkError}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStockBulkError("")}
                          className="text-rose-400 hover:text-white cursor-pointer px-1.5 py-0.5"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Single Form Mode */
                  <div className="space-y-3">
                    <div>
                      <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">
                        Account ID / Login / Username / Email
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. steam_pro_acc10 or buyer@netflix.com"
                        value={singleStockId}
                        onChange={(e) => setSingleStockId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">
                        Account Password
                      </label>
                      <div className="relative">
                        <input
                          type={showSinglePass ? "text" : "password"}
                          placeholder="Account password"
                          value={singleStockPass}
                          onChange={(e) => setSingleStockPass(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSinglePass(!showSinglePass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#908fa0] hover:text-[#dfe2ee]"
                        >
                          {showSinglePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">
                          License Key / Redeem Code (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. STEAM-XXXX-YYYY or Activation Token"
                          value={singleStockKey}
                          onChange={(e) => setSingleStockKey(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">
                          2FA / Backup PIN / Profile PIN (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 1234 or 2FA backup codes"
                          value={singleStockPin}
                          onChange={(e) => setSingleStockPin(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                        />
                      </div>
                    </div>

                    {/* Render inputs for any Custom Options defined on this product */}
                    {stockModalCustomFields.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#262a33]">
                        <label className="block text-xs font-bold text-[#8083ff]">
                          Custom Product Options ({stockModalCustomFields.length})
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {stockModalCustomFields.map((optName) => (
                            <div key={optName}>
                              <label className="block text-[11px] font-bold text-[#c7c4d7] mb-1">
                                {optName}
                              </label>
                              <input
                                type="text"
                                placeholder={`Enter ${optName}`}
                                value={singleStockCustomValues[optName] || ""}
                                onChange={(e) =>
                                  setSingleStockCustomValues({
                                    ...singleStockCustomValues,
                                    [optName]: e.target.value,
                                  })
                                }
                                className="w-full px-3.5 py-2 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 font-mono focus:outline-none focus:border-[#8083ff]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Add Custom Option Field for this product */}
                    <div className="pt-2 border-t border-[#262a33] space-y-1.5">
                      <label className="block text-[11px] font-bold text-[#908fa0]">
                        + Add another custom option field to this product:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Profile PIN, Server Region, Backup Code"
                          value={newStockModalCustomOption}
                          onChange={(e) => setNewStockModalCustomOption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const t = newStockModalCustomOption.trim();
                              if (t && !stockModalCustomFields.includes(t)) {
                                setStockModalCustomFields([...stockModalCustomFields, t]);
                                setNewStockModalCustomOption("");
                              }
                            }
                          }}
                          className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const t = newStockModalCustomOption.trim();
                            if (t && !stockModalCustomFields.includes(t)) {
                              setStockModalCustomFields([...stockModalCustomFields, t]);
                              setNewStockModalCustomOption("");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={addingStock || (stockBulkMode && stockBulkParsed.validCount === 0)}
                    className="w-full py-3.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-black text-xs shadow-xl shadow-[#8083ff]/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all font-mono"
                  >
                    {addingStock ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#0d0096] border-t-transparent rounded-full animate-spin" />
                        <span>Saving {stockBulkMode ? `${stockBulkParsed.validCount} Accounts` : "Credential"} to Database…</span>
                      </>
                    ) : (
                      <>
                        <span>
                          💾 Save{" "}
                          {stockBulkMode
                            ? `${stockBulkParsed.validCount} Account${stockBulkParsed.validCount === 1 ? "" : "s"}`
                            : "Credential"}{" "}
                          to Database
                        </span>
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
          <div className="relative w-full max-w-2xl bg-[#181c24] rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#262a33] z-10 max-h-[90vh] overflow-y-auto space-y-6 text-[#dfe2ee]">
            <div className="flex items-center justify-between pb-4 border-b border-[#262a33]">
              <div className="flex items-center gap-2.5">
                <ProductIcon
                  type={editIconType}
                  customLogoUrl={editCustomLogoUrl}
                  logoSize={editLogoSize}
                  className="w-10 h-10 shrink-0 rounded-xl bg-[#0f131c] border border-[#262a33] p-1"
                  size={20}
                />
                <div>
                  <h3 className="text-lg font-black text-[#dfe2ee]">Edit Product Details</h3>
                  <p className="font-mono text-xs text-[#908fa0]">Update title, dual pricing (INR &amp; USD), database stock units, and specs.</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-[#908fa0] hover:text-[#dfe2ee]">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Product Title */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] font-bold focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] focus:outline-none cursor-pointer"
                  >
                    <option value="Streaming">Streaming</option>
                    <option value="Gaming">Gaming</option>
                    <option value="Discord">Discord</option>
                    <option value="Software & Keys">Software &amp; Keys</option>
                    <option value="Subscriptions">Subscriptions</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Badge</label>
                  <select
                    value={editBadge}
                    onChange={(e) => setEditBadge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] focus:outline-none cursor-pointer"
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

              {/* Pricing & Database Stock Units (Dual Currency) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono text-xs font-bold text-[#c7c4d7]">Sale Price (₹ INR)</label>
                    {Number(editPrice) > 0 && (
                      <span className="font-mono text-[11px] text-[#4edea3]">
                        ~${(Number(editPrice) * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] font-mono font-bold focus:outline-none focus:border-[#8083ff]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-mono text-xs font-bold text-[#c7c4d7]">Original Price (₹ INR)</label>
                    {Number(editOriginalPrice) > 0 && (
                      <span className="font-mono text-[11px] text-[#908fa0]">
                        ~${(Number(editOriginalPrice) * (APP_CONFIG.inrToUsdRate || 0.0118)).toFixed(2)} USD
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={editOriginalPrice}
                    onChange={(e) => setEditOriginalPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] font-mono font-bold focus:outline-none focus:border-[#8083ff]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Database Stock Units</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editStockCount}
                    onChange={(e) => setEditStockCount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-sm text-[#dfe2ee] font-mono font-bold focus:outline-none focus:border-[#8083ff]"
                  />
                </div>
              </div>

              {/* Delivery Type & Stock Status Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Delivery Method</label>
                  <select
                    value={editDeliveryType}
                    onChange={(e) => setEditDeliveryType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] focus:outline-none focus:border-[#8083ff] cursor-pointer"
                  >
                    <option value="Instant Account ID + Pass">Instant Account ID + Pass (Steam / Netflix)</option>
                    <option value="Instant Activation Key">Instant Activation Key / Code</option>
                    <option value="Instant Automated Delivery">Instant Automated Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Stock Availability</label>
                  <button
                    type="button"
                    onClick={() => setEditInStock(!editInStock)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                      editInStock
                        ? "bg-[#005236]/30 text-[#4edea3] border-[#4edea3]/40"
                        : "bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/40"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${editInStock ? "bg-[#4edea3]" : "bg-[#ffb4ab]"}`} />
                    <span>{editInStock ? "In Stock (Available)" : "Marked Out of Stock"}</span>
                  </button>
                </div>
              </div>

              {/* Warranty */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Warranty Guarantee</label>
                <input
                  type="text"
                  value={editWarranty}
                  onChange={(e) => setEditWarranty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Custom Options / Credential Fields to Deliver for Edit Product */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#10141d] border border-[#262a33] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#262a33]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#8083ff] uppercase tracking-wider">
                      Custom Options &amp; Credential Fields to Deliver
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#908fa0]">
                    Define credentials buyer receives
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:border-[#31353e] transition-colors">
                    <input
                      type="checkbox"
                      checked={editIncludeId}
                      onChange={(e) => setEditIncludeId(e.target.checked)}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>Account ID / Login</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:border-[#31353e] transition-colors">
                    <input
                      type="checkbox"
                      checked={editIncludePassword}
                      onChange={(e) => setEditIncludePassword(e.target.checked)}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>Password</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:border-[#31353e] transition-colors">
                    <input
                      type="checkbox"
                      checked={editIncludeKey}
                      onChange={(e) => setEditIncludeKey(e.target.checked)}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>License Key</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] cursor-pointer hover:border-[#31353e] transition-colors">
                    <input
                      type="checkbox"
                      checked={editIncludePin}
                      onChange={(e) => setEditIncludePin(e.target.checked)}
                      className="rounded accent-[#8083ff]"
                    />
                    <span>PIN / 2FA</span>
                  </label>
                </div>

                {/* Extra Custom Options */}
                <div className="space-y-2 pt-2 border-t border-[#262a33]">
                  <label className="block text-[11px] font-mono font-bold text-[#c7c4d7]">
                    Extra Custom Options (e.g. Profile PIN, Server, Backup Code, Region)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type custom option name (e.g. Profile PIN)..."
                      value={editNewCustomOptionInput}
                      onChange={(e) => setEditNewCustomOptionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEditCustomOption();
                        }
                      }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                    />
                    <button
                      type="button"
                      onClick={handleAddEditCustomOption}
                      className="px-4 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-mono font-bold transition-all cursor-pointer shrink-0"
                    >
                      + Add Option
                    </button>
                  </div>

                  {/* Badges for active custom options */}
                  {editCustomOptionsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {editCustomOptionsList.map((optName) => (
                        <span
                          key={optName}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0f131c] border border-[#262a33] text-[#8083ff] text-xs font-mono font-semibold"
                        >
                          <span>{optName}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditCustomOption(optName)}
                            className="hover:text-[#ffb4ab] text-[#908fa0] font-bold ml-1 cursor-pointer"
                            title="Remove custom option"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Product Visuals: Custom Logo & Background */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#10141d] border border-[#262a33] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#262a33]">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#8083ff]" />
                    <span className="text-xs font-mono font-bold text-[#8083ff] uppercase tracking-wider">
                      Product Visuals: Custom Logo &amp; Background
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-[#908fa0]">Custom styling &amp; live preview</span>
                </div>

                {/* 1. Custom Logo & Brand Icon */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-[#c7c4d7] flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-[#8083ff]" />
                      <span>Custom Product Logo / Brand Icon</span>
                    </label>
                    {editCustomLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCustomLogoUrl("")}
                        className="text-[11px] font-mono text-[#ffb4ab] hover:underline font-semibold cursor-pointer"
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
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
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
                    <label className="block text-[11px] font-mono text-[#908fa0] mb-1.5">
                      Or select from built-in brand icons:
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-[#0f131c] rounded-xl border border-[#262a33]">
                      {BUILTIN_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => {
                            setEditIconType(icon);
                            setEditCustomLogoUrl("");
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold capitalize transition-all cursor-pointer ${
                            editIconType === icon && !editCustomLogoUrl
                              ? "bg-[#8083ff] text-[#0d0096] font-bold shadow-md shadow-[#8083ff]/20"
                              : "bg-[#181c24] hover:bg-[#262a33] text-[#dfe2ee] border border-[#262a33]"
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Size Selection */}
                  <div>
                    <label className="block text-[11px] font-mono text-[#908fa0] mb-1.5">
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
                              ? "bg-[#8083ff]/15 border-[#8083ff] text-[#8083ff] shadow-sm"
                              : "bg-[#0f131c] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                          }`}
                        >
                          <div className="text-xs font-mono font-bold">{sz.label}</div>
                          <div className="text-[10px] text-[#908fa0]">{sz.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Custom Background & Styling */}
                <div className="space-y-2.5 pt-2 border-t border-[#262a33]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold text-[#c7c4d7] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#8083ff]" />
                      <span>Card Background: Custom Image or Gradient Theme</span>
                    </label>
                    {editCustomBgUrl && (
                      <button
                        type="button"
                        onClick={() => setEditCustomBgUrl("")}
                        className="text-[11px] font-mono text-[#ffb4ab] hover:underline font-semibold cursor-pointer"
                      >
                        Reset to theme gradient
                      </button>
                    )}
                  </div>

                  {/* Gradient presets */}
                  <div>
                    <label className="block text-[11px] font-mono text-[#908fa0] mb-1.5">
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
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                            editBannerGradient === gp.value && !editCustomBgUrl
                              ? `bg-[#262a33] border border-[#8083ff] text-[#dfe2ee] shadow-sm`
                              : "bg-[#0f131c] border border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                          }`}
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${gp.value} border border-[#262a33] shrink-0`}
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
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] font-mono"
                    />
                    <label className="px-3 py-2 rounded-xl bg-[#262a33] hover:bg-[#31353e] text-[#8083ff] border border-[#31353e] text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
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
                    <label className="block text-[11px] font-mono text-[#908fa0] mb-1.5">
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
                              ? "bg-[#8083ff]/15 border-[#8083ff] text-[#8083ff] shadow-sm"
                              : "bg-[#0f131c] border-[#262a33] text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#181c24]"
                          }`}
                        >
                          <div className="text-xs font-mono font-bold">{bs.label}</div>
                          <div className="text-[10px] text-[#908fa0]">{bs.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Live Real-Time Card Preview */}
                <div className="pt-2 border-t border-[#262a33]">
                  <label className="block text-[11px] font-mono font-bold text-[#8083ff] mb-2 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Live Storefront Card Preview</span>
                  </label>
                  <div className="w-full max-w-xs mx-auto rounded-2xl bg-[#181c24] border border-[#262a33] overflow-hidden shadow-xl">
                    <div
                      className={`relative h-36 w-full p-4 flex flex-col justify-between overflow-hidden ${
                        !editCustomBgUrl ? `bg-gradient-to-br ${editBannerGradient}` : "bg-[#181c24]"
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
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181c24] via-black/40 to-black/30 pointer-events-none" />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#0f131c]/80 text-[#8083ff] backdrop-blur-md border border-[#262a33]">
                          {editCategory}
                        </span>
                        {editBadge && editBadge !== "None" && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#8083ff] text-[#0d0096]">
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
                        <div className="px-2 py-0.5 rounded-lg bg-[#0f131c]/80 backdrop-blur-md border border-[#262a33] text-[#4edea3] text-[10px] font-mono font-bold">
                          ⚡ Instant
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#181c24] border-t border-[#262a33] space-y-1">
                      <div className="text-xs font-bold text-[#dfe2ee] truncate">
                        {editName.trim() || "Product Title Example"}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-mono font-bold text-[#dfe2ee]">
                          ₹{editPrice || "199"}
                        </span>
                        {editOriginalPrice && (
                          <span className="text-[10px] font-mono text-[#908fa0] line-through">
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
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Short Description</label>
                <input
                  type="text"
                  value={editShortDescription}
                  onChange={(e) => setEditShortDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] focus:outline-none focus:border-[#8083ff]"
                />
              </div>

              {/* Detailed Description */}
              <div>
                <label className="block font-mono text-xs font-bold text-[#c7c4d7] mb-1">Full Detailed Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] focus:outline-none focus:border-[#8083ff] resize-none"
                />
              </div>

              {/* Features List Editor */}
              <div className="p-4 rounded-xl bg-[#10141d] border border-[#262a33] space-y-2">
                <label className="block text-xs font-mono font-bold text-[#8083ff] uppercase tracking-wider">
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
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#0f131c] border border-[#262a33] text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFeatureText.trim()) {
                        setEditFeatures([...editFeatures, newFeatureText.trim()]);
                        setNewFeatureText("");
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-xs cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1 font-mono">
                  {editFeatures.map((feat, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#c7c4d7] min-w-0">
                      <span className="truncate flex-1 min-w-0">{feat}</span>
                      <button
                        type="button"
                        onClick={() => setEditFeatures(editFeatures.filter((_, i) => i !== idx))}
                        className="text-[#ffb4ab] hover:text-white shrink-0 p-1 rounded hover:bg-[#93000a]/20 cursor-pointer font-bold"
                        title="Remove feature"
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
                  className="w-full py-4 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-mono font-bold text-sm shadow-xl shadow-[#8083ff]/20 cursor-pointer disabled:opacity-50"
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
