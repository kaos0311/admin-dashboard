import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import {
  executeScanMovementWithRetry,
  type ScanMovementRequest,
} from "./scanMovementRetry";

const REQUEST: ScanMovementRequest = {
  movementType: "rental_checkout",
  inventoryItemId: "inventory-1",
  productId: "product-1",
  barcode: "1234567890123",
  serialNumber: "SERIAL-1",
  lotNumber: "LOT-1",
  quantity: 1,
  reason: "Scanned out for rental.",
  source: "scanner",
  metadata: {
    rawCode: "1234567890123",
    direction: "out",
    outReason: "rental",
  },
};

const SUCCESS: InventoryMovementResult = {
  status: "success",
  operationId: "inventory-scan-op-1",
  movementId: "movement-1",
  inventoryItemId: "inventory-1",
  quantityBefore: 4,
  quantityDelta: -1,
  quantityAfter: 3,
};

describe("inventory scan movement retry lifecycle", () => {
  it("reuses the exact operation ID and request after a retryable failure", async () => {
    const retryableError = Object.assign(
      new Error("Connection interrupted."),
      {
        code: "functions/unavailable",
      },
    );

    const attempts: InventoryMovementRequest[] = [];

    const execute = vi.fn(
      async (
        request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => {
        attempts.push(request);

        if (attempts.length === 1) {
          throw retryableError;
        }

        return SUCCESS;
      },
    );

    const result = await executeScanMovementWithRetry({
      request: REQUEST,
      operationId: "inventory-scan-op-1",
      execute,
      isRetryableError: () => true,
      shouldRetry: () => true,
    });

    expect(result).toEqual({
      status: "completed",
      movement: SUCCESS,
    });

    expect(execute).toHaveBeenCalledTimes(2);

    expect(attempts[0]).toEqual({
      ...REQUEST,
      operationId: "inventory-scan-op-1",
    });

    expect(attempts[1]).toEqual(attempts[0]);
  });

  it("stops without another movement attempt when retry is declined", async () => {
    const retryableError = Object.assign(
      new Error("Deadline exceeded."),
      {
        code: "functions/deadline-exceeded",
      },
    );

    const execute = vi.fn(
      async (): Promise<InventoryMovementResult> => {
        throw retryableError;
      },
    );

    const shouldRetry = vi.fn(() => false);

    const result = await executeScanMovementWithRetry({
      request: REQUEST,
      operationId: "inventory-scan-op-2",
      execute,
      isRetryableError: () => true,
      shouldRetry,
    });

    expect(result.status).toBe("retry_declined");
    expect(execute).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledOnce();
  });

  it("does not offer retry for a terminal error", async () => {
    const terminalError = Object.assign(
      new Error("Permission denied."),
      {
        code: "functions/permission-denied",
      },
    );

    const execute = vi.fn(
      async (): Promise<InventoryMovementResult> => {
        throw terminalError;
      },
    );

    const shouldRetry = vi.fn(() => true);

    await expect(
      executeScanMovementWithRetry({
        request: REQUEST,
        operationId: "inventory-scan-op-3",
        execute,
        isRetryableError: () => false,
        shouldRetry,
      }),
    ).rejects.toBe(terminalError);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("accepts duplicate_operation as a definitive completed result", async () => {
    const duplicate: InventoryMovementResult = {
      ...SUCCESS,
      status: "duplicate_operation",
    };

    const execute = vi.fn(async () => duplicate);

    const result = await executeScanMovementWithRetry({
      request: REQUEST,
      operationId: "inventory-scan-op-4",
      execute,
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    expect(result).toEqual({
      status: "completed",
      movement: duplicate,
    });

    expect(execute).toHaveBeenCalledOnce();
  });

  it("requires a non-empty operation ID", async () => {
    await expect(
      executeScanMovementWithRetry({
        request: REQUEST,
        operationId: "   ",
        execute: async () => SUCCESS,
        isRetryableError: () => false,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow(
      "Scan movement operation ID is required.",
    );
  });

  it("allows separate physical scans to use separate operation IDs", async () => {
    const operationIds: string[] = [];

    const execute = vi.fn(
      async (
        request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => {
        operationIds.push(request.operationId);

        return {
          ...SUCCESS,
          operationId: request.operationId,
        };
      },
    );

    await executeScanMovementWithRetry({
      request: REQUEST,
      operationId: "physical-scan-1",
      execute,
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    await executeScanMovementWithRetry({
      request: REQUEST,
      operationId: "physical-scan-2",
      execute,
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    expect(operationIds).toEqual([
      "physical-scan-1",
      "physical-scan-2",
    ]);
  });
});
