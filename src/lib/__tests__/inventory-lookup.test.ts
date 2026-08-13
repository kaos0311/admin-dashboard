import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the inventory barcode lookup logic.
 *
 * These test the client-side types, response parsing, and error handling.
 * The Cloud Function itself requires Firebase Emulator tests (see
 * functions/test for integration tests).
 */
import {
  MATCHED_FIELD_LABELS,
  getMatchedFieldLabel,
  getInventoryTransactionErrorCode,
  isRetryableInventoryTransactionError,
  type BarcodeLookupResult,
  type InventoryLookupItem,
  type InventoryLookupMatchedField,
} from "@/hooks/useInventoryLookup";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockItem(overrides: Partial<InventoryLookupItem> = {}): InventoryLookupItem {
  return {
    id: "doc-123",
    name: "Test Product",
    category: "Supplies",
    barcode: "1234567890123",
    sku: "TEST-SKU-001",
    serial: "",
    lotNumber: "",
    quantityOnHand: 10,
    available: 8,
    status: "active",
    manufacturer: "Test Manufacturer",
    locationName: "Warehouse A",
    lifecycleStatus: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MATCHED_FIELD_LABELS
// ---------------------------------------------------------------------------

describe("MATCHED_FIELD_LABELS", () => {
  it("provides human-readable labels for each matched field", () => {
    expect(MATCHED_FIELD_LABELS.barcode).toBe("Barcode");
    expect(MATCHED_FIELD_LABELS.serial).toBe("Serial Number");
    expect(MATCHED_FIELD_LABELS.lotNumber).toBe("Lot Number");
    expect(MATCHED_FIELD_LABELS.sku).toBe("SKU");
  });

  it("getMatchedFieldLabel returns correct label for each field", () => {
    expect(getMatchedFieldLabel("barcode")).toBe("Barcode");
    expect(getMatchedFieldLabel("serial")).toBe("Serial Number");
    expect(getMatchedFieldLabel("lotNumber")).toBe("Lot Number");
    expect(getMatchedFieldLabel("sku")).toBe("SKU");
  });
});

// ---------------------------------------------------------------------------
// BarcodeLookupResult discriminated union
// ---------------------------------------------------------------------------

describe("BarcodeLookupResult - found", () => {
  it("has correct shape when status is found", () => {
    const item = createMockItem();
    const result: BarcodeLookupResult = {
      status: "found",
      item,
      matchedFields: ["barcode"],
    };

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.item.name).toBe("Test Product");
      expect(result.matchedFields).toContain("barcode");
    }
  });

  it("supports multiple matched fields", () => {
    const result: BarcodeLookupResult = {
      status: "found",
      item: createMockItem(),
      matchedFields: ["barcode", "sku"],
    };

    if (result.status === "found") {
      expect(result.matchedFields).toHaveLength(2);
      expect(result.matchedFields).toContain("barcode");
      expect(result.matchedFields).toContain("sku");
    }
  });

  it("handles lotNumber match", () => {
    const result: BarcodeLookupResult = {
      status: "found",
      item: createMockItem({ lotNumber: "LOT-001" }),
      matchedFields: ["lotNumber"],
    };

    if (result.status === "found") {
      expect(result.matchedFields).toEqual(["lotNumber"]);
      expect(result.item.lotNumber).toBe("LOT-001");
    }
  });
});

describe("BarcodeLookupResult - not_found", () => {
  it("has correct shape when status is not_found", () => {
    const result: BarcodeLookupResult = {
      status: "not_found",
      normalizedBarcode: "9999999999999",
    };

    expect(result.status).toBe("not_found");
    if (result.status === "not_found") {
      expect(result.normalizedBarcode).toBe("9999999999999");
    }
  });

  it("preserves leading zeroes in normalized barcode", () => {
    const result: BarcodeLookupResult = {
      status: "not_found",
      normalizedBarcode: "001234567890",
    };

    if (result.status === "not_found") {
      expect(result.normalizedBarcode).toBe("001234567890");
      expect(result.normalizedBarcode.startsWith("00")).toBe(true);
    }
  });

  it("handles alphanumeric not-found scans", () => {
    const result: BarcodeLookupResult = {
      status: "not_found",
      normalizedBarcode: "ABC-123-XYZ",
    };

    if (result.status === "not_found") {
      expect(result.normalizedBarcode).toBe("ABC-123-XYZ");
    }
  });
});

describe("BarcodeLookupResult - duplicate", () => {
  it("has correct shape when status is duplicate", () => {
    const item1 = createMockItem({ id: "doc-1", name: "Item One" });
    const item2 = createMockItem({ id: "doc-2", name: "Item Two" });

    const result: BarcodeLookupResult = {
      status: "duplicate",
      normalizedBarcode: "1234567890123",
      matches: [
        { item: item1, matchedFields: ["barcode"] },
        { item: item2, matchedFields: ["sku"] },
      ],
    };

    expect(result.status).toBe("duplicate");
    if (result.status === "duplicate") {
      expect(result.matches).toHaveLength(2);
      expect(result.matches[0].item.name).toBe("Item One");
      expect(result.matches[0].matchedFields).toEqual(["barcode"]);
      expect(result.matches[1].item.name).toBe("Item Two");
      expect(result.matches[1].matchedFields).toEqual(["sku"]);
    }
  });

  it("supports multiple matched fields per item in duplicate", () => {
    const item = createMockItem({ id: "doc-1" });
    const result: BarcodeLookupResult = {
      status: "duplicate",
      normalizedBarcode: "ABC-123",
      matches: [
        { item, matchedFields: ["barcode", "sku", "serial"] },
      ],
    };

    if (result.status === "duplicate") {
      expect(result.matches[0].matchedFields).toHaveLength(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Response type narrowing (discriminated union)
// ---------------------------------------------------------------------------

describe("BarcodeLookupResult type narrowing", () => {
  function handleResult(result: BarcodeLookupResult): string {
    switch (result.status) {
      case "found":
        // In the "found" branch, item and matchedFields are accessible
        expect(result.item).toBeDefined();
        expect(result.matchedFields).toBeDefined();
        return "found";
      case "not_found":
        // In the "not_found" branch, normalizedBarcode is accessible
        expect(result.normalizedBarcode).toBeDefined();
        return "not_found";
      case "duplicate":
        // In the "duplicate" branch, matches and normalizedBarcode are accessible
        expect(result.matches).toBeDefined();
        expect(result.normalizedBarcode).toBeDefined();
        return "duplicate";
    }
  }

  it("correctly narrows to found branch", () => {
    const result: BarcodeLookupResult = {
      status: "found",
      item: createMockItem(),
      matchedFields: ["barcode"],
    };
    expect(handleResult(result)).toBe("found");
  });

  it("correctly narrows to not_found branch", () => {
    const result: BarcodeLookupResult = {
      status: "not_found",
      normalizedBarcode: "999",
    };
    expect(handleResult(result)).toBe("not_found");
  });

  it("correctly narrows to duplicate branch", () => {
    const result: BarcodeLookupResult = {
      status: "duplicate",
      normalizedBarcode: "999",
      matches: [],
    };
    expect(handleResult(result)).toBe("duplicate");
  });
});

// ---------------------------------------------------------------------------
// InventoryLookupItem shape
// ---------------------------------------------------------------------------

describe("InventoryLookupItem", () => {
  it("has all required fields", () => {
    const item: InventoryLookupItem = {
      id: "test-id",
      name: "Item",
      category: "Cat",
      barcode: "123",
      sku: "SKU-1",
      serial: "SN-001",
      lotNumber: "LOT-A",
      quantityOnHand: 5,
      available: 3,
      status: "active",
      manufacturer: "Mfr",
      locationName: "Loc",
      lifecycleStatus: "active",
    };

    expect(item.id).toBe("test-id");
    expect(item.name).toBe("Item");
    expect(item.quantityOnHand).toBe(5);
    expect(item.available).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// InventoryLookupMatchedField type
// ---------------------------------------------------------------------------

describe("InventoryLookupMatchedField", () => {
  it("only allows valid field names", () => {
    const validFields: InventoryLookupMatchedField[] = [
      "barcode",
      "serial",
      "lotNumber",
      "sku",
    ];

    expect(validFields).toHaveLength(4);
    expect(validFields).not.toContain("unknown");
  });

  it("serial is a valid matched field", () => {
    const field: InventoryLookupMatchedField = "serial";
    expect(field).toBe("serial");
  });

  it("lotNumber is a valid matched field", () => {
    const field: InventoryLookupMatchedField = "lotNumber";
    expect(field).toBe("lotNumber");
  });
});

describe("inventory transaction retry classification", () => {
  it.each([
    "functions/unavailable",
    "functions/deadline-exceeded",
    "functions/cancelled",
    "functions/aborted",
    "functions/resource-exhausted",
  ])("classifies %s as retryable", (code) => {
    const error = {
      code,
      message: "Synthetic transport failure",
    };

    expect(getInventoryTransactionErrorCode(error)).toBe(
      code.replace("functions/", ""),
    );

    expect(
      isRetryableInventoryTransactionError(error),
    ).toBe(true);
  });

  it.each([
    "functions/invalid-argument",
    "functions/permission-denied",
    "functions/unauthenticated",
    "functions/failed-precondition",
    "functions/not-found",
    "functions/already-exists",
    "functions/internal",
  ])("classifies %s as terminal", (code) => {
    expect(
      isRetryableInventoryTransactionError({
        code,
        message: "Synthetic terminal failure",
      }),
    ).toBe(false);
  });

  it("normalizes bare Firebase callable codes", () => {
    expect(
      getInventoryTransactionErrorCode({
        code: "unavailable",
      }),
    ).toBe("unavailable");
  });

  it("returns unknown for errors without a Firebase code", () => {
    const error = new Error(
      "Network-shaped error without Firebase code",
    );

    expect(
      getInventoryTransactionErrorCode(error),
    ).toBe("unknown");

    expect(
      isRetryableInventoryTransactionError(error),
    ).toBe(false);
  });
});
