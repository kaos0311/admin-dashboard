/**
 * Strict shared types for the Receive Inventory by Barcode flow.
 */

/** Fields the barcode scanner searches across. */
export type InventoryLookupMatchedField =
  | "barcode"
  | "serial"
  | "lotNumber"
  | "sku";

/** A single inventory item returned by the lookup function. */
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

// ──────────────────────────────────────────────
// Receive Inventory
// ──────────────────────────────────────────────

/**
 * Strict request contract for receiveInventoryByBarcode.
 *
 * operationId: client-generated UUID v4 for idempotent request deduplication.
 *   Generated once when the user confirms the receive operation.
 *   Retained across automatic retries of the same submission.
 *   Cleared after a definitive discriminated response is received.
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
// Callable Response Wrapper
// ──────────────────────────────────────────────

/**
 * Wrapper that separates callable-level errors from business-logic responses.
 *
 * - ok === true:  the callable completed normally; data is a ReceiveInventoryResult
 *   with one of the discriminated status values (success / not_found / duplicate).
 * - ok === false: the callable itself threw an HttpsError; use the code and
 *   message fields for user-facing error display.
 */
export interface ReceiveInventoryCallableSuccess {
  ok: true;
  data: ReceiveInventoryResult;
}

export interface ReceiveInventoryCallableError {
  ok: false;
  code: string;
  message: string;
}

export type ReceiveInventoryResponse =
  | ReceiveInventoryCallableSuccess
  | ReceiveInventoryCallableError;
