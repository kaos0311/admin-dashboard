import type { Product, ProductStatus, ProductType } from "./productTypes";

export function toSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toSafeNumber(value: unknown): number {
  if (value === "" || value == null) return 0;

  const parsed = Number(String(value).replace(/[$,]/g, "").trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildSearchKeywords(values: string[]): string[] {
  const words = values
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  return Array.from(new Set(words)).slice(0, 100);
}

export function normalizeStatus(value: unknown): ProductStatus {
  if (value === "inactive") return "inactive";
  if (value === "discontinued") return "discontinued";
  return "active";
}

export function normalizeType(value: unknown): ProductType {
  const allowed: ProductType[] = [
    "resale",
    "rental",
    "consumable",
    "serialized",
    "service",
    "oxygen",
    "cpap",
    "other",
  ];

  return allowed.includes(value as ProductType)
    ? (value as ProductType)
    : "resale";
}

export function normalizeProduct(
  id: string,
  data: Record<string, unknown>
): Product {
  return {
    id,
    name: toSafeString(data.name),
    brand: toSafeString(data.brand),
    model: toSafeString(data.model),
    category: toSafeString(data.category),
    productType: normalizeType(data.productType),
    manufacturer: toSafeString(data.manufacturer),
    manufacturerItemId: toSafeString(data.manufacturerItemId),
    primaryVendor: toSafeString(data.primaryVendor),
    secondaryVendor: toSafeString(data.secondaryVendor),
    sku: toSafeString(data.sku),
    upc: toSafeString(data.upc),
    hcpcs: toSafeString(data.hcpcs),
    ndc: toSafeString(data.ndc),
    basePrice: toSafeNumber(data.basePrice),
    defaultPurchasePrice: toSafeNumber(data.defaultPurchasePrice),
    defaultRentalRate: toSafeNumber(data.defaultRentalRate),
    unitOfMeasure: toSafeString(data.unitOfMeasure) || "each",
    reorderLevel: toSafeNumber(data.reorderLevel),
    warrantyMonths: toSafeNumber(data.warrantyMonths),
    weight: toSafeString(data.weight),
    dimensions: toSafeString(data.dimensions),
    imageUrl: toSafeString(data.imageUrl),
    thumbnailUrl: toSafeString(data.thumbnailUrl),
    status: normalizeStatus(data.status),
    isRentalItem: Boolean(data.isRentalItem),
    isSerialized: Boolean(data.isSerialized),
    requiresPrescription: Boolean(data.requiresPrescription),
    requiresSerialTracking: Boolean(data.requiresSerialTracking),
    lotTracking: Boolean(data.lotTracking),
    expirationTracking: Boolean(data.expirationTracking),
    recallFlagged: Boolean(data.recallFlagged),
    notes: toSafeString(data.notes),
    deleted: Boolean(data.deleted),
  };
}