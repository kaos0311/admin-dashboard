import { beforeEach, describe, expect, it, vi } from "vitest";

const callableResult = vi.fn();
const httpsCallableMock = vi.fn(() => callableResult);

vi.mock("firebase/functions", () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock("@/lib/firebase", () => ({
  functions: {},
}));

const { smartMergeInventory } = await import("./smartMergeInventory");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("smartMergeInventory callable wrapper", () => {
  it("calls the authorized manual inventory upsert callable", async () => {
    callableResult.mockResolvedValue({
      data: {
        status: "created",
        inventoryItemId: "inventory-1",
      },
    });

    const result = await smartMergeInventory({
      operationId: "manual-upsert-op-1",
      name: "Manual Item",
      category: "Supplies",
      barcode: "BAR-1",
    });

    expect(httpsCallableMock).toHaveBeenCalledWith(
      {},
      "manualInventoryUpsertCallable",
    );
    expect(callableResult).toHaveBeenCalledWith({
      operationId: "manual-upsert-op-1",
      name: "Manual Item",
      category: "Supplies",
      barcode: "BAR-1",
    });
    expect(result).toEqual({
      status: "created",
      action: "created",
      inventoryId: "inventory-1",
    });
  });

  it("maps duplicate_operation to the legacy action/inventoryId shape", async () => {
    callableResult.mockResolvedValue({
      data: {
        status: "duplicate_operation",
        action: "merged",
        inventoryItemId: "inventory-2",
      },
    });

    await expect(
      smartMergeInventory({
        operationId: "manual-upsert-op-2",
        name: "Manual Item",
        category: "Supplies",
      }),
    ).resolves.toEqual({
      status: "duplicate_operation",
      action: "merged",
      inventoryId: "inventory-2",
    });
  });

  it("returns ambiguity without choosing a target", async () => {
    callableResult.mockResolvedValue({
      data: {
        status: "ambiguous",
        matches: [
          {
            inventoryItemId: "inventory-a",
            matchedBy: ["barcode"],
            name: "A",
            barcode: "DUP",
            serial: "",
            lotNumber: "",
            sku: "",
          },
          {
            inventoryItemId: "inventory-b",
            matchedBy: ["barcode"],
            name: "B",
            barcode: "DUP",
            serial: "",
            lotNumber: "",
            sku: "",
          },
        ],
      },
    });

    const result = await smartMergeInventory({
      operationId: "manual-upsert-op-3",
      name: "Manual Item",
      category: "Supplies",
      barcode: "DUP",
    });

    expect(result).toEqual({
      status: "ambiguous",
      matches: [
        {
          inventoryItemId: "inventory-a",
          matchedBy: ["barcode"],
          name: "A",
          barcode: "DUP",
          serial: "",
          lotNumber: "",
          sku: "",
        },
        {
          inventoryItemId: "inventory-b",
          matchedBy: ["barcode"],
          name: "B",
          barcode: "DUP",
          serial: "",
          lotNumber: "",
          sku: "",
        },
      ],
    });
  });
});
