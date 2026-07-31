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
