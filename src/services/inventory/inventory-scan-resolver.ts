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

export type InventoryScanResolution =
  | {
      status: "existing-inventory";
      normalizedScan: string;
      matchedBy: InventoryScanField;
      item: InventoryItem;
    }
  | {
      status: "existing-product";
      normalizedScan: string;
      matchedBy: ProductScanField;
      product: ProductDocument;
    }
  | {
      status: "identified-product";
      normalizedScan: string;
      identification: Extract<InventoryScanIdentification, { ok: true }>;
    }
  | {
      status: "unresolved";
      normalizedScan: string;
    };

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

export async function resolveInventoryScan(params: {
  rawCode: string;
  identify?: InventoryScanIdentifyFn;
}): Promise<InventoryScanResolution> {
  const normalizedScan = normalizeBarcode(params.rawCode);
  if (!normalizedScan) {
    return {
      status: "unresolved",
      normalizedScan,
    };
  }

  const inventoryItem = await InventoryRepository.findByScan(params.rawCode);
  if (inventoryItem) {
    return {
      status: "existing-inventory",
      normalizedScan,
      matchedBy: inferInventoryMatchField(inventoryItem, normalizedScan),
      item: inventoryItem,
    };
  }

  const product = await InventoryRepository.findProductByScan(params.rawCode);
  if (product) {
    return {
      status: "existing-product",
      normalizedScan,
      matchedBy: inferProductMatchField(product, normalizedScan),
      product,
    };
  }

  if (params.identify) {
    const identification = await params.identify(normalizedScan);
    if (identification.ok && identification.product) {
      return {
        status: "identified-product",
        normalizedScan,
        identification,
      };
    }
  }

  return {
    status: "unresolved",
    normalizedScan,
  };
}
