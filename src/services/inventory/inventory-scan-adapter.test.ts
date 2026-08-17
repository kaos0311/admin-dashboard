import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";
import type { ProductDocument } from "@/repositories/firestore/inventory.types";

const mockFindByScan = vi.fn();
const mockFindProductByScan = vi.fn();

vi.mock("@/repositories/firestore/inventory.repository", () => ({
  InventoryRepository: {
    findByScan: mockFindByScan,
    findProductByScan: mockFindProductByScan,
  },
}));

const {
  adaptInventoryLookupResponse,
  getMatchedFieldLabel,
  resolveInventoryScanForIntake,
} = await import("./inventory-scan-adapter");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveInventoryScanForIntake", () => {
  it("returns unresolved for empty or whitespace-only scans", async () => {
    const result = await resolveInventoryScanForIntake({ rawCode: "   \n\t" });

    expect(result).toEqual({
      kind: "not_found",
      normalizedScan: "",
    });
    expect(mockFindByScan).not.toHaveBeenCalled();
    expect(mockFindProductByScan).not.toHaveBeenCalled();
  });

  it("returns existing inventory when inventory match is found before product lookup", async () => {
    const inventoryItem = {
      id: "item-1",
      productId: "prod-1",
      name: "Inventory Item",
      category: "Test",
      sku: "SKU-1",
      hcpc: "HCPC1",
      barcode: "12345",
      serial: "SERIAL-1",
      lotNumber: "LOT-1",
      locationName: "Main Location",
      binLocation: "A1",
      quantityOnHand: 1,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      available: 1,
      reorderLevel: 0,
      unitCost: 0,
      totalValue: 0,
      status: "available",
      manufacturer: "Test",
      manufacturerItemId: "MID-1",
      modelNumber: "MODEL-1",
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
    } as InventoryItem;

    mockFindByScan.mockResolvedValue(inventoryItem);
    mockFindProductByScan.mockResolvedValue(null);

    const result = await resolveInventoryScanForIntake({ rawCode: "12345" });

    expect(result).toEqual({
      kind: "inventory",
      normalizedScan: "12345",
      matchedBy: "barcode",
      item: inventoryItem,
    });
    expect(mockFindByScan).toHaveBeenCalledOnce();
    expect(mockFindProductByScan).not.toHaveBeenCalled();
  });

  it("returns existing product when no inventory match exists", async () => {
    const product: ProductDocument = {
      id: "prod-1",
      name: "Product A",
      category: "Supplies",
      sku: "SKU-1",
      hcpcs: "HCPC1",
      upc: "12345",
      manufacturer: "Acme",
      brand: "Acme Brand",
      manufacturerItemId: "MID-1",
      model: "Model A",
      defaultPurchasePrice: 10,
      reorderLevel: 5,
      status: "available",
      deleted: false,
    };

    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(product);

    const result = await resolveInventoryScanForIntake({ rawCode: "12345" });

    expect(result).toEqual({
      kind: "product_suggestion",
      normalizedScan: "12345",
      matchedBy: "upc",
      product,
    });
    expect(mockFindProductByScan).toHaveBeenCalledOnce();
  });

  it("keeps product suggestions distinct from inventory identity", async () => {
    const product: ProductDocument = {
      id: "prod-suggestion",
      name: "Suggested Product",
      category: "Supplies",
      sku: "SKU-SUG",
      hcpcs: "HCPCS",
      upc: "UPC-SUG",
      manufacturer: "Acme",
      brand: "Acme Brand",
      manufacturerItemId: "MID-SUG",
      model: "Model S",
      defaultPurchasePrice: 10,
      reorderLevel: 5,
      status: "available",
      deleted: false,
    };

    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(product);

    const result = await resolveInventoryScanForIntake({ rawCode: "UPC-SUG" });

    expect(result.kind).toBe("product_suggestion");
    expect(result).not.toHaveProperty("item");
    expect(result).not.toHaveProperty("inventoryItemId");
  });

  it("returns identified_product when no local match exists but identify succeeds", async () => {
    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(null);

    const result = await resolveInventoryScanForIntake({
      rawCode: "XYZ-123",
      identify: async (normalizedScan) => ({
        ok: true,
        product: {
          name: "Identified Product",
          category: "Supplies",
          sku: "SKU-X",
          barcode: normalizedScan,
          manufacturer: "AI Inc.",
          modelNumber: "X1",
        },
      }),
    });

    expect(result.kind).toBe("identified_product");
    if (result.kind === "identified_product") {
      expect(result.normalizedScan).toBe("XYZ-123");
      expect(result.identification.ok).toBe(true);
      expect(result.identification.product?.name).toBe("Identified Product");
    }
  });

  it("returns unresolved when no local match and identify fails", async () => {
    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(null);

    const result = await resolveInventoryScanForIntake({
      rawCode: "XYZ-123",
      identify: async () => ({ ok: false, error: "not found" }),
    });

    expect(result).toEqual({
      kind: "not_found",
      normalizedScan: "XYZ-123",
    });
  });

  it("propagates repository errors", async () => {
    mockFindByScan.mockRejectedValue(new Error("firestore failure"));
    mockFindProductByScan.mockResolvedValue(null);

    await expect(resolveInventoryScanForIntake({ rawCode: "12345" })).rejects.toThrow(
      "firestore failure",
    );
  });

  it("normalizes scan input before lookup", async () => {
    const product: ProductDocument = {
      id: "prod-2",
      name: "Product B",
      category: "Supplies",
      sku: "SKU-2",
      hcpcs: "HCPC2",
      upc: "000123",
      manufacturer: "Acme",
      brand: "Acme Brand",
      manufacturerItemId: "MID-2",
      model: "Model B",
      defaultPurchasePrice: 20,
      reorderLevel: 5,
      status: "available",
      deleted: false,
    };

    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(product);

    const result = await resolveInventoryScanForIntake({ rawCode: " 000123 " });

    expect(result).toEqual({
      kind: "product_suggestion",
      normalizedScan: "000123",
      matchedBy: "upc",
      product,
    });
  });
});

describe("adaptInventoryLookupResponse", () => {
  it.each([
    ["barcode", "Barcode"],
    ["serial", "Serial Number"],
    ["lotNumber", "Lot Number"],
    ["sku", "SKU"],
  ] as const)("labels %s matches for scanner UI display", (field, label) => {
    expect(getMatchedFieldLabel(field)).toBe(label);
  });

  it("adapts a server inventory result without changing its target", () => {
    const item = {
      id: "server-item-1",
      name: "Server Item",
      category: "Supplies",
      barcode: "BC-1",
      sku: "SKU-1",
      serial: "SER-1",
      lotNumber: "LOT-1",
      quantityOnHand: 2,
      available: 1,
      status: "available",
      manufacturer: "Acme",
      locationName: "Warehouse",
      lifecycleStatus: "active",
    };

    expect(
      adaptInventoryLookupResponse({
        status: "found",
        item,
        matchedFields: ["serial"],
      }),
    ).toEqual({
      status: "found",
      item,
      matchedFields: ["serial"],
    });
  });

  it("keeps not_found as not_found and does not create a local fallback", () => {
    expect(
      adaptInventoryLookupResponse({
        status: "not_found",
        normalizedBarcode: "MISSING",
      }),
    ).toEqual({
      status: "not_found",
      normalizedBarcode: "MISSING",
    });
  });

  it("keeps ambiguous results distinct from resolved inventory", () => {
    const adapted = adaptInventoryLookupResponse({
      status: "duplicate",
      normalizedBarcode: "DUP",
      matches: [
        {
          item: {
            id: "item-a",
            name: "A",
            category: "",
            barcode: "DUP",
            sku: "",
            serial: "",
            lotNumber: "",
            quantityOnHand: 1,
            available: 1,
            status: "available",
            manufacturer: "",
            locationName: "",
            lifecycleStatus: "active",
          },
          matchedFields: ["barcode"],
        },
        {
          item: {
            id: "item-b",
            name: "B",
            category: "",
            barcode: "",
            sku: "DUP",
            serial: "",
            lotNumber: "",
            quantityOnHand: 1,
            available: 1,
            status: "available",
            manufacturer: "",
            locationName: "",
            lifecycleStatus: "active",
          },
          matchedFields: ["sku"],
        },
      ],
    });

    expect(adapted?.status).toBe("duplicate");
    expect(adapted).not.toMatchObject({
      status: "found",
      item: expect.anything(),
    });
  });

  it("rejects unknown server result shapes instead of treating them as inventory", () => {
    expect(adaptInventoryLookupResponse({ status: "archived" })).toBeNull();
    expect(adaptInventoryLookupResponse(null)).toBeNull();
  });
});
