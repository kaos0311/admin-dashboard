import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import {
  createHardDeleteRetryState,
  executeHardDeleteWithRetry,
  markHardDeleteOutcomeUncertain,
  type HardDeleteMovementRequest,
} from "./hardDeleteLifecycle";

const REQUEST: HardDeleteMovementRequest = {
  movementType: "hard_delete",
  inventoryItemId: "inventory-hard-1",
  productId: "product-hard-1",
  barcode: "HARD-DELETE-001",
  serialNumber: "SERIAL-HARD-001",
  lotNumber: "LOT-HARD-001",
  quantity: 1,
  reason: "Inventory record permanently deleted.",
  source: "inventory_page",
};

const SUCCESS: InventoryMovementResult = {
  status: "success",
  operationId: "inventory-hard-delete-op-1",
  movementId: "movement-hard-1",
  inventoryItemId: "inventory-hard-1",
};

describe("hard delete lifecycle", () => {
  it("freezes one logical delete with a stable operation ID", () => {
    const mutableRequest = { ...REQUEST };

    const state = createHardDeleteRetryState(
      mutableRequest,
      " inventory-hard-delete-op-1 ",
    );

    mutableRequest.productId = "changed-after-freeze";

    expect(state.operationId).toBe("inventory-hard-delete-op-1");
    expect(state.request).toEqual(REQUEST);
    expect(state.outcomeUncertain).toBe(false);
    expect(Object.isFrozen(state.request)).toBe(true);
  });

  it("retries a retryable failure with the same operation ID and request", async () => {
    const state = createHardDeleteRetryState(
      REQUEST,
      "inventory-hard-delete-op-2",
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

    const result = await executeHardDeleteWithRetry({
      state,
      execute,
      isRetryableError: (error) => error === retryableError,
      shouldRetry,
    });

    expect(result.status).toBe("completed");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledTimes(1);

    expect(calls[0]).toEqual({
      ...REQUEST,
      operationId: "inventory-hard-delete-op-2",
    });

    expect(calls[1]).toEqual(calls[0]);
  });

  it("returns retry_declined without generating a replacement operation", async () => {
    const state = createHardDeleteRetryState(
      REQUEST,
      "inventory-hard-delete-op-3",
    );

    const retryableError = new Error("network timeout");

    const execute = vi.fn(async () => {
      throw retryableError;
    });

    const result = await executeHardDeleteWithRetry({
      state,
      execute,
      isRetryableError: () => true,
      shouldRetry: () => false,
    });

    expect(result).toEqual({
      status: "retry_declined",
      error: retryableError,
    });

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("marks an uncertain delete while preserving its operation and frozen request", () => {
    const state = createHardDeleteRetryState(
      REQUEST,
      "inventory-hard-delete-op-4",
    );

    const uncertain = markHardDeleteOutcomeUncertain(state);

    expect(uncertain.outcomeUncertain).toBe(true);
    expect(uncertain.operationId).toBe(state.operationId);
    expect(uncertain.request).toBe(state.request);
  });

  it("does not retry a terminal error", async () => {
    const state = createHardDeleteRetryState(
      REQUEST,
      "inventory-hard-delete-op-5",
    );

    const terminalError = new Error("permission denied");
    const execute = vi.fn(async () => {
      throw terminalError;
    });
    const shouldRetry = vi.fn(() => true);

    await expect(
      executeHardDeleteWithRetry({
        state,
        execute,
        isRetryableError: () => false,
        shouldRetry,
      }),
    ).rejects.toBe(terminalError);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("accepts duplicate_operation as a definitive completed response", async () => {
    const state = createHardDeleteRetryState(
      REQUEST,
      "inventory-hard-delete-op-6",
    );

    const duplicate: InventoryMovementResult = {
      ...SUCCESS,
      status: "duplicate_operation",
      operationId: state.operationId,
    };

    const result = await executeHardDeleteWithRetry({
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