import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Product, InventoryItem, PRODUCTS as DEFAULT_PRODUCTS } from "@/lib/products";
import { getBlacklist, markCredentialDeleted } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CUSTOM_PRODUCTS_KEY = "trinitymart_custom_products";
const REMOVED_PRODUCTS_KEY = "trinitymart_removed_product_ids";
const PRODUCT_OVERRIDES_KEY = "trinitymart_product_overrides";
const REVIEWS_REDIS_KEY = "trinitymart_reviews";
export const INVENTORY_KEY = (id: string) => `trinitymart_inventory_${id}`;

// Verify admin authorization
function checkAdminAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const adminPass = process.env.ADMIN_PASSWORD || "Ansh@24";
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === adminPass;
}

// GET: Returns all active products and removed products with live database stock, overrides, and reviews
export async function GET(req: NextRequest) {
  try {
    let customProducts: Product[] = [];
    let removedIds: string[] = [];
    let overrides: Record<string, any> = {};
    let allReviews: any[] = [];

    try {
      customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
    } catch (e) {
      console.warn("Failed to fetch custom products from redis:", e);
    }

    try {
      removedIds = (await redis.get<string[]>(REMOVED_PRODUCTS_KEY)) || [];
    } catch (e) {
      console.warn("Failed to fetch removed IDs from redis:", e);
    }

    try {
      overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
    } catch (e) {
      console.warn("Failed to fetch overrides from redis:", e);
    }

    try {
      allReviews = (await redis.get<any[]>(REVIEWS_REDIS_KEY)) || [];
    } catch (e) {
      console.warn("Failed to fetch reviews from redis:", e);
    }

    const initialMerged = [...customProducts, ...DEFAULT_PRODUCTS];

    const blacklist = await getBlacklist();

    // Fetch live database inventories for all products in parallel
    const inventories = await Promise.all(
      initialMerged.map(async (prod) => {
        try {
          const inv = await redis.get<InventoryItem[]>(INVENTORY_KEY(prod.id));
          if (inv && Array.isArray(inv)) {
            // Automatically purge any previously claimed or blacklisted items from database inventory
            const activeOnly = inv.filter((item) => {
              if (!item || item.claimedAt) return false;
              const itemId = String(item.id || "").trim().toLowerCase();
              const f = item.fields || {};
              const itemEmail = String(f.email || f.id || "").trim().toLowerCase();
              const itemToken = String(f.token || f.key || "").trim().toLowerCase();
              if (itemId && blacklist.has(itemId)) return false;
              if (itemEmail && blacklist.has(itemEmail)) return false;
              if (itemToken && blacklist.has(itemToken)) return false;
              return true;
            });

            if (activeOnly.length !== inv.length) {
              await redis.set(INVENTORY_KEY(prod.id), activeOnly);
            }
            return activeOnly;
          }

          // If custom product has inventory embedded but not in key, migrate it
          if (prod.inventory && Array.isArray(prod.inventory) && prod.inventory.length > 0) {
            const cleanCustomInv = prod.inventory.filter((item) => {
              if (!item || item.claimedAt) return false;
              const itemId = String(item.id || "").trim().toLowerCase();
              const f = item.fields || {};
              const itemEmail = String(f.email || f.id || "").trim().toLowerCase();
              const itemToken = String(f.token || f.key || "").trim().toLowerCase();
              return !blacklist.has(itemId) && !blacklist.has(itemEmail) && (!itemToken || !blacklist.has(itemToken));
            });
            await redis.set(INVENTORY_KEY(prod.id), cleanCustomInv);
            return cleanCustomInv;
          }

          // If discord-nitro-booster and inventory is empty, sync from credentials_pool
          if (prod.id === "discord-nitro-booster") {
            const pool = (await redis.get<any[]>("credentials_pool")) || [];
            if (Array.isArray(pool) && pool.length > 0) {
              const cleanPool = pool.filter((item: any) => {
                const id = String(item.id || "").trim().toLowerCase();
                const em = String(item.email || "").trim().toLowerCase();
                const tok = String(item.token || "").trim().toLowerCase();
                return !blacklist.has(id) && !blacklist.has(em) && (!tok || !blacklist.has(tok));
              });

              if (cleanPool.length > 0) {
                const migrated: InventoryItem[] = cleanPool.map((item: any) => ({
                  id: item.id || `inv-nitro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  fields: {
                    id: item.email || item.id || "DiscordNitroUser",
                    email: item.email,
                    password: item.discordPassword || item.password || item.emailPassword,
                    emailPassword: item.emailPassword,
                    token: item.token,
                    domain: item.domain || "Outlook.com",
                  },
                  addedAt: item.addedAt || new Date().toISOString(),
                }));
                await redis.set(INVENTORY_KEY(prod.id), migrated);
                return migrated;
              }
            }
          }

          return inv && Array.isArray(inv) ? inv : [];
        } catch {
          return [];
        }
      })
    );

    const merged = initialMerged.map((prod, idx) => {
      const p = { ...prod };
      const override = overrides[p.id];
      if (override) {
        Object.assign(p, override);
      }

      const inv = inventories[idx] || [];
      const activeInventory = inv.filter((item) => !item.claimedAt);
      p.inventory = activeInventory;

      // Available stock count strictly matches active account credentials in database!
      if (activeInventory.length > 0) {
        p.stockCount = activeInventory.length;
        p.inStock = activeInventory.length > 0;
      } else {
        const dbStock =
          override?.stockCount !== undefined
            ? override.stockCount
            : p.stockCount ?? 0;
        p.stockCount = Math.max(0, Number(dbStock));
        p.inStock =
          override?.inStock !== undefined
            ? Boolean(override.inStock)
            : p.stockCount > 0;
      }

      // Real reviews from database
      const prodReviews = allReviews.filter((r) => r.productId === p.id);
      if (prodReviews.length > 0) {
        p.reviews = prodReviews;
        p.reviewsCount = prodReviews.length;
        const totalRating = prodReviews.reduce(
          (sum: number, r: any) => sum + (Number(r.rating) || 5),
          0
        );
        p.rating = Number((totalRating / prodReviews.length).toFixed(1));
      } else {
        // If no real reviews in database, set to 0 reviews and rating 5
        p.reviews = [];
        p.reviewsCount = 0;
        p.rating = 5.0;
      }

      return p;
    });

    const activeProducts = merged.filter((p) => !removedIds.includes(p.id));
    const removedProducts = merged.filter((p) => removedIds.includes(p.id));

    return NextResponse.json({
      success: true,
      customProducts,
      allProducts: activeProducts,
      removedProducts,
      removedIds,
    });
  } catch (err) {
    console.error("GET /api/admin/products error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve products" },
      { status: 500 }
    );
  }
}

// POST: Add a new custom product with custom options (id, pass, key, pin, etc.)
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      category,
      price,
      originalPrice,
      badge,
      deliveryType,
      shortDescription,
      description,
      features,
      customFields,
      initialStock,
      bannerGradient,
      iconType,
      customLogoUrl,
      logoSize,
      customBgUrl,
      bgSize,
    } = body;

    if (!name || !price) {
      return NextResponse.json(
        { error: "Product name and price are required" },
        { status: 400 }
      );
    }

    // Generate unique slug id
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now().toString().slice(-4);

    const stockItems = Array.isArray(initialStock) ? initialStock : [];

    const newProduct: Product = {
      id: slug,
      name: name.trim(),
      category: category || "Gaming",
      badge: badge || undefined,
      price: Number(price),
      originalPrice: Number(originalPrice) || Number(price),
      rating: 5.0,
      reviewsCount: 1,
      shortDescription:
        shortDescription || `Genuine ${name} with instant automated delivery.`,
      description:
        description ||
        `Get instant access to ${name}. Includes authentic credentials and full replacement warranty.`,
      features:
        Array.isArray(features) && features.length > 0
          ? features
          : [
              "100% Genuine Digital License",
              "Instant Automated Delivery",
              "Full Replacement Warranty",
              "24/7 Discord Live Support",
            ],
      deliveryType: deliveryType || "Instant Account ID + Pass",
      warranty: "Full Replacement Warranty",
      inStock: stockItems.length > 0,
      stockCount: stockItems.length,
      tags: [category?.toLowerCase() || "digital", "gaming", "keys"],
      bannerGradient: bannerGradient || "from-blue-600/25 via-cyan-950/40 to-zinc-900",
      iconType: iconType || "key",
      customLogoUrl: customLogoUrl || undefined,
      logoSize: logoSize || "medium",
      customBgUrl: customBgUrl || undefined,
      bgSize: bgSize || "cover",
      reviews: [
        {
          id: `rev-initial-${Date.now()}`,
          userName: "Admin Verified",
          rating: 5,
          date: "Recently",
          comment: "Official product added with guaranteed warranty and instant fulfillment.",
          verified: true,
        },
      ],
      customFields:
        Array.isArray(customFields) && customFields.length > 0
          ? customFields
          : [
              { id: "id", name: "Account ID / Login", type: "text" },
              { id: "password", name: "Password", type: "password" },
            ],
      inventory: stockItems.map((item: any, idx: number) => ({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
        fields: typeof item === "object" ? item : { token: String(item) },
        addedAt: new Date().toISOString(),
      })),
      isCustom: true,
    };

    if (newProduct.inventory && newProduct.inventory.length > 0) {
      await redis.set(INVENTORY_KEY(slug), newProduct.inventory);
    }

    let existing: Product[] = [];
    try {
      existing = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
    } catch {
      existing = [];
    }

    const updated = [newProduct, ...existing];
    await redis.set(CUSTOM_PRODUCTS_KEY, updated);

    return NextResponse.json({
      success: true,
      product: newProduct,
      totalCustom: updated.length,
    });
  } catch (err) {
    console.error("POST /api/admin/products error:", err);
    return NextResponse.json(
      { error: "Failed to create custom product" },
      { status: 500 }
    );
  }
}

// DELETE: Remove ANY product (custom or default) from store
export async function DELETE(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Product id is required" },
        { status: 400 }
      );
    }

    // 1. If it's a custom product, remove it from custom products list
    let existingCustom: Product[] = [];
    try {
      existingCustom = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
      const filteredCustom = existingCustom.filter((p) => p.id !== id);
      if (filteredCustom.length !== existingCustom.length) {
        await redis.set(CUSTOM_PRODUCTS_KEY, filteredCustom);
      }
    } catch (e) {
      console.warn("Error removing from custom list:", e);
    }

    // 2. Add id to removed products list so default products are also hidden
    let removedIds: string[] = [];
    try {
      removedIds = (await redis.get<string[]>(REMOVED_PRODUCTS_KEY)) || [];
    } catch {
      removedIds = [];
    }

    if (!removedIds.includes(id)) {
      removedIds.push(id);
      await redis.set(REMOVED_PRODUCTS_KEY, removedIds);
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      totalRemoved: removedIds.length,
    });
  } catch (err) {
    console.error("DELETE /api/admin/products error:", err);
    return NextResponse.json(
      { error: "Failed to remove product" },
      { status: 500 }
    );
  }
}

// PUT: Add inventory/credentials, update price/stock, OR RESTORE a removed product
export async function PUT(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, price, inStock, newStockItem, restore } = body;

    if (!id) {
      return NextResponse.json({ error: "Product id is required" }, { status: 400 });
    }

    // If restore is requested, remove from REMOVED_PRODUCTS_KEY
    if (restore) {
      let removedIds: string[] = [];
      try {
        removedIds = (await redis.get<string[]>(REMOVED_PRODUCTS_KEY)) || [];
      } catch {
        removedIds = [];
      }

      const filtered = removedIds.filter((item) => item !== id);
      await redis.set(REMOVED_PRODUCTS_KEY, filtered);

      return NextResponse.json({
        success: true,
        restoredId: id,
        remainingRemoved: filtered.length,
      });
    }

    // Handle full product edit
    if (body.action === "edit") {
      const {
        name,
        category,
        price: editPrice,
        originalPrice: editOrigPrice,
        stockCount: editStock,
        inStock: editInStock,
        badge: editBadge,
        deliveryType: editDelivery,
        warranty: editWarranty,
        shortDescription: editShortDesc,
        description: editDesc,
        features: editFeatures,
        customFields: editCustomFields,
        bannerGradient,
        iconType,
        customLogoUrl,
        logoSize,
        customBgUrl,
        bgSize,
      } = body;

      // 1. Update in custom products if custom
      let customProducts: Product[] = [];
      try {
        customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
      } catch {
        customProducts = [];
      }

      const customIndex = customProducts.findIndex((p) => p.id === id);
      if (customIndex !== -1) {
        const prod = customProducts[customIndex];
        if (name) prod.name = String(name).trim();
        if (category) prod.category = String(category);
        if (editPrice !== undefined) prod.price = Number(editPrice);
        if (editOrigPrice !== undefined) prod.originalPrice = Number(editOrigPrice);
        if (editStock !== undefined) prod.stockCount = Math.max(0, Number(editStock));
        if (editInStock !== undefined) prod.inStock = Boolean(editInStock);
        if (editBadge !== undefined) prod.badge = editBadge === "None" ? undefined : editBadge;
        if (editDelivery) prod.deliveryType = editDelivery;
        if (editWarranty) prod.warranty = editWarranty;
        if (editShortDesc !== undefined) prod.shortDescription = String(editShortDesc).trim();
        if (editDesc !== undefined) prod.description = String(editDesc).trim();
        if (Array.isArray(editFeatures)) prod.features = editFeatures;
        if (Array.isArray(editCustomFields)) prod.customFields = editCustomFields;
        if (bannerGradient) prod.bannerGradient = String(bannerGradient);
        if (iconType) prod.iconType = String(iconType);
        if (customLogoUrl !== undefined) prod.customLogoUrl = customLogoUrl;
        if (logoSize !== undefined) prod.logoSize = logoSize;
        if (customBgUrl !== undefined) prod.customBgUrl = customBgUrl;
        if (bgSize !== undefined) prod.bgSize = bgSize;

        customProducts[customIndex] = prod;
        await redis.set(CUSTOM_PRODUCTS_KEY, customProducts);
      }

      // 2. Save into PRODUCT_OVERRIDES_KEY for ANY product (custom or default)
      let overrides: Record<string, any> = {};
      try {
        overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
      } catch {
        overrides = {};
      }

      const existingOverride = overrides[id] || {};
      const newOverride: Record<string, any> = {
        ...existingOverride,
        id,
        ...(name ? { name: String(name).trim() } : {}),
        ...(category ? { category: String(category) } : {}),
        ...(editPrice !== undefined ? { price: Number(editPrice) } : {}),
        ...(editOrigPrice !== undefined ? { originalPrice: Number(editOrigPrice) } : {}),
        ...(editStock !== undefined ? { stockCount: Math.max(0, Number(editStock)) } : {}),
        ...(editInStock !== undefined ? { inStock: Boolean(editInStock) } : {}),
        badge: editBadge === "None" ? undefined : (editBadge || existingOverride.badge),
        ...(editDelivery ? { deliveryType: editDelivery } : {}),
        ...(editWarranty ? { warranty: editWarranty } : {}),
        ...(editShortDesc !== undefined ? { shortDescription: String(editShortDesc).trim() } : {}),
        ...(editDesc !== undefined ? { description: String(editDesc).trim() } : {}),
        ...(Array.isArray(editFeatures) ? { features: editFeatures } : {}),
        ...(Array.isArray(editCustomFields) ? { customFields: editCustomFields } : {}),
        ...(bannerGradient ? { bannerGradient: String(bannerGradient) } : {}),
        ...(iconType ? { iconType: String(iconType) } : {}),
        ...(customLogoUrl !== undefined ? { customLogoUrl } : {}),
        ...(logoSize !== undefined ? { logoSize } : {}),
        ...(customBgUrl !== undefined ? { customBgUrl } : {}),
        ...(bgSize !== undefined ? { bgSize } : {}),
        updatedAt: new Date().toISOString(),
      };

      overrides[id] = newOverride;
      await redis.set(PRODUCT_OVERRIDES_KEY, overrides);

      return NextResponse.json({
        success: true,
        message: `Product "${name || id}" updated successfully in database`,
        updatedProduct: newOverride,
      });
    }

    // Handle deleting an individual stock credential item
    if (body.action === "delete_stock_item") {
      const { inventoryItemId } = body;
      if (!inventoryItemId) {
        return NextResponse.json({ error: "inventoryItemId is required" }, { status: 400 });
      }

      let inventory: InventoryItem[] = [];
      try {
        inventory = (await redis.get<InventoryItem[]>(INVENTORY_KEY(id))) || [];
      } catch {
        inventory = [];
      }

      const targetItem = inventory.find((item) => item.id === inventoryItemId);
      const updatedInventory = inventory.filter((item) => item.id !== inventoryItemId);
      await redis.set(INVENTORY_KEY(id), updatedInventory);

      // Permanently blacklist so it can NEVER be sent or claimed
      const identifiersToBlacklist = [inventoryItemId];
      if (targetItem?.fields?.email) identifiersToBlacklist.push(targetItem.fields.email);
      if (targetItem?.fields?.id) identifiersToBlacklist.push(targetItem.fields.id);
      if (targetItem?.fields?.token) identifiersToBlacklist.push(targetItem.fields.token);
      await markCredentialDeleted(identifiersToBlacklist);

      // Also clean up credentials_pool if present
      try {
        const pool = (await redis.get<any[]>("credentials_pool")) || [];
        if (Array.isArray(pool) && pool.length > 0) {
          const filteredPool = pool.filter(
            (c) =>
              c.id !== inventoryItemId &&
              (!targetItem?.fields?.email || (c.email !== targetItem.fields.email && c.id !== targetItem.fields.email)) &&
              (!targetItem?.fields?.id || (c.email !== targetItem.fields.id && c.id !== targetItem.fields.id))
          );
          if (filteredPool.length !== pool.length) {
            await redis.set("credentials_pool", filteredPool);
          }
        }
      } catch (e) {
        console.warn("Could not sync credentials_pool on stock item delete:", e);
      }

      const activeCount = updatedInventory.filter((item) => !item.claimedAt).length;

      // Update overrides with live database stock count
      let overrides: Record<string, any> = {};
      try {
        overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
      } catch {
        overrides = {};
      }
      overrides[id] = {
        ...(overrides[id] || {}),
        id,
        stockCount: activeCount,
        inStock: activeCount > 0,
        updatedAt: new Date().toISOString(),
      };
      await redis.set(PRODUCT_OVERRIDES_KEY, overrides);

      // Also update custom products if custom
      let customProducts: Product[] = [];
      try {
        customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
        const cIdx = customProducts.findIndex((p) => p.id === id);
        if (cIdx !== -1) {
          customProducts[cIdx].inventory = updatedInventory;
          customProducts[cIdx].stockCount = activeCount;
          customProducts[cIdx].inStock = activeCount > 0;
          await redis.set(CUSTOM_PRODUCTS_KEY, customProducts);
        }
      } catch (e) {
        console.warn("Could not sync custom products list on delete:", e);
      }

      return NextResponse.json({
        success: true,
        message: "Credential removed from database",
        inventory: updatedInventory,
        stockCount: activeCount,
        inStock: activeCount > 0,
      });
    }

    // Handle adding stock credentials (single item or bulk array)
    const itemsToAdd: Record<string, string>[] = [];
    if (Array.isArray(body.stockItems) && body.stockItems.length > 0) {
      itemsToAdd.push(...body.stockItems);
    } else if (newStockItem && typeof newStockItem === "object") {
      itemsToAdd.push(newStockItem);
    }

    if (itemsToAdd.length > 0) {
      let inventory: InventoryItem[] = [];
      try {
        inventory = (await redis.get<InventoryItem[]>(INVENTORY_KEY(id))) || [];
      } catch {
        inventory = [];
      }

      const nowIso = new Date().toISOString();
      const newItems: InventoryItem[] = itemsToAdd.map((fields, idx) => ({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${idx}`,
        fields,
        addedAt: nowIso,
      }));

      const updatedInventory = [...inventory, ...newItems];
      await redis.set(INVENTORY_KEY(id), updatedInventory);

      const activeCount = updatedInventory.filter((item) => !item.claimedAt).length;

      // Update overrides
      let overrides: Record<string, any> = {};
      try {
        overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
      } catch {
        overrides = {};
      }
      overrides[id] = {
        ...(overrides[id] || {}),
        id,
        stockCount: activeCount,
        inStock: activeCount > 0,
        updatedAt: nowIso,
      };
      await redis.set(PRODUCT_OVERRIDES_KEY, overrides);

      // Also update custom products if applicable
      let customProducts: Product[] = [];
      try {
        customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
        const cIdx = customProducts.findIndex((p) => p.id === id);
        if (cIdx !== -1) {
          customProducts[cIdx].inventory = updatedInventory;
          customProducts[cIdx].stockCount = activeCount;
          customProducts[cIdx].inStock = activeCount > 0;
          await redis.set(CUSTOM_PRODUCTS_KEY, customProducts);
        }
      } catch (e) {
        console.warn("Could not sync custom products list on add:", e);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully added ${newItems.length} credential(s) to database! Total available: ${activeCount}.`,
        inventory: updatedInventory,
        stockCount: activeCount,
        inStock: activeCount > 0,
      });
    }

    // Otherwise handle price/inStock toggle
    if (price !== undefined || inStock !== undefined) {
      let overrides: Record<string, any> = {};
      try {
        overrides = (await redis.get<Record<string, any>>(PRODUCT_OVERRIDES_KEY)) || {};
      } catch {
        overrides = {};
      }
      overrides[id] = {
        ...(overrides[id] || {}),
        id,
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(inStock !== undefined ? { inStock: Boolean(inStock) } : {}),
        updatedAt: new Date().toISOString(),
      };
      await redis.set(PRODUCT_OVERRIDES_KEY, overrides);

      let customProducts: Product[] = [];
      try {
        customProducts = (await redis.get<Product[]>(CUSTOM_PRODUCTS_KEY)) || [];
        const cIdx = customProducts.findIndex((p) => p.id === id);
        if (cIdx !== -1) {
          if (price !== undefined) customProducts[cIdx].price = Number(price);
          if (inStock !== undefined) customProducts[cIdx].inStock = Boolean(inStock);
          await redis.set(CUSTOM_PRODUCTS_KEY, customProducts);
        }
      } catch (e) {
        console.warn("Could not sync custom products on price change:", e);
      }

      return NextResponse.json({
        success: true,
        message: "Product updated successfully",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Product state unchanged",
    });
  } catch (err) {
    console.error("PUT /api/admin/products error:", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
