import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import type { InventoryItem } from "./inventoryTypes";
import {
  executeResolvedInventoryScanReceiveWithRetry,
  markResolvedInventoryScanReceiveOutcomeUncertain,
  reconcileResolvedInventoryScanReceiveState,
  RESOLVED_INVENTORY_SCAN_RETRY_PROMPT,
  type ResolvedInventoryScanReceiveState,
  resolveResolvedInventoryScanReceiveIntent,
} from "./resolvedInventoryScanReceiveLifecycle";

const INVENTORY_ITEM: InventoryItem = {
  id: "inventory-1",
  productId: "product-1",
  name: "Existing Item",
  category: "Supplies",
  sku: "SKU-1",
  hcpc: "",
  barcode: "ABC123",
  serial: "",
  lotNumber: "",
  locationName: "Main Location",
  binLocation: "",
  quantityOnHand: 4,
  committed: 0,
  onRent: 0,
  onOrder: 0,
  available: 4,
  reorderLevel: 0,
  unitCost: 0,
  totalValue: 0,
  status: "available",
  manufacturer: "",
  manufacturerItemId: "",
  modelNumber: "",
  warrantyProvider: "",
  warrantyStartDate: "",
  warrantyEndDate: "",
  warrantyNotes: "",
  purchaseDate: "",
  usefulLifeMonths: 0,
  lifecycleStatus: "active",
  nextServiceDate: "",
  lifecycleNotes: "",
  notes: "",
  searchText: "",
  isDeleted: false,
};

const OTHER_INVENTORY_ITEM: InventoryItem = {
  ...INVENTORY_ITEM,
  id: "inventory-2",
  productId: "product-2",
  name: "Other Item",
  sku: "SKU-2",
  barcode: "XYZ789",
};

function success(
  request: InventoryMovementRequest,
): InventoryMovementResult {
  return {
    status: "success",
    operationId: request.operationId,
    movementId: `movement-${request.operationId}`,
    inventoryItemId: request.inventoryItemId,
    quantityBefore: 4,
    quantityDelta: 1,
    quantityAfter: 5,
  };
}

function reconcileNewScan(params: {
  current: ResolvedInventoryScanReceiveState | null;
  rawCode: string;
  inventoryItem: InventoryItem;
  createOperationId: () => string;
}): ResolvedInventoryScanReceiveState {
  return reconcileResolvedInventoryScanReceiveState({
    current: params.current,
    intent: "new_scan",
    rawCode: params.rawCode,
    inventoryItem: params.inventoryItem,
    createOperationId: params.createOperationId,
  });
}

describe("resolved inventory scan receive lifecycle", () => {
  it("uses one operation ID for a successful resolved-inventory fallback", async () => {
    const createOperationId = vi.fn(() => "resolved-op-1");
    const state = reconcileNewScan({
      current: null,
      rawCode: " ABC123 ",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    const execute = vi.fn(async (request: InventoryMovementRequest) =>
      success(request),
    );

    const result = await executeResolvedInventoryScanReceiveWithRetry({
      state,
      execute,
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    expect(result.status).toBe("completed");
    expect(createOperationId).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "resolved-op-1",
        inventoryItemId: "inventory-1",
        barcode: "ABC123",
      }),
    );
  });

  it("reuses the pending operation only for an explicit retry of the same uncertain attempt", () => {
    const createOperationId = vi.fn(() => "resolved-op-1");

    const pendingState = reconcileNewScan({
      current: null,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    const uncertainState =
      markResolvedInventoryScanReceiveOutcomeUncertain(pendingState);

    const retryState = reconcileResolvedInventoryScanReceiveState({
      current: uncertainState,
      intent: "retry",
      rawCode: " ABC123 ",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    expect(retryState).toBe(uncertainState);
    expect(retryState.operationId).toBe("resolved-op-1");
    expect(retryState.outcomeUncertain).toBe(true);
    expect(createOperationId).toHaveBeenCalledOnce();
  });

  it("starts a new operation for a new physical scan of the same barcode and item", () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce("resolved-op-1")
      .mockReturnValueOnce("resolved-op-2");

    const pendingState = reconcileNewScan({
      current: null,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    const uncertainState =
      markResolvedInventoryScanReceiveOutcomeUncertain(pendingState);

    const nextState = reconcileNewScan({
      current: uncertainState,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    expect(pendingState.operationId).toBe("resolved-op-1");
    expect(nextState.operationId).toBe("resolved-op-2");
    expect(nextState).not.toBe(uncertainState);
    expect(nextState.outcomeUncertain).toBe(false);
    expect(createOperationId).toHaveBeenCalledTimes(2);
  });

  it("starts a new operation when a retry targets a different scan", () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce("resolved-op-1")
      .mockReturnValueOnce("resolved-op-2");

    const uncertainState = markResolvedInventoryScanReceiveOutcomeUncertain(
      reconcileNewScan({
        current: null,
        rawCode: "ABC123",
        inventoryItem: INVENTORY_ITEM,
        createOperationId,
      }),
    );

    const retryState = reconcileResolvedInventoryScanReceiveState({
      current: uncertainState,
      intent: "retry",
      rawCode: "ABC123",
      inventoryItem: OTHER_INVENTORY_ITEM,
      createOperationId,
    });

    expect(retryState.operationId).toBe("resolved-op-2");
    expect(retryState.outcomeUncertain).toBe(false);
    expect(createOperationId).toHaveBeenCalledTimes(2);
  });

  it("retains the same operation ID across an uncertain response and an explicit retry", async () => {
    const createOperationId = vi
      .fn()
      .mockReturnValueOnce("resolved-op-1")
      .mockReturnValueOnce("resolved-op-2");

    let state = reconcileNewScan({
      current: null,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    const retryableError = Object.assign(
      new Error("Response was not received."),
      { code: "functions/unavailable" },
    );
    const attempts: InventoryMovementRequest[] = [];

    const uncertainExecute = vi.fn(
      async (request: InventoryMovementRequest) => {
        attempts.push(request);
        throw retryableError;
      },
    );

    const uncertainResult =
      await executeResolvedInventoryScanReceiveWithRetry({
        state,
        execute: uncertainExecute,
        isRetryableError: () => true,
        shouldRetry: () => false,
      });

    expect(uncertainResult.status).toBe("retry_declined");

    state = markResolvedInventoryScanReceiveOutcomeUncertain(state);

    state = reconcileResolvedInventoryScanReceiveState({
      current: state,
      intent: "retry",
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId,
    });

    const retryExecute = vi.fn(async (request: InventoryMovementRequest) => {
      attempts.push(request);
      return success(request);
    });

    await executeResolvedInventoryScanReceiveWithRetry({
      state,
      execute: retryExecute,
      isRetryableError: () => false,
      shouldRetry: () => false,
    });

    expect(createOperationId).toHaveBeenCalledOnce();
    expect(attempts.map((attempt) => attempt.operationId)).toEqual([
      "resolved-op-1",
      "resolved-op-1",
    ]);
  });
});

describe("resolved inventory scan receive intent", () => {
  it("treats a scan as new without prompting when no attempt is pending", () => {
    const confirmRetry = vi.fn(() => true);

    const intent = resolveResolvedInventoryScanReceiveIntent({
      pendingState: null,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      confirmRetry,
    });

    expect(intent).toBe("new_scan");
    expect(confirmRetry).not.toHaveBeenCalled();
  });

  it("treats a scan as new without prompting when the pending attempt is settled", () => {
    const confirmRetry = vi.fn(() => true);

    const settledState = reconcileNewScan({
      current: null,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      createOperationId: () => "resolved-op-1",
    });

    const intent = resolveResolvedInventoryScanReceiveIntent({
      pendingState: settledState,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      confirmRetry,
    });

    expect(intent).toBe("new_scan");
    expect(confirmRetry).not.toHaveBeenCalled();
  });

  it("treats a scan as new without prompting when the pending attempt targets another scan", () => {
    const confirmRetry = vi.fn(() => true);

    const uncertainState = markResolvedInventoryScanReceiveOutcomeUncertain(
      reconcileNewScan({
        current: null,
        rawCode: "ABC123",
        inventoryItem: INVENTORY_ITEM,
        createOperationId: () => "resolved-op-1",
      }),
    );

    const intent = resolveResolvedInventoryScanReceiveIntent({
      pendingState: uncertainState,
      rawCode: "XYZ789",
      inventoryItem: OTHER_INVENTORY_ITEM,
      confirmRetry,
    });

    expect(intent).toBe("new_scan");
    expect(confirmRetry).not.toHaveBeenCalled();
  });

  it("asks the operator before reusing a pending operation for the same uncertain attempt", () => {
    const uncertainState = markResolvedInventoryScanReceiveOutcomeUncertain(
      reconcileNewScan({
        current: null,
        rawCode: "ABC123",
        inventoryItem: INVENTORY_ITEM,
        createOperationId: () => "resolved-op-1",
      }),
    );

    const confirmRetry = vi.fn(() => true);

    const confirmedIntent = resolveResolvedInventoryScanReceiveIntent({
      pendingState: uncertainState,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      confirmRetry,
    });

    expect(confirmedIntent).toBe("retry");
    expect(confirmRetry).toHaveBeenCalledWith(
      RESOLVED_INVENTORY_SCAN_RETRY_PROMPT,
    );

    const declinedIntent = resolveResolvedInventoryScanReceiveIntent({
      pendingState: uncertainState,
      rawCode: "ABC123",
      inventoryItem: INVENTORY_ITEM,
      confirmRetry: () => false,
    });

    expect(declinedIntent).toBe("new_scan");
  });
});
