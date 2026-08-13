"use client";

import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { createInventoryOperationId } from "@/lib/inventory/movements";
/**
 * Fields the barcode scanner searches across.
 */
export type InventoryLookupMatchedField =
  | "barcode"
  | "serial"
  | "lotNumber"
  | "sku";

/**
 * A single inventory item returned by the lookup function.
 * Only fields required by the scanner page are included.
 */
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
 *
 * - found:      exactly one inventory document matched.
 * - not_found:  zero matches across all searched fields.
 * - duplicate:  two or more distinct inventory documents matched.
 */
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

/** Raw Firebase response type (before status parsing). */
interface RawLookupResponse {
  status: string;
  [key: string]: unknown;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  inventoryItemId: string | null;
  productName: string | null;
  quantityBefore: number | null;
  quantityChange: number | null;
  quantityAfter: number | null;
  status: string;
  message?: string;
  errorCode?: string;
  retryable?: boolean;
}

type TransactionType = "receive" | "issue" | "cycle_count" | "transfer";

const RETRYABLE_INVENTORY_TRANSACTION_CODES = new Set([
  "unavailable",
  "deadline-exceeded",
  "cancelled",
  "aborted",
  "resource-exhausted",
]);

export function getInventoryTransactionErrorCode(
  error: unknown,
): string {
  if (!error || typeof error !== "object") {
    return "unknown";
  }

  const rawCode = (error as { code?: unknown }).code;

  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return "unknown";
  }

  const normalized = rawCode.trim().toLowerCase();

  return normalized.startsWith("functions/")
    ? normalized.slice("functions/".length)
    : normalized;
}

export function isRetryableInventoryTransactionError(
  error: unknown,
): boolean {
  return RETRYABLE_INVENTORY_TRANSACTION_CODES.has(
    getInventoryTransactionErrorCode(error),
  );
}

/** Human-readable labels for matched fields. */
export const MATCHED_FIELD_LABELS: Record<InventoryLookupMatchedField, string> = {
  barcode: "Barcode",
  serial: "Serial Number",
  lotNumber: "Lot Number",
  sku: "SKU",
};

function getMatchedFieldLabel(field: InventoryLookupMatchedField): string {
  return MATCHED_FIELD_LABELS[field];
}

export { getMatchedFieldLabel };

/**
 * Hook for barcode-based inventory lookup and transactions.
 */
export function useInventoryLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByBarcode = useCallback(
    async (barcode: string): Promise<BarcodeLookupResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const fn = httpsCallable<{ barcode: string }, RawLookupResponse>(
          functions,
          "lookupInventoryByBarcode",
        );
        const result = await fn({ barcode });
        const data = result.data;

        // Validate the response has an expected status
        if (!data || typeof data.status !== "string") {
          setError("Invalid server response.");
          return null;
        }

        // Cast to the discriminated union based on status field
        switch (data.status) {
          case "found":
          case "not_found":
          case "duplicate":
            return data as unknown as BarcodeLookupResult;
          default:
            setError(`Unexpected lookup status: ${data.status}`);
            return null;
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Lookup failed.";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const executeTransaction = useCallback(
    async (
      transactionType: TransactionType,
      params: {
        barcode: string;
        operationId?: string;
        quantity?: number;
        toLocation?: string;
        source?: "tera_hid_scanner" | "manual_entry";
        rawScan?: string | null;
      },
    ): Promise<TransactionResult> => {
      setLoading(true);
      setError(null);

      const functionName = `${transactionType}InventoryByBarcode`;

      try {
        const operationId =
          params.operationId ??
          createInventoryOperationId(`legacy-${transactionType}`);

        const fn = httpsCallable<Record<string, unknown>, TransactionResult>(
          functions,
          functionName,
        );
        const result = await fn({
          barcode: params.barcode,
          operationId,
          quantity: params.quantity,
          toLocation: params.toLocation,
          source: params.source ?? "manual_entry",
          rawScan: params.rawScan ?? null,
        });
        return result.data;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Transaction failed.";

        const errorCode = getInventoryTransactionErrorCode(err);
        const retryable = isRetryableInventoryTransactionError(err);
        setError(message);
        return {
          success: false,
          transactionId: "",
          inventoryItemId: null,
          productName: null,
          quantityBefore: null,
          quantityChange: null,
          quantityAfter: null,
          status: "failed",
          message,
          errorCode,
          retryable,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return {
    lookupByBarcode,
    executeTransaction,
    loading,
    error,
    reset,
  };
}
