"use client";

import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  adaptInventoryLookupResponse,
  type BarcodeLookupResult,
  getMatchedFieldLabel,
  type InventoryLookupItem,
  type InventoryLookupMatch,
  type InventoryLookupMatchedField,
  MATCHED_FIELD_LABELS,
} from "@/services/inventory/inventory-scan-adapter";

export {
  getMatchedFieldLabel,
  MATCHED_FIELD_LABELS,
  type BarcodeLookupResult,
  type InventoryLookupItem,
  type InventoryLookupMatch,
  type InventoryLookupMatchedField,
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

export function requireInventoryTransactionOperationId(
  operationId: string | undefined,
): string {
  const normalized = operationId?.trim();

  if (!normalized) {
    throw new Error("Scanner transaction operationId is required.");
  }

  return normalized;
}

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

        const adapted = adaptInventoryLookupResponse(data);
        if (!adapted) {
          setError("Invalid server response.");
          return null;
        }

        return adapted;
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
      const operationId = requireInventoryTransactionOperationId(
        params.operationId,
      );

      setLoading(true);
      setError(null);

      const functionName = `${transactionType}InventoryByBarcode`;

      try {
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
