import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import {
  createArchiveRetryState,
  executeArchiveWithRetry,
  markArchiveOutcomeUncertain,
  type ArchiveMovementRequest,
} from "./archiveLifecycle";

const REQUEST: ArchiveMovementRequest = {
  movementType: "archived",
  inventoryItemId: "inventory-archive-1",
  productId: "product-1",
  barcode: "BARCODE-1",
  serialNumber: "SERIAL-1",
  lotNumber: "LOT-1",
  quantity: 1,
  reason: "Inventory record archived.",
  source: "inventory_page",
};

const SUCCESS: InventoryMovementResult = {
  status: "success",
  operationId: "inventory-archive-op-1",
  movementId: "movement-1",
  inventoryItemId: "inventory-archive-1",
  productId: "product-1",
  quantityBefore: 1,
  quantityDelta: 0,
  quantityAfter: 1,
};

describe("inventory archive retry lifecycle", () => {
  it("freezes the logical archive with one stable operation ID", () => {
    const mutableRequest = {
      ...REQUEST,
    };

    const state = createArchiveRetryState(
      mutableRequest,
      "  inventory-archive-op-1  ",
    );

    mutableRequest.productId = "changed-after-freeze";

    expect(state.operationId).toBe("inventory-archive-op-1");
    expect(state.request).toEqual(REQUEST);
    expect(state.outcomeUncertain).toBe(false);
    expect(Object.isFrozen(state.request)).toBe(true);
  });

  it("retries a retryable failure with the same operation ID and frozen request", async () => {
    const state = createArchiveRetryState(
      REQUEST,
      "inventory-archive-op-2",
    );

    const retryableError = new Error("response lost");
    const calls: InventoryMovementRequest[] = [];

    const execute = vi.fn(
      async (
        request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => {
        calls.push(request);

        if (calls.length === 1) {
          throw retryableError;
        }

        return {
          ...SUCCESS,
          operationId: request.operationId,
        };
      },
    );

    const shouldRetry = vi.fn(() => true);

    const result = await executeArchiveWithRetry({
      state,
      execute,
      isRetryableError: (error) => error === retryableError,
      shouldRetry,
    });

    expect(result.status).toBe("completed");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledOnce();

    expect(calls[0]).toEqual({
      ...REQUEST,
      operationId: "inventory-archive-op-2",
    });

    expect(calls[1]).toEqual(calls[0]);
  });

  it("returns retry_declined without creating a replacement operation", async () => {
    const state = createArchiveRetryState(
      REQUEST,
      "inventory-archive-op-3",
    );

    const retryableError = new Error("network timeout");

    const execute = vi.fn(async () => {
      throw retryableError;
    });

    const result = await executeArchiveWithRetry({
      state,
      execute,
      isRetryableError: () => true,
      shouldRetry: () => false,
    });

    expect(result).toEqual({
      status: "retry_declined",
      error: retryableError,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(state.operationId).toBe("inventory-archive-op-3");
  });

  it("marks an uncertain archive while preserving its operation and request", () => {
    const state = createArchiveRetryState(
      REQUEST,
      "inventory-archive-op-4",
    );

    const uncertain = markArchiveOutcomeUncertain(state);

    expect(uncertain.operationId).toBe(state.operationId);
    expect(uncertain.request).toBe(state.request);
    expect(uncertain.outcomeUncertain).toBe(true);
  });

  it("does not retry terminal failures", async () => {
    const state = createArchiveRetryState(
      REQUEST,
      "inventory-archive-op-5",
    );

    const terminalError = new Error("permission denied");
    const execute = vi.fn(async () => {
      throw terminalError;
    });

    const shouldRetry = vi.fn(() => true);

    await expect(
      executeArchiveWithRetry({
        state,
        execute,
        isRetryableError: () => false,
        shouldRetry,
      }),
    ).rejects.toBe(terminalError);

    expect(execute).toHaveBeenCalledOnce();
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("accepts duplicate_operation as a definitive completed result", async () => {
    const state = createArchiveRetryState(
      REQUEST,
      "inventory-archive-op-6",
    );

    const duplicate: InventoryMovementResult = {
      ...SUCCESS,
      status: "duplicate_operation",
      operationId: state.operationId,
    };

    const result = await executeArchiveWithRetry({
      state,
      execute: vi.fn(async () => duplicate),
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    expect(result).toEqual({
      status: "completed",
      movement: duplicate,
    });
  });
});
