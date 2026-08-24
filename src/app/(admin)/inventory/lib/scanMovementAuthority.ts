import { normalizeBarcode } from "@/lib/barcode";
import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";
import type {
  ClientInventoryScanResult,
} from "@/services/inventory/inventory-scan-adapter";
import type { InventoryItem } from "./inventoryTypes";

import {
  executeScanMovementWithRetry,
  type ScanMovementRequest,
} from "./scanMovementRetry";

export type ScanMovementDirection = "in" | "out";
export type ScanOutReason = "rental" | "purchase" | "maintenance";

export type ScanMovementAuthorityResult =
  | {
      status: "movement_completed";
      movement: InventoryMovementResult;
      inventoryItem: InventoryItem | null;
      enrichmentError?: unknown;
    }
  | {
      status: "retry_declined";
    }
  | {
      status: "intake_fallback";
      movement: InventoryMovementResult;
      scanResolution: ClientInventoryScanResult;
    }
  | {
      status: "movement_failed";
      movement: InventoryMovementResult;
    };

export function buildCanonicalScanMovementRequest(params: {
  rawCode: string;
  direction: ScanMovementDirection;
  outReason?: ScanOutReason;
}): ScanMovementRequest {
  return {
    movementType:
      params.direction === "in"
        ? "receive"
        : params.outReason === "rental"
          ? "rental_checkout"
          : "patient_assignment",
    barcode: normalizeBarcode(params.rawCode),
    quantity: 1,
    reason:
      params.direction === "in"
        ? "Scanned into inventory."
        : `Scanned out for ${params.outReason ?? "issue"}.`,
    source: "scanner",
    metadata: {
      rawCode: params.rawCode,
      direction: params.direction,
      outReason: params.outReason ?? "",
    },
  };
}

export async function runCanonicalScanMovement(params: {
  rawCode: string;
  direction: ScanMovementDirection;
  outReason?: ScanOutReason;
  operationId: string;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
  resolveIntake: (rawCode: string) => Promise<ClientInventoryScanResult>;
  fetchInventoryById: (inventoryItemId: string) => Promise<InventoryItem | null>;
}): Promise<ScanMovementAuthorityResult> {
  const execution = await executeScanMovementWithRetry({
    request: buildCanonicalScanMovementRequest(params),
    operationId: params.operationId,
    execute: params.execute,
    isRetryableError: params.isRetryableError,
    shouldRetry: params.shouldRetry,
  });

  if (execution.status === "retry_declined") {
    return { status: "retry_declined" };
  }

  const { movement } = execution;

  if (
    movement.status === "success" ||
    movement.status === "duplicate_operation"
  ) {
    if (!movement.inventoryItemId) {
      return {
        status: "movement_completed",
        movement,
        inventoryItem: null,
      };
    }

    try {
      const inventoryItem = await params.fetchInventoryById(
        movement.inventoryItemId,
      );

      return {
        status: "movement_completed",
        movement,
        inventoryItem,
      };
    } catch (error: unknown) {
      return {
        status: "movement_completed",
        movement,
        inventoryItem: null,
        enrichmentError: error,
      };
    }
  }

  if (params.direction === "in" && movement.status === "not_found") {
    return {
      status: "intake_fallback",
      movement,
      scanResolution: await params.resolveIntake(params.rawCode),
    };
  }

  return {
    status: "movement_failed",
    movement,
  };
}
