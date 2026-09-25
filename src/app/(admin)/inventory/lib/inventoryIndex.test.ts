import { describe, expect, it } from "vitest";

import { buildInventoryIndex } from "./inventoryIndex";
import type { InventoryItem } from "./inventoryTypes";

function inventoryItem(overrides: Partial<InventoryItem>): InventoryItem {
  const item: InventoryItem = {
    id: "item-1",
    productId: "product-1",
    name: "O2 Concentrator",
    category: "Oxygen Equipment",
    sku: "O2-10",
    hcpc: "E1390",
    barcode: "",
    serial: "",
    lotNumber: "",
    locationName: "Main Warehouse",
    binLocation: "",
    quantityOnHand: 1,
    committed: 0,
    onRent: 0,
    onOrder: 0,
    available: 1,
    reorderLevel: 0,
    unitCost: 100,
    totalValue: 100,
    status: "available",
    manufacturer: "Invacare",
    manufacturerItemId: "",
    modelNumber: "Perfecto",
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

  return {
    ...item,
    ...overrides,
  };
}

describe("buildInventoryIndex", () => {
  it("groups multiple serial units under one product", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "a", serial: "123456789" }),
        inventoryItem({ id: "b", serial: "987654321" }),
      ],
    });

    expect(index.categories).toHaveLength(1);
    expect(index.categories[0].products).toHaveLength(1);
    expect(index.categories[0].products[0].units.map((unit) => unit.serialNumber)).toEqual([
      "123456789",
      "987654321",
    ]);
  });

  it("groups multiple products under one category", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "concentrator", productId: "oxygen-1", name: "O2 Concentrator", serial: "SN-1" }),
        inventoryItem({ id: "tank", productId: "oxygen-2", name: "Oxygen Tank", serial: "SN-2" }),
      ],
    });

    expect(index.categories[0].name).toBe("Oxygen Equipment");
    expect(index.categories[0].products.map((product) => product.productName)).toEqual([
      "O2 Concentrator",
      "Oxygen Tank",
    ]);
  });

  it("supports serialized and non-serialized products", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "unit", productId: "oxygen-1", serial: "SN-1" }),
        inventoryItem({
          id: "supply",
          productId: "supply-1",
          name: "Nasal Cannula 7 ft",
          category: "Supplies",
          barcode: "UPC-1",
          quantityOnHand: 42,
          available: 40,
        }),
      ],
    });

    const serialized = index.categories
      .flatMap((category) => category.products)
      .find((product) => product.productId === "oxygen-1");
    const quantity = index.categories
      .flatMap((category) => category.products)
      .find((product) => product.productId === "supply-1");

    expect(serialized?.units).toHaveLength(1);
    expect(quantity?.units).toHaveLength(0);
    expect(quantity?.quantities[0]).toMatchObject({
      quantityOnHand: 42,
      available: 40,
      recordCount: 1,
    });
  });

  it("places missing categories into inferred or uncategorized buckets and reports risk", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({
          id: "legacy",
          productId: "",
          name: "Unknown Product",
          category: "",
          manufacturer: "",
          modelNumber: "",
          sku: "",
          hcpc: "",
          notes: "",
        }),
      ],
    });

    expect(index.categories[0].name).toBe("Uncategorized");
    expect(index.categories[0].products[0].productName).toBe("Unknown Product");
    expect(index.risks).toEqual([
      expect.objectContaining({ itemId: "legacy", type: "missing_category" }),
    ]);
  });

  it("tolerates missing manufacturer and model values", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({
          id: "legacy",
          manufacturer: "",
          modelNumber: "",
          serial: "SN-1",
        }),
      ],
    });

    expect(index.categories[0].products[0]).toMatchObject({
      manufacturer: "-",
      modelNumber: "-",
    });
  });

  it("keeps duplicate display names separate when product IDs differ", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "a", productId: "product-a", name: "Perfecto", serial: "SN-1" }),
        inventoryItem({ id: "b", productId: "product-b", name: "Perfecto", serial: "SN-2" }),
      ],
    });

    expect(index.categories[0].products).toHaveLength(2);
    expect(index.categories[0].products.map((product) => product.productId)).toEqual([
      "product-a",
      "product-b",
    ]);
  });

  it("computes location and status counts", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "available", serial: "SN-1", status: "available", available: 1 }),
        inventoryItem({ id: "checked-out", serial: "SN-2", status: "rental_out", available: 0, onRent: 1, locationName: "Hopkinsville" }),
        inventoryItem({ id: "service", serial: "SN-3", lifecycleStatus: "needs_service", available: 0, locationName: "Service" }),
      ],
    });

    expect(index.categories[0].totals).toMatchObject({
      totalUnits: 3,
      totalQuantity: 3,
      available: 1,
      checkedOut: 1,
      service: 1,
    });
    expect(index.categories[0].products[0].units.map((unit) => unit.locationName)).toEqual([
      "Main Warehouse",
      "Hopkinsville",
      "Service",
    ]);
  });

  it("builds searchable metadata across hierarchy levels", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({
          id: "unit",
          serial: "SN-PERFECTO-1",
          searchText: "custom indexed text",
        }),
      ],
    });

    const category = index.categories[0];
    const product = category.products[0];

    expect(category.searchText).toContain("perfecto");
    expect(product.searchText).toContain("sn perfecto 1");
    expect(product.units[0].searchText).toContain("custom indexed text");
  });

  it("returns deterministic ordering", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "z", productId: "product-z", name: "Z Product", category: "Supplies", quantityOnHand: 2, available: 2 }),
        inventoryItem({ id: "a", productId: "product-a", name: "A Product", category: "Oxygen Equipment", serial: "SN-2" }),
        inventoryItem({ id: "b", productId: "product-a", name: "A Product", category: "Oxygen Equipment", serial: "SN-1" }),
      ],
    });

    expect(index.categories.map((category) => category.name)).toEqual([
      "Oxygen Equipment",
      "Supplies",
    ]);
    expect(index.categories[0].products[0].units.map((unit) => unit.serialNumber)).toEqual([
      "SN-1",
      "SN-2",
    ]);
  });

  it("returns an empty index for empty inventory", () => {
    expect(buildInventoryIndex({ inventoryItems: [] })).toEqual({
      categories: [],
      risks: [],
    });
  });

  it("reports duplicate serial numbers without merging records", () => {
    const index = buildInventoryIndex({
      inventoryItems: [
        inventoryItem({ id: "a", productId: "product-a", serial: "DUP-1" }),
        inventoryItem({ id: "b", productId: "product-b", serial: "DUP-1" }),
      ],
    });

    expect(index.categories[0].products).toHaveLength(2);
    expect(index.risks).toEqual([
      expect.objectContaining({ itemId: "a", type: "duplicate_serial" }),
      expect.objectContaining({ itemId: "b", type: "duplicate_serial" }),
    ]);
  });
});
