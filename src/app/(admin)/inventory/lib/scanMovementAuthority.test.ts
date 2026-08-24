import { describe, expect, it, vi } from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";
import type { ClientInventoryScanResult } from "@/services/inventory/inventory-scan-adapter";
import type { InventoryItem } from "./inventoryTypes";

import {
  buildCanonicalScanMovementRequest,
  runCanonicalScanMovement,
} from "./scanMovementAuthority";

const INVENTORY_ITEM: InventoryItem = {
  id: "server-item-1",
  productId: "product-1",
  name: "Server Item",
  category: "Supplies",
  sku: "SKU-1",
  hcpc: "",
  barcode: "SCAN-1",
  serial: "",
  lotNumber: "",
  locationName: "Main Location",
  binLocation: "",
  quantityOnHand: 1,
  committed: 0,
  onRent: 0,
  onOrder: 0,
  available: 0,
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

function success(
  overrides: Partial<InventoryMovementResult> = {},
): InventoryMovementResult {
  return {
    status: "success",
    operationId: "inventory-scan-op-1",
    movementId: "movement-1",
    inventoryItemId: "server-item-1",
    quantityBefore: 0,
    quantityDelta: 1,
    quantityAfter: 1,
    ...overrides,
  };
}

function notFound(): InventoryMovementResult {
  return {
    status: "not_found",
    operationId: "inventory-scan-op-1",
    message: "Inventory item was not found.",
  };
}

function baseParams(
  execute: (request: InventoryMovementRequest) => Promise<InventoryMovementResult>,
) {
  return {
    rawCode: "SCAN-1",
    direction: "in" as const,
    operationId: "inventory-scan-op-1",
    execute,
    isRetryableError: () => false,
    shouldRetry: () => false,
    resolveIntake: vi.fn(async (): Promise<ClientInventoryScanResult> => ({
      kind: "not_found",
      normalizedScan: "SCAN-1",
    })),
    fetchInventoryById: vi.fn(async () => INVENTORY_ITEM),
  };
}

describe("canonical scan movement authority", () => {
  it("builds scan-out requests without a client-selected inventoryItemId", () => {
    expect(
      buildCanonicalScanMovementRequest({
        rawCode: " SCAN-1 ",
        direction: "out",
        outReason: "rental",
      }),
    ).toEqual({
      movementType: "rental_checkout",
      barcode: "SCAN-1",
      quantity: 1,
      reason: "Scanned out for rental.",
      source: "scanner",
      metadata: {
        rawCode: " SCAN-1 ",
        direction: "out",
        outReason: "rental",
      },
    });
  });

  it("sends scan-out to createInventoryMovement without client lookup or availability veto", async () => {
    const execute = vi.fn(
      async (
        _request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => success(),
    );
    const params = {
      ...baseParams(execute),
      direction: "out" as const,
    };

    const result = await runCanonicalScanMovement(params);

    expect(result.status).toBe("movement_completed");
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0]).toMatchObject({
      movementType: "patient_assignment",
      barcode: "SCAN-1",
      operationId: "inventory-scan-op-1",
    });
    expect(execute.mock.calls[0][0]).not.toHaveProperty("inventoryItemId");
    expect(params.resolveIntake).not.toHaveBeenCalled();
  });

  it("sends scan-in to createInventoryMovement before intake lookup", async () => {
    const execute = vi.fn(
      async (
        _request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => success(),
    );
    const params = baseParams(execute);

    const result = await runCanonicalScanMovement(params);

    expect(result).toMatchObject({
      status: "movement_completed",
      movement: success(),
      inventoryItem: INVENTORY_ITEM,
    });
    expect(execute.mock.calls[0][0]).toMatchObject({
      movementType: "receive",
      barcode: "SCAN-1",
      operationId: "inventory-scan-op-1",
    });
    expect(execute.mock.calls[0][0]).not.toHaveProperty("inventoryItemId");
    expect(params.resolveIntake).not.toHaveBeenCalled();
  });

  it("uses movement.inventoryItemId as the post-success enrichment source", async () => {
    const execute = vi.fn(async () =>
      success({ inventoryItemId: "server-resolved-item" }),
    );
    const params = baseParams(execute);
    params.fetchInventoryById.mockResolvedValue({
      ...INVENTORY_ITEM,
      id: "server-resolved-item",
    });

    await runCanonicalScanMovement(params);

    expect(params.fetchInventoryById).toHaveBeenCalledWith(
      "server-resolved-item",
    );
  });

  it("treats duplicate_operation as a completed movement", async () => {
    const execute = vi.fn(async () => success({ status: "duplicate_operation" }));

    const result = await runCanonicalScanMovement(baseParams(execute));

    expect(result.status).toBe("movement_completed");
  });

  it("keeps movement success definitive when enrichment fails", async () => {
    const enrichmentError = new Error("read failed");
    const params = baseParams(vi.fn(async () => success()));
    params.fetchInventoryById.mockRejectedValue(enrichmentError);

    const result = await runCanonicalScanMovement(params);

    expect(result).toMatchObject({
      status: "movement_completed",
      movement: success(),
      inventoryItem: null,
      enrichmentError,
    });
  });

  it("runs intake assistance only for receive not_found", async () => {
    const productSuggestion: ClientInventoryScanResult = {
      kind: "product_suggestion",
      normalizedScan: "SCAN-1",
      matchedBy: "upc",
      product: {
        id: "product-1",
        name: "Suggested Product",
        category: "Supplies",
        sku: "SKU-1",
        hcpcs: "",
        upc: "SCAN-1",
        manufacturer: "",
        brand: "",
        manufacturerItemId: "",
        model: "",
        defaultPurchasePrice: 0,
        reorderLevel: 0,
        status: "available",
        deleted: false,
      },
    };
    const params = baseParams(vi.fn(async () => notFound()));
    params.resolveIntake.mockResolvedValue(productSuggestion);

    const result = await runCanonicalScanMovement(params);

    expect(result).toEqual({
      status: "intake_fallback",
      movement: notFound(),
      scanResolution: productSuggestion,
    });
  });

  it("does not run intake assistance for scan-out not_found", async () => {
    const params = {
      ...baseParams(vi.fn(async () => notFound())),
      direction: "out" as const,
    };

    const result = await runCanonicalScanMovement(params);

    expect(result).toEqual({
      status: "movement_failed",
      movement: notFound(),
    });
    expect(params.resolveIntake).not.toHaveBeenCalled();
  });

  it.each([
    success({ status: "ambiguous", matches: [] }),
    success({ status: "permission_denied", message: "Denied." }),
    success({ status: "invalid", message: "Invalid scan." }),
  ])("does not run intake assistance for %s", async (movement) => {
    const params = baseParams(vi.fn(async () => movement));

    const result = await runCanonicalScanMovement(params);

    expect(result).toEqual({
      status: "movement_failed",
      movement,
    });
    expect(params.resolveIntake).not.toHaveBeenCalled();
  });

  it("does not run intake assistance for conflicting operation reuse errors", async () => {
    const conflict = Object.assign(
      new Error("This operationId was already used with different request data."),
      { code: "functions/failed-precondition" },
    );
    const params = baseParams(vi.fn(async () => {
      throw conflict;
    }));

    await expect(runCanonicalScanMovement(params)).rejects.toBe(conflict);
    expect(params.resolveIntake).not.toHaveBeenCalled();
  });
});
