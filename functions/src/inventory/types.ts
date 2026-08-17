/**
 * Shared types for the inventory barcode scanning API.
 *
 * These define the strict discriminated response contract between
 * the Cloud Function and the client.
 */

/** Fields the barcode scanner searches across. */
export type InventoryLookupMatchedField =
  | "barcode"
  | "serial"
  | "lotNumber"
  | "sku";

/** Item fields returned to the scanner page – no sensitive or internal data. */
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

/** A single match within a duplicate response. */
export interface InventoryLookupMatch {
  item: InventoryLookupItem;
  matchedFields: InventoryLookupMatchedField[];
}

/**
 * Discriminated union response from lookupInventoryByBarcode.
 */
export type InventoryLookupResult =
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

// ──────────────────────────────────────────────
// Receive Inventory types
// ──────────────────────────────────────────────

/**
 * Strict request contract for receiveInventoryByBarcode.
 *
 * operationId: client-generated UUID v4 for idempotent request deduplication.
 *   The server uses this to guarantee exactly-once processing.
 */
export interface ReceiveInventoryRequest {
  operationId: string;
  barcode: string;
  rawScan?: string;
  quantity: number;
  source: "tera_hid_scanner" | "manual_entry";
  locationId?: string;
  lotNumber?: string;
  serial?: string;
  expirationDate?: string;
  note?: string;
}

/**
 * Success payload for a receive transaction.
 */
export interface ReceiveInventorySuccess {
  status: "success";
  transactionId: string;
  inventoryItemId: string;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
}

/**
 * Not-found payload.
 */
export interface ReceiveInventoryNotFound {
  status: "not_found";
  normalizedBarcode: string;
}

/**
 * Duplicate-match payload.
 */
export interface ReceiveInventoryDuplicate {
  status: "duplicate";
  normalizedBarcode: string;
  matches: InventoryLookupMatch[];
}

/**
 * Discriminated union response from receiveInventoryByBarcode.
 */
export type ReceiveInventoryResult =
  | ReceiveInventorySuccess
  | ReceiveInventoryNotFound
  | ReceiveInventoryDuplicate;

// ──────────────────────────────────────────────
// Scanned inventory intake
// ──────────────────────────────────────────────

export type ReceiveScannedInventoryIntakeMode = "product-match" | "pending-scan";

export interface ReceiveScannedInventoryIntakeInput {
  operationId: string;
  mode: ReceiveScannedInventoryIntakeMode;
  rawScan: string;
  normalizedScan: string;
  quantity: number;
  locationId?: string;
  productId?: string;
}

export interface ReceiveScannedInventoryIntakeResult {
  status: "success";
  inventoryItemId: string;
  movementId: string;
  quantityBefore: number;
  quantityChange: number;
  quantityAfter: number;
  createdOrMerged: "created" | "merged";
  mode: ReceiveScannedInventoryIntakeMode;
}

// ──────────────────────────────────────────────
// Manual inventory metadata upsert
// ──────────────────────────────────────────────

export interface ManualInventoryUpsertInput {
  operationId: string;
  inventoryItemId?: string;
  productId?: string;
  name: string;
  category: string;
  manufacturer?: string;
  manufacturerItemId?: string;
  sku?: string;
  hcpc?: string;
  barcode?: string;
  serial?: string;
  lotNumber?: string;
  expirationDate?: string;
  locationName?: string;
  binLocation?: string;
  reorderLevel?: number;
  unitCost?: number;
  notes?: string;
  source?: string;
  sourceId?: string;
}

export interface ManualInventoryUpsertMatch {
  inventoryItemId: string;
  matchedBy: string[];
  name: string;
  barcode: string;
  serial: string;
  lotNumber: string;
  sku: string;
}

export type ManualInventoryUpsertResult =
  | {
      status: "created";
      inventoryItemId: string;
    }
  | {
      status: "merged";
      inventoryItemId: string;
    }
  | {
      status: "duplicate_operation";
      action: "created" | "merged";
      inventoryItemId: string;
    }
  | {
      status: "ambiguous";
      matches: ManualInventoryUpsertMatch[];
    };
