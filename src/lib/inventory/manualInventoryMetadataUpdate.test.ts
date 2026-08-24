import { beforeEach, describe, expect, it, vi } from "vitest";

const callableResult = vi.fn();
const httpsCallableMock = vi.fn(() => callableResult);

vi.mock("firebase/functions", () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock("@/lib/firebase", () => ({
  functions: {},
}));

const { updateManualInventoryMetadata } = await import("./manualInventoryMetadataUpdate");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("manual inventory metadata update callable wrapper", () => {
  it("calls the authorized metadata update callable", async () => {
    callableResult.mockResolvedValue({
      data: {
        status: "success",
        inventoryItemId: "inventory-1",
      },
    });

    const request = {
      operationId: "metadata-op-1",
      inventoryItemId: "inventory-1",
      name: "Updated",
      category: "Supplies",
      barcode: "BAR-1",
    };

    await expect(updateManualInventoryMetadata(request)).resolves.toEqual({
      status: "success",
      inventoryItemId: "inventory-1",
    });
    expect(httpsCallableMock).toHaveBeenCalledWith(
      {},
      "manualInventoryMetadataUpdateCallable",
    );
    expect(callableResult).toHaveBeenCalledWith(request);
  });
});
