import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  type InventoryScanField,
  resolveInventoryScan,
} from "./inventoryScanResolver.js";

/**
 * Supported inventory transaction types.
 */
export type InventoryTransactionType =
  | "lookup"
  | "receive"
  | "issue"
  | "cycle_count"
  | "transfer";

/**
 * Input for an inventory transaction.
 */
export interface InventoryTransactionInput {
  transactionType: InventoryTransactionType;
  barcode: string;
  normalizedBarcode: string;
  inventoryItemId: string | null;
  quantityChange: number | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  performedByUid: string;
  performedByEmail: string;
  source: "tera_hid_scanner" | "manual_entry";
  rawScan: string | null;
}

/**
 * Result of an inventory transaction.
 */
export interface InventoryTransactionResult {
  success: boolean;
  transactionId: string;
  inventoryItemId: string | null;
  productName: string | null;
  quantityBefore: number | null;
  quantityChange: number | null;
  quantityAfter: number | null;
  status: "success" | "not_found" | "duplicate" | "failed";
  failureReason: string | null;
}

const COMPATIBILITY_SCAN_FIELDS: InventoryScanField[] = [
  "barcode",
  "serial",
  "lotNumber",
  "sku",
];

/**
 * Resolve an inventory item server-side by barcode.
 * Searches barcode, serial, lotNumber, sku fields.
 */
export async function resolveInventoryItemScan(
  db: Firestore,
  normalizedBarcode: string
): Promise<
  | { status: "found"; id: string; data: Record<string, unknown> }
  | { status: "not_found" }
  | { status: "ambiguous"; candidateIds: string[] }
> {
  const resolved = await resolveInventoryScan(db, normalizedBarcode, {
    fields: COMPATIBILITY_SCAN_FIELDS,
    includeUppercaseVariant: false,
  });

  if (resolved.kind === "not_found") {
    return { status: "not_found" };
  }
  if (resolved.kind === "ambiguous") {
    return { status: "ambiguous", candidateIds: resolved.candidateIds };
  }

  return {
    status: "found",
    id: resolved.inventoryItemId,
    data: resolved.inventory,
  };
}

export async function resolveInventoryItem(
  db: Firestore,
  normalizedBarcode: string
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const resolved = await resolveInventoryItemScan(db, normalizedBarcode);
  if (resolved.status !== "found") return null;
  return { id: resolved.id, data: resolved.data };
}

/**
 * Write an immutable inventory transaction record.
 */
export async function writeInventoryTransaction(
  db: Firestore,
  input: InventoryTransactionInput,
  result: InventoryTransactionResult
): Promise<string> {
  const ref = await db.collection("inventoryTransactions").add({
    transactionType: input.transactionType,
    barcode: input.barcode,
    normalizedBarcode: input.normalizedBarcode,
    inventoryItemId: result.inventoryItemId,
    productName: result.productName,
    quantityBefore: result.quantityBefore,
    quantityChange: result.quantityChange,
    quantityAfter: result.quantityAfter,
    fromLocationId: input.fromLocationId ?? null,
    toLocationId: input.toLocationId ?? null,
    performedByUid: input.performedByUid,
    performedByEmail: input.performedByEmail,
    timestamp: FieldValue.serverTimestamp(),
    status: result.status,
    failureReason: result.failureReason,
    source: input.source,
    rawScan: input.rawScan,
  });

  return ref.id;
}

/**
 * Perform inventory mutation with server-side validation.
 * Uses Firestore transaction for concurrency safety.
 */
export async function mutateInventory(
  db: Firestore,
  inventoryItemId: string,
  quantityChange: number,
  allowNegative: boolean
): Promise<{
  quantityBefore: number;
  quantityAfter: number;
  productName: string;
}> {
  void db;
  void inventoryItemId;
  void quantityChange;
  void allowNegative;
  throw new HttpsError(
    "failed-precondition",
    "mutateInventory is disabled. Use createInventoryMovement from movementService."
  );
}
