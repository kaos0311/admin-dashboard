import { describe, expect, it } from "vitest";

import { analyzeInventoryGroupingRisks } from "./inventoryGroupingRisks";
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

function riskTypes(items: InventoryItem[]) {
  return analyzeInventoryGroupingRisks({ inventoryItems: items }).risks.map((risk) => risk.type);
}

describe("analyzeInventoryGroupingRisks", () => {
  it("detects duplicate serial numbers", () => {
    const analysis = analyzeInventoryGroupingRisks({
      inventoryItems: [
        inventoryItem({ id: "a", productId: "a", serial: "SN-1" }),
        inventoryItem({ id: "b", productId: "b", serial: " sn-1 " }),
      ],
    });

    expect(analysis.risks).toContainEqual(
      expect.objectContaining({
        type: "DUPLICATE_SERIAL",
        severity: "CRITICAL",
        inventoryItemIds: ["a", "b"],
      }),
    );
  });

  it("detects duplicate asset tags", () => {
    expect(riskTypes([
      inventoryItem({ id: "a", serial: "", assetTag: "TAG-1" }),
      inventoryItem({ id: "b", serial: "", assetTag: "tag-1" }),
    ])).toContain("DUPLICATE_ASSET_TAG");
  });

  it("detects missing category", () => {
    expect(riskTypes([
      inventoryItem({ id: "missing-category", category: "" }),
    ])).toContain("MISSING_CATEGORY");
  });

  it("detects uncategorized fallback records", () => {
    expect(riskTypes([
      inventoryItem({
        id: "unknown",
        category: "",
        name: "Unknown Legacy",
        manufacturer: "",
        modelNumber: "",
        sku: "",
        hcpc: "",
        notes: "",
      }),
    ])).toContain("UNCATEGORIZED");
  });

  it("detects missing productId", () => {
    expect(riskTypes([
      inventoryItem({ id: "missing-product", productId: "" }),
    ])).toContain("MISSING_PRODUCT_ID");
  });

  it("detects weak fallback identity", () => {
    expect(riskTypes([
      inventoryItem({
        id: "weak",
        productId: "",
        manufacturer: "",
        modelNumber: "",
        sku: "",
        hcpc: "",
        name: "Loose Legacy Item",
      }),
    ])).toContain("WEAK_PRODUCT_IDENTITY");
  });

  it("detects same manufacturer/model across multiple product IDs", () => {
    const types = riskTypes([
      inventoryItem({ id: "a", productId: "product-a", manufacturer: "Invacare", modelNumber: "Perfecto" }),
      inventoryItem({ id: "b", productId: "product-b", manufacturer: "Invacare", modelNumber: "Perfecto" }),
    ]);

    expect(types).toContain("POSSIBLE_DUPLICATE_PRODUCT");
    expect(types).toContain("MULTIPLE_PRODUCT_IDS_FOR_SAME_MODEL");
  });

  it("detects same productId with conflicting model", () => {
    const types = riskTypes([
      inventoryItem({ id: "a", productId: "same-product", modelNumber: "Perfecto" }),
      inventoryItem({ id: "b", productId: "same-product", modelNumber: "Devilbiss 10L" }),
    ]);

    expect(types).toContain("SAME_PRODUCT_ID_DIFFERENT_MODEL");
    expect(types).toContain("INCONSISTENT_MODEL");
  });

  it("does not flag quantity inventory as missing serial", () => {
    expect(riskTypes([
      inventoryItem({
        id: "quantity",
        productId: "supply",
        name: "Nasal Cannula 7 ft",
        category: "Supplies",
        serial: "",
        assetTag: "",
        assetNumber: "",
        quantityOnHand: 42,
        available: 40,
      }),
    ])).not.toContain("MISSING_SERIAL_FOR_SERIALIZED_ITEM");
  });

  it("detects serialized inventory missing serial identifiers", () => {
    expect(riskTypes([
      inventoryItem({
        id: "rented",
        serial: "",
        assetTag: "",
        assetNumber: "",
        status: "rental_out",
        onRent: 1,
        available: 0,
      }),
    ])).toContain("MISSING_SERIAL_FOR_SERIALIZED_ITEM");
  });

  it("returns deterministic output", () => {
    const first = analyzeInventoryGroupingRisks({
      inventoryItems: [
        inventoryItem({ id: "b", productId: "b", serial: "SN-1" }),
        inventoryItem({ id: "a", productId: "a", serial: "SN-1" }),
      ],
    }).risks;
    const second = analyzeInventoryGroupingRisks({
      inventoryItems: [
        inventoryItem({ id: "a", productId: "a", serial: "SN-1" }),
        inventoryItem({ id: "b", productId: "b", serial: "SN-1" }),
      ],
    }).risks;

    expect(second).toEqual(first);
  });

  it("does not mutate input", () => {
    const item = inventoryItem({ id: "immutable", category: "" });
    const before = structuredClone(item);

    analyzeInventoryGroupingRisks({ inventoryItems: [item] });

    expect(item).toEqual(before);
  });

  it("returns empty analysis for empty inventory", () => {
    expect(analyzeInventoryGroupingRisks({ inventoryItems: [] })).toEqual({
      summary: {
        totalRisks: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        uncategorized: 0,
        duplicateSerials: 0,
        weakProductIdentity: 0,
        affectedRecords: 0,
        affectedProducts: 0,
      },
      categoryQuality: {
        explicit: 0,
        inferred: 0,
        fallback: 0,
        dynamic: 0,
      },
      risks: [],
      affectedRecords: [],
      affectedProducts: [],
    });
  });
});
