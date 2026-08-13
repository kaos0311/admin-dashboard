import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import {
  createDiscontinueRetryState,
  executeDiscontinueWithRetry,
  markDiscontinueOutcomeUncertain,
  type DiscontinueMovementRequest,
} from "./discontinueLifecycle";

const REQUEST: DiscontinueMovementRequest = {
  movementType: "discontinued",
  inventoryItemId: "inventory-discontinue-1",
  productId: "product-1",
  barcode: "BARCODE-1",
  serialNumber: "SERIAL-1",
  lotNumber: "LOT-1",
  quantity: 1,
  reason: "Inventory item discontinued.",
  source: "inventory_page",
};

const SUCCESS: InventoryMovementResult = {
  status: "success",
  operationId: "inventory-discontinue-op-1",
  movementId: "movement-1",
  inventoryItemId: "inventory-discontinue-1",
  productId: "product-1",
  quantityBefore: 1,
  quantityDelta: 0,
  quantityAfter: 1,
};

describe("inventory discontinue retry lifecycle", () => {
  it("freezes the logical discontinue with one stable operation ID", () => {
    const mutableRequest = {
      ...REQUEST,
    };

    const state = createDiscontinueRetryState(
      mutableRequest,
      "  inventory-discontinue-op-1  ",
    );

    mutableRequest.productId = "changed-after-freeze";

    expect(state.operationId).toBe("inventory-discontinue-op-1");
    expect(state.request).toEqual(REQUEST);
    expect(state.outcomeUncertain).toBe(false);
    expect(Object.isFrozen(state.request)).toBe(true);
  });

  it("retries a retryable failure with the same operation ID and frozen request", async () => {
    const state = createDiscontinueRetryState(
      REQUEST,
      "inventory-discontinue-op-2",
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

    const result = await executeDiscontinueWithRetry({
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
      operationId: "inventory-discontinue-op-2",
    });

    expect(calls[1]).toEqual(calls[0]);
  });

  it("returns retry_declined without creating a replacement operation", async () => {
    const state = createDiscontinueRetryState(
      REQUEST,
      "inventory-discontinue-op-3",
    );

    const retryableError = new Error("network timeout");

    const execute = vi.fn(async () => {
      throw retryableError;
    });

    const result = await executeDiscontinueWithRetry({
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
    expect(state.operationId).toBe("inventory-discontinue-op-3");
  });

  it("marks an uncertain discontinue while preserving its operation and request", () => {
    const state = createDiscontinueRetryState(
      REQUEST,
      "inventory-discontinue-op-4",
    );

    const uncertain = markDiscontinueOutcomeUncertain(state);

    expect(uncertain.operationId).toBe(state.operationId);
    expect(uncertain.request).toBe(state.request);
    expect(uncertain.outcomeUncertain).toBe(true);
  });

  it("does not retry terminal failures", async () => {
    const state = createDiscontinueRetryState(
      REQUEST,
      "inventory-discontinue-op-5",
    );

    const terminalError = new Error("permission denied");
    const execute = vi.fn(async () => {
      throw terminalError;
    });

    const shouldRetry = vi.fn(() => true);

    await expect(
      executeDiscontinueWithRetry({
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
    const state = createDiscontinueRetryState(
      REQUEST,
      "inventory-discontinue-op-6",
    );

    const duplicate: InventoryMovementResult = {
      ...SUCCESS,
      status: "duplicate_operation",
      operationId: state.operationId,
    };

    const result = await executeDiscontinueWithRetry({
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
