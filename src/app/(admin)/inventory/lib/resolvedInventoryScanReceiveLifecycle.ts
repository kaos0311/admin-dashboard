import { normalizeBarcode } from "@/lib/barcode";
import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import type { InventoryItem } from "./inventoryTypes";
import { buildResolvedInventoryScanReceiveRequest } from "./scanMovementAuthority";
import {
  executeScanMovementWithRetry,
  type ScanMovementRequest,
  type ScanMovementRetryResult,
} from "./scanMovementRetry";

/**
 * Why a resolved-inventory Scan In is being executed.
 *
 * - `new_scan`: a completed physical scan event. It is always a new receive,
 *   even when an earlier attempt for the same barcode and inventory item is
 *   still pending.
 * - `retry`: the SAME scan attempt is re-sent because its previous outcome was
 *   uncertain. Only this intent may reuse an existing operation.
 */
export type ResolvedInventoryScanReceiveIntent = "new_scan" | "retry";

export type ResolvedInventoryScanReceiveState = {
  fingerprint: string;
  operationId: string;
  request: ScanMovementRequest;
  /**
   * True while this attempt's outcome is uncertain and the SAME attempt may be
   * retried with the same operationId. A new physical scan never reuses it.
   */
  outcomeUncertain: boolean;
};

/**
 * Prompt shown when a physical scan arrives while an uncertain attempt for the
 * same barcode and inventory item is still pending.
 *
 * Reusing the pending operation is the operator's explicit choice; the default
 * of declining is a new receive, never a silent reuse.
 */
export const RESOLVED_INVENTORY_SCAN_RETRY_PROMPT =
  "The previous scan for this item has an uncertain outcome. " +
  "The server may already have applied it.\n\n" +
  "Retry the SAME scan now using the same operation ID?\n\n" +
  "Choose Cancel to record this scan as a NEW receive with a new operation.";

export function buildResolvedInventoryScanReceiveFingerprint(params: {
  rawCode: string;
  inventoryItem: InventoryItem;
}): string {
  return JSON.stringify([
    normalizeBarcode(params.rawCode),
    params.inventoryItem.id,
  ]);
}

export function matchesResolvedInventoryScanReceiveFingerprint(params: {
  state: ResolvedInventoryScanReceiveState | null;
  rawCode: string;
  inventoryItem: InventoryItem;
}): boolean {
  if (params.state === null) {
    return false;
  }

  return (
    params.state.fingerprint ===
    buildResolvedInventoryScanReceiveFingerprint({
      rawCode: params.rawCode,
      inventoryItem: params.inventoryItem,
    })
  );
}

/**
 * Decide whether an incoming scan re-sends an uncertain attempt (retry) or is a
 * new completed physical scan event (new receive).
 *
 * A retry is never inferred from the fingerprint alone: the operator must
 * explicitly confirm reusing the pending operation.
 */
export function resolveResolvedInventoryScanReceiveIntent(params: {
  pendingState: ResolvedInventoryScanReceiveState | null;
  rawCode: string;
  inventoryItem: InventoryItem;
  confirmRetry: (message: string) => boolean;
}): ResolvedInventoryScanReceiveIntent {
  const pendingState = params.pendingState;

  const canRetry =
    pendingState !== null &&
    pendingState.outcomeUncertain &&
    matchesResolvedInventoryScanReceiveFingerprint({
      state: pendingState,
      rawCode: params.rawCode,
      inventoryItem: params.inventoryItem,
    });

  if (!canRetry) {
    return "new_scan";
  }

  return params.confirmRetry(RESOLVED_INVENTORY_SCAN_RETRY_PROMPT)
    ? "retry"
    : "new_scan";
}

/**
 * Reconcile the pending scan state against an explicit scan intent.
 *
 * A new physical scan always starts a new operation, so a repeated scan of the
 * same barcode and item is never swallowed as a duplicate of an earlier one.
 */
export function reconcileResolvedInventoryScanReceiveState(params: {
  current: ResolvedInventoryScanReceiveState | null;
  intent: ResolvedInventoryScanReceiveIntent;
  rawCode: string;
  inventoryItem: InventoryItem;
  createOperationId: () => string;
}): ResolvedInventoryScanReceiveState {
  const fingerprint = buildResolvedInventoryScanReceiveFingerprint({
    rawCode: params.rawCode,
    inventoryItem: params.inventoryItem,
  });

  if (
    params.intent === "retry" &&
    params.current !== null &&
    params.current.fingerprint === fingerprint &&
    params.current.outcomeUncertain
  ) {
    return params.current;
  }

  return {
    fingerprint,
    operationId: params.createOperationId(),
    request: buildResolvedInventoryScanReceiveRequest({
      rawCode: params.rawCode,
      inventoryItem: params.inventoryItem,
    }),
    outcomeUncertain: false,
  };
}

export function markResolvedInventoryScanReceiveOutcomeUncertain(
  state: ResolvedInventoryScanReceiveState,
): ResolvedInventoryScanReceiveState {
  return {
    ...state,
    outcomeUncertain: true,
  };
}

export async function executeResolvedInventoryScanReceiveWithRetry(params: {
  state: ResolvedInventoryScanReceiveState;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
}): Promise<ScanMovementRetryResult> {
  return executeScanMovementWithRetry({
    request: params.state.request,
    operationId: params.state.operationId,
    execute: params.execute,
    isRetryableError: params.isRetryableError,
    shouldRetry: params.shouldRetry,
  });
}
