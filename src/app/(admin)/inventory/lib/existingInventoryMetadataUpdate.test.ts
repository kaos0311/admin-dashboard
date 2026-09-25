import { describe, expect, it } from "vitest";

import { buildExistingInventoryMetadataUpdateRequest } from "./existingInventoryMetadataUpdate";
import type { InventoryItem } from "./inventoryTypes";

function payload(overrides: Partial<Omit<InventoryItem, "id" | "searchText" | "isDeleted">> = {}) {
  return {
    productId: "product-1",
    name: "Existing Item",
    category: "Supplies",
    sku: "SKU-1",
    hcpc: "A7030",
    barcode: "BAR-1",
    serial: "SER-1",
    lotNumber: "LOT-1",
    locationName: "Main Location",
    binLocation: "A1",
    quantityOnHand: 10,
    committed: 2,
    onRent: 1,
    onOrder: 3,
    available: 7,
    reorderLevel: 4,
    unitCost: 12,
    totalValue: 120,
    status: "damaged",
    manufacturer: "Acme",
    manufacturerItemId: "MFG-1",
    modelNumber: "Model 1",
    warrantyProvider: "Warranty Co",
    warrantyStartDate: "2026-01-01",
    warrantyEndDate: "2027-01-01",
    warrantyNotes: "Covered",
    purchaseDate: "2026-01-02",
    usefulLifeMonths: 24,
    lifecycleStatus: "retired",
    nextServiceDate: "2026-07-01",
    lifecycleNotes: "Lifecycle note",
    notes: "Notes",
    ...overrides,
  } satisfies Omit<InventoryItem, "id" | "searchText" | "isDeleted">;
}

describe("existing inventory metadata update request", () => {
  it("keeps identity and display metadata but excludes protected stock, status, lifecycle, and location fields", () => {
    const request = buildExistingInventoryMetadataUpdateRequest({
      operationId: "metadata-op-1",
      inventoryItemId: "inventory-1",
      payload: payload(),
      productId: "product-2",
      searchText: "existing item",
      pendingScanReview: false,
      scanSource: "inventory_review_completed",
      lowStock: true,
    });

    expect(request).toMatchObject({
      operationId: "metadata-op-1",
      inventoryItemId: "inventory-1",
      productId: "product-2",
      name: "Existing Item",
      barcode: "BAR-1",
      serial: "SER-1",
      lotNumber: "LOT-1",
      sku: "SKU-1",
      manufacturerItemId: "MFG-1",
      searchText: "existing item",
      pendingScanReview: false,
      scanSource: "inventory_review_completed",
      lowStock: true,
    });
    expect(request).not.toHaveProperty("quantityOnHand");
    expect(request).not.toHaveProperty("available");
    expect(request).not.toHaveProperty("committed");
    expect(request).not.toHaveProperty("onRent");
    expect(request).not.toHaveProperty("onOrder");
    expect(request).not.toHaveProperty("totalValue");
    expect(request).not.toHaveProperty("status");
    expect(request).not.toHaveProperty("lifecycleStatus");
    expect(request).not.toHaveProperty("locationName");
    expect(request).not.toHaveProperty("binLocation");
  });
});
