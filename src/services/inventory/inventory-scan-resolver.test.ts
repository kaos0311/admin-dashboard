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

const { resolveInventoryScan } = await import("./inventory-scan-resolver");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveInventoryScan", () => {
  it("returns unresolved for empty or whitespace-only scans", async () => {
    const result = await resolveInventoryScan({ rawCode: "   \n\t" });

    expect(result).toEqual({
      status: "unresolved",
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

    const result = await resolveInventoryScan({ rawCode: "12345" });

    expect(result).toEqual({
      status: "existing-inventory",
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

    const result = await resolveInventoryScan({ rawCode: "12345" });

    expect(result).toEqual({
      status: "existing-product",
      normalizedScan: "12345",
      matchedBy: "upc",
      product,
    });
    expect(mockFindProductByScan).toHaveBeenCalledOnce();
  });

  it("returns identified-product when no local match exists but identify succeeds", async () => {
    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(null);

    const result = await resolveInventoryScan({
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

    expect(result.status).toBe("identified-product");
    if (result.status === "identified-product") {
      expect(result.normalizedScan).toBe("XYZ-123");
      expect(result.identification.ok).toBe(true);
      expect(result.identification.product?.name).toBe("Identified Product");
    }
  });

  it("returns unresolved when no local match and identify fails", async () => {
    mockFindByScan.mockResolvedValue(null);
    mockFindProductByScan.mockResolvedValue(null);

    const result = await resolveInventoryScan({
      rawCode: "XYZ-123",
      identify: async () => ({ ok: false, error: "not found" }),
    });

    expect(result).toEqual({
      status: "unresolved",
      normalizedScan: "XYZ-123",
    });
  });

  it("propagates repository errors", async () => {
    mockFindByScan.mockRejectedValue(new Error("firestore failure"));
    mockFindProductByScan.mockResolvedValue(null);

    await expect(resolveInventoryScan({ rawCode: "12345" })).rejects.toThrow(
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

    const result = await resolveInventoryScan({ rawCode: " 000123 " });

    expect(result).toEqual({
      status: "existing-product",
      normalizedScan: "000123",
      matchedBy: "upc",
      product,
    });
  });
});
