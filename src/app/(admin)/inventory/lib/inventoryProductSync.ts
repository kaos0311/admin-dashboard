"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";

import type { InventoryItem } from "./inventoryTypes";

type ProductSyncInput = Partial<InventoryItem> &
  Pick<InventoryItem, "name" | "category">;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildSearchKeywords(values: string[]): string[] {
  return Array.from(
    new Set(
      normalizeSearchText(values.join(" "))
        .split(" ")
        .map((word) => word.trim())
        .filter(Boolean)
    )
  ).slice(0, 100);
}

function safeDocId(value: string): string {
  const cleanId = value
    .trim()
    .toLowerCase()
    .replace(/[\/\\#[\].$]/g, "-")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleanId || `inventory-product-${Date.now()}`;
}

function inferProductCategory(item: ProductSyncInput) {
  const text = `${item.name} ${item.category} ${item.hcpc}`.toLowerCase();

  if (text.includes("cpap") || text.includes("bipap")) return "CPAP";
  if (text.includes("mask")) return "CPAP Accessories";

  if (text.includes("everflo")) return "Oxygen - Everflo";
  if (text.includes("perfecto")) return "Oxygen - Perfecto";
  if (text.includes("platinum 5")) return "Oxygen - Platinum 5";
  if (text.includes("millennium")) return "Oxygen - Millennium";
  if (text.includes("airsep")) return "Oxygen - AirSep";
  if (text.includes("intensity")) return "Oxygen - Intensity";
  if (text.includes("sequal")) return "Oxygen - SeQual";
  if (text.includes("oxygen") || text.includes("concentrator")) return "Oxygen - Concentrator";

  if (text.includes("wheelchair")) return "Mobility";
  if (text.includes("walker") || text.includes("rollator")) return "Mobility";
  if (text.includes("hospital bed") || text.includes("bed rail")) return "Beds";
  if (text.includes("commode") || text.includes("bath")) return "Bath Safety";

  return "General";
}

function inferProductTypeFromCategory(category: string) {
  const text = category.toLowerCase();
  if (text.includes("cpap") || text.includes("bipap")) return "cpap";
  if (text.includes("oxygen") || text.includes("concentrator")) return "oxygen";
  return "resale";
}

async function findExistingProduct(item: ProductSyncInput): Promise<string | null> {
  const directProductId = clean(item.productId);
  if (directProductId) {
    const directSnap = await getDoc(doc(db, "products", directProductId));
    if (directSnap.exists()) return directProductId;
  }

  const barcode = item.barcode ? normalizeBarcode(item.barcode) : "";
  const checks: Array<[string, string]> = [
    ["upc", barcode],
    ["sku", clean(item.sku)],
    ["hcpcs", clean(item.hcpc).toUpperCase()],
    ["manufacturerItemId", clean(item.manufacturerItemId)],
  ];

  for (const [field, value] of checks) {
    if (!value) continue;

    const snap = await getDocs(
      query(collection(db, "products"), where(field, "==", value), limit(1))
    );

    const match = snap.docs.find((docSnap) => docSnap.data().deleted !== true);
    if (match) return match.id;
  }

  return null;
}

export async function ensureProductFromInventory(item: ProductSyncInput) {
  const name = clean(item.name);
  const itemCategory = clean(item.category);
  const resolvedCategory = itemCategory || inferProductCategory(item);

  if (!name) return null;

  const barcode = item.barcode ? normalizeBarcode(item.barcode) : "";
  const hcpcs = clean(item.hcpc).toUpperCase();
  const sku = clean(item.sku);
  const manufacturer = clean(item.manufacturer);
  const manufacturerItemId = clean(item.manufacturerItemId);
  const model = clean(item.modelNumber);
  const productType = inferProductTypeFromCategory(resolvedCategory);
  const existingId = await findExistingProduct(item);
  const productId =
    existingId ||
    safeDocId(sku || barcode || hcpcs || manufacturerItemId || `${name}-${resolvedCategory}`);

  const searchValues = [
    name,
    resolvedCategory,
    productType,
    manufacturer,
    manufacturerItemId,
    model,
    sku,
    barcode,
    hcpcs,
  ];

  await setDoc(
    doc(db, "products", productId),
    {
      name,
      brand: manufacturer,
      model,
      category: resolvedCategory,
      productType,
      manufacturer,
      manufacturerItemId,
      sku,
      upc: barcode,
      hcpcs,
      defaultPurchasePrice: item.unitCost || 0,
      unitOfMeasure: "each",
      reorderLevel: item.reorderLevel || 0,
      status: item.status === "discontinued" ? "discontinued" : "active",
      isRentalItem: false,
      isSerialized: Boolean(item.serial),
      requiresSerialTracking: Boolean(item.serial),
      lotTracking: Boolean(item.lotNumber),
      deleted: false,
      source: "inventory_auto_sync",
      inventoryLinkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      searchText: normalizeSearchText(searchValues.join(" ")),
      searchKeywords: buildSearchKeywords(searchValues),
      ...(existingId
        ? {}
        : {
            createdAt: serverTimestamp(),
            autoCreatedFromInventory: true,
            notes: "Created automatically from inventory scan/save.",
          }),
    },
    { merge: true }
  );

  if (hcpcs && /^[A-Z]\d{4}[A-Z0-9]{0,2}$/.test(hcpcs)) {
    await setDoc(
      doc(db, "hcpcsCodes", hcpcs),
      {
        code: hcpcs,
        shopDescription: name,
        shopCategory: resolvedCategory,
        observedInShop: true,
        lastObservedSource: "inventory_auto_sync",
        lastObservedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return productId;
}
