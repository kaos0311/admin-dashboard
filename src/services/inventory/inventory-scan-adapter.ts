import { normalizeBarcode } from "@/lib/barcode";
import { InventoryRepository } from "@/repositories/firestore/inventory.repository";
import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";
import type { ProductDocument } from "@/repositories/firestore/inventory.types";

export type InventoryScanField =
  | "barcode"
  | "serial"
  | "lotNumber"
  | "sku"
  | "hcpc";

export type ProductScanField =
  | "productId"
  | "upc"
  | "sku"
  | "hcpcs"
  | "manufacturerItemId";

export type InventoryScanIdentification =
  | {
      ok: true;
      product: {
        name?: string;
        category?: string;
        sku?: string;
        barcode?: string;
        manufacturer?: string;
        modelNumber?: string;
      };
    }
  | {
      ok: false;
      error?: string;
    };

export type InventoryScanIdentifyFn = (
  normalizedScan: string,
) => Promise<InventoryScanIdentification>;

export type ClientInventoryScanResult =
  | {
      kind: "inventory";
      normalizedScan: string;
      matchedBy: InventoryScanField;
      item: InventoryItem;
    }
  | {
      kind: "product_suggestion";
      normalizedScan: string;
      matchedBy: ProductScanField;
      product: ProductDocument;
    }
  | {
      kind: "identified_product";
      normalizedScan: string;
      identification: Extract<InventoryScanIdentification, { ok: true }>;
    }
  | {
      kind: "not_found";
      normalizedScan: string;
    };

export type InventoryLookupMatchedField =
  | "barcode"
  | "serial"
  | "lotNumber"
  | "sku";

export interface InventoryLookupItem {
  id: string;
  name: string;
  category: string;
  barcode: string;
  sku: string;
  serial: string;
  lotNumber: string;
  quantityOnHand: number;
  available: number;
  status: string;
  manufacturer: string;
  locationName: string;
  lifecycleStatus: string;
}

export interface InventoryLookupMatch {
  item: InventoryLookupItem;
  matchedFields: InventoryLookupMatchedField[];
}

export type BarcodeLookupResult =
  | {
      status: "found";
      item: InventoryLookupItem;
      matchedFields: InventoryLookupMatchedField[];
    }
  | {
      status: "not_found";
      normalizedBarcode: string;
    }
  | {
      status: "duplicate";
      normalizedBarcode: string;
      matches: InventoryLookupMatch[];
    };

/**
 * Read-only client scan assistance for intake and presentation.
 *
 * This adapter is not authoritative inventory mutation resolution. Existing
 * inventory scan movements must send scan context to the movement callable and
 * let the backend resolver choose the canonical inventoryItemId.
 */
export const MATCHED_FIELD_LABELS: Record<InventoryLookupMatchedField, string> = {
  barcode: "Barcode",
  serial: "Serial Number",
  lotNumber: "Lot Number",
  sku: "SKU",
};

export function getMatchedFieldLabel(field: InventoryLookupMatchedField): string {
  return MATCHED_FIELD_LABELS[field];
}

export function adaptInventoryLookupResponse(
  data: Record<string, unknown> | null | undefined,
): BarcodeLookupResult | null {
  if (!data || typeof data.status !== "string") {
    return null;
  }

  switch (data.status) {
    case "found":
    case "not_found":
    case "duplicate":
      return data as BarcodeLookupResult;
    default:
      return null;
  }
}

function normalizeMatchValue(value: unknown): string {
  return String(value ?? "").trim();
}

function inferInventoryMatchField(
  item: InventoryItem,
  normalizedScan: string,
): InventoryScanField {
  if (item.barcode === normalizedScan) return "barcode";
  if (item.serial === normalizedScan) return "serial";
  if (item.lotNumber === normalizedScan) return "lotNumber";
  if (item.sku === normalizedScan) return "sku";
  if (item.hcpc === normalizedScan.toUpperCase()) return "hcpc";

  return "sku";
}

function inferProductMatchField(
  product: ProductDocument,
  normalizedScan: string,
): ProductScanField {
  if (product.id === normalizedScan) return "productId";
  if (normalizeMatchValue(product.upc) === normalizedScan) return "upc";
  if (normalizeMatchValue(product.sku) === normalizedScan) return "sku";
  if (normalizeMatchValue(product.hcpcs).toUpperCase() === normalizedScan.toUpperCase()) {
    return "hcpcs";
  }
  if (normalizeMatchValue(product.manufacturerItemId) === normalizedScan) {
    return "manufacturerItemId";
  }

  return "sku";
}

export async function resolveInventoryScanForIntake(params: {
  rawCode: string;
  identify?: InventoryScanIdentifyFn;
}): Promise<ClientInventoryScanResult> {
  const normalizedScan = normalizeBarcode(params.rawCode);
  if (!normalizedScan) {
    return {
      kind: "not_found",
      normalizedScan,
    };
  }

  const inventoryItem = await InventoryRepository.findByScan(params.rawCode);
  if (inventoryItem) {
    return {
      kind: "inventory",
      normalizedScan,
      matchedBy: inferInventoryMatchField(inventoryItem, normalizedScan),
      item: inventoryItem,
    };
  }

  const product = await InventoryRepository.findProductByScan(params.rawCode);
  if (product) {
    return {
      kind: "product_suggestion",
      normalizedScan,
      matchedBy: inferProductMatchField(product, normalizedScan),
      product,
    };
  }

  if (params.identify) {
    const identification = await params.identify(normalizedScan);
    if (identification.ok && identification.product) {
      return {
        kind: "identified_product",
        normalizedScan,
        identification,
      };
    }
  }

  return {
    kind: "not_found",
    normalizedScan,
  };
}
