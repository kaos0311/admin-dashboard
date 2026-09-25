import { beforeEach, describe, expect, it, vi } from "vitest";

const callableResult = vi.fn();
const httpsCallableMock = vi.fn(() => callableResult);

vi.mock("firebase/functions", () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock("@/lib/firebase", () => ({
  functions: {},
}));

const { createInventoryMovement } = await import("./movements");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createInventoryMovement callable wrapper", () => {
  it("sends warehouse transfer source and target bin fields", async () => {
    callableResult.mockResolvedValue({
      data: {
        status: "success",
        operationId: "location-transfer-1",
        movementId: "movement-1",
        inventoryItemId: "inventory-1",
      },
    });

    await expect(
      createInventoryMovement({
        operationId: "location-transfer-1",
        movementType: "warehouse_transfer",
        inventoryItemId: "inventory-1",
        quantity: 1,
        fromLocation: "Warehouse A",
        fromBinLocation: "A1",
        toLocation: "Warehouse B",
        toBinLocation: "B2",
        source: "inventory_page",
      }),
    ).resolves.toMatchObject({
      status: "success",
      inventoryItemId: "inventory-1",
    });

    expect(httpsCallableMock).toHaveBeenCalledWith(
      {},
      "createInventoryMovementCallable",
    );
    expect(callableResult).toHaveBeenCalledWith({
      operationId: "location-transfer-1",
      movementType: "warehouse_transfer",
      inventoryItemId: "inventory-1",
      quantity: 1,
      fromLocation: "Warehouse A",
      fromBinLocation: "A1",
      toLocation: "Warehouse B",
      toBinLocation: "B2",
      source: "inventory_page",
    });
  });
});
