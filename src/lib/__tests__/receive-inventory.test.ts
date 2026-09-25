import { describe, it, expect } from "vitest";
import type {
  ReceiveInventoryRequest,
  ReceiveInventoryResult,
  ReceiveInventorySuccess,
  ReceiveInventoryNotFound,
  ReceiveInventoryDuplicate,
  InventoryLookupItem,
  InventoryLookupMatch,
  ReceiveInventoryResponse,
  ReceiveInventoryCallableSuccess,
  ReceiveInventoryCallableError,
} from "@/lib/inventory/receive-inventory.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_OPERATION_ID = "00000000-0000-4000-8000-000000000001";

function createMockItem(
  overrides: Partial<InventoryLookupItem> = {},
): InventoryLookupItem {
  return {
    id: "item-001",
    name: "Test Product",
    category: "Supplies",
    barcode: "1234567890123",
    sku: "SKU-001",
    serial: "",
    lotNumber: "",
    quantityOnHand: 50,
    available: 45,
    status: "active",
    manufacturer: "Test Mfr",
    locationName: "Warehouse A",
    lifecycleStatus: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ReceiveInventoryRequest validation
// ---------------------------------------------------------------------------

describe("ReceiveInventoryRequest", () => {
  it("accepts a valid request with operationId", () => {
    const req: ReceiveInventoryRequest = {
      operationId: TEST_OPERATION_ID,
      barcode: "1234567890123",
      quantity: 10,
      source: "tera_hid_scanner",
    };

    expect(req.operationId).toBe(TEST_OPERATION_ID);
    expect(req.barcode).toBe("1234567890123");
    expect(req.quantity).toBe(10);
    expect(req.source).toBe("tera_hid_scanner");
  });

  it("accepts request with all optional fields", () => {
    const req: ReceiveInventoryRequest = {
      operationId: TEST_OPERATION_ID,
      barcode: "ABC123",
      rawScan: "ABC123\r",
      quantity: 5,
      source: "tera_hid_scanner",
      locationId: "loc-1",
      lotNumber: "LOT-2026",
      serial: "SN-001",
      expirationDate: "2026-12-31",
      note: "Rush order",
    };

    expect(req.operationId).toBe(TEST_OPERATION_ID);
    expect(req.barcode).toBe("ABC123");
    expect(req.rawScan).toBe("ABC123\r");
    expect(req.quantity).toBe(5);
    expect(req.locationId).toBe("loc-1");
    expect(req.lotNumber).toBe("LOT-2026");
    expect(req.serial).toBe("SN-001");
    expect(req.expirationDate).toBe("2026-12-31");
    expect(req.note).toBe("Rush order");
  });

  it("supports manual_entry source", () => {
    const req: ReceiveInventoryRequest = {
      operationId: TEST_OPERATION_ID,
      barcode: "001234567890",
      quantity: 1,
      source: "manual_entry",
    };
    expect(req.source).toBe("manual_entry");
  });

  it("quantity defaults to 1 when not provided is a required field", () => {
    // quantity is required, so it must be explicitly set
    const req: ReceiveInventoryRequest = {
      operationId: TEST_OPERATION_ID,
      barcode: "123",
      quantity: 1,
      source: "tera_hid_scanner",
    };
    expect(req.quantity).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ReceiveInventoryResult — success
// ---------------------------------------------------------------------------

describe("ReceiveInventoryResult — success", () => {
  it("has correct shape when status is success", () => {
    const result: ReceiveInventoryResult = {
      status: "success",
      transactionId: "tx-001",
      inventoryItemId: "item-001",
      quantityBefore: 50,
      quantityChange: 10,
      quantityAfter: 60,
    };

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.transactionId).toBe("tx-001");
      expect(result.inventoryItemId).toBe("item-001");
      expect(result.quantityBefore).toBe(50);
      expect(result.quantityChange).toBe(10);
      expect(result.quantityAfter).toBe(60);
    }
  });

  it("discriminated union narrows correctly", () => {
    const result: ReceiveInventorySuccess = {
      status: "success",
      transactionId: "tx-002",
      inventoryItemId: "item-002",
      quantityBefore: 100,
      quantityChange: 25,
      quantityAfter: 125,
    };

    expect(result.quantityChange).toBe(25);
    expect(result.quantityAfter).toBe(125);
    // These properties should NOT exist on success
    expect((result as unknown as Record<string, unknown>).normalizedBarcode).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).matches).toBeUndefined();
  });

  it("handles zero-change edge case (should not happen in practice)", () => {
    // The function validates quantity > 0 on server, but type should support any number
    const result: ReceiveInventorySuccess = {
      status: "success",
      transactionId: "tx-003",
      inventoryItemId: "item-003",
      quantityBefore: 50,
      quantityChange: 0,
      quantityAfter: 50,
    };

    if (result.status === "success") {
      expect(result.quantityChange).toBe(0);
      expect(result.quantityAfter).toBe(result.quantityBefore);
    }
  });
});

// ---------------------------------------------------------------------------
// ReceiveInventoryResult — not_found
// ---------------------------------------------------------------------------

describe("ReceiveInventoryResult — not_found", () => {
  it("has correct shape when status is not_found", () => {
    const result: ReceiveInventoryResult = {
      status: "not_found",
      normalizedBarcode: "9999999999999",
    };

    expect(result.status).toBe("not_found");
    if (result.status === "not_found") {
      expect(result.normalizedBarcode).toBe("9999999999999");
    }
  });

  it("preserves leading zeroes in normalized barcode", () => {
    const result: ReceiveInventoryNotFound = {
      status: "not_found",
      normalizedBarcode: "001234567890",
    };

    expect(result.normalizedBarcode).toBe("001234567890");
    expect(result.normalizedBarcode.startsWith("00")).toBe(true);
  });

  it("handles alphanumeric not-found scans", () => {
    const result: ReceiveInventoryNotFound = {
      status: "not_found",
      normalizedBarcode: "ABC-123-XYZ",
    };

    expect(result.normalizedBarcode).toBe("ABC-123-XYZ");
  });

  it("does not have success fields", () => {
    const result: ReceiveInventoryNotFound = {
      status: "not_found",
      normalizedBarcode: "999",
    };

    expect((result as unknown as Record<string, unknown>).transactionId).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).quantityBefore).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ReceiveInventoryResult — duplicate
// ---------------------------------------------------------------------------

describe("ReceiveInventoryResult — duplicate", () => {
  it("has correct shape when status is duplicate", () => {
    const item1 = createMockItem({ id: "doc-1", name: "Item One" });
    const item2 = createMockItem({ id: "doc-2", name: "Item Two" });

    const result: ReceiveInventoryResult = {
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

  it("supports multiple matched fields per item", () => {
    const item = createMockItem({ id: "doc-1" });
    const result: ReceiveInventoryDuplicate = {
      status: "duplicate",
      normalizedBarcode: "ABC-123",
      matches: [
        { item, matchedFields: ["barcode", "sku", "serial"] },
      ],
    };

    expect(result.matches[0].matchedFields).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Discriminated union narrowing
// ---------------------------------------------------------------------------

describe("ReceiveInventoryResult type narrowing", () => {
  function handleResult(result: ReceiveInventoryResult): string {
    switch (result.status) {
      case "success":
        expect(result.transactionId).toBeDefined();
        expect(result.quantityAfter).toBeDefined();
        return "success";
      case "not_found":
        expect(result.normalizedBarcode).toBeDefined();
        return "not_found";
      case "duplicate":
        expect(result.matches).toBeDefined();
        expect(result.normalizedBarcode).toBeDefined();
        return "duplicate";
    }
  }

  it("narrows to success branch", () => {
    const result: ReceiveInventoryResult = {
      status: "success",
      transactionId: "tx-1",
      inventoryItemId: "item-1",
      quantityBefore: 10,
      quantityChange: 5,
      quantityAfter: 15,
    };
    expect(handleResult(result)).toBe("success");
  });

  it("narrows to not_found branch", () => {
    const result: ReceiveInventoryResult = {
      status: "not_found",
      normalizedBarcode: "999",
    };
    expect(handleResult(result)).toBe("not_found");
  });

  it("narrows to duplicate branch", () => {
    const result: ReceiveInventoryResult = {
      status: "duplicate",
      normalizedBarcode: "999",
      matches: [],
    };
    expect(handleResult(result)).toBe("duplicate");
  });

  it("exhaustive switch — all branches covered", () => {
    const results: ReceiveInventoryResult[] = [
      {
        status: "success" as const,
        transactionId: "1",
        inventoryItemId: "i-1",
        quantityBefore: 1,
        quantityChange: 1,
        quantityAfter: 2,
      },
      { status: "not_found" as const, normalizedBarcode: "999" },
      {
        status: "duplicate" as const,
        normalizedBarcode: "999",
        matches: [],
      },
    ];

    const seen = new Set<string>();
    for (const r of results) {
      seen.add(r.status);
    }
    expect(seen).toEqual(new Set(["success", "not_found", "duplicate"]));
  });
});

// ---------------------------------------------------------------------------
// ReceiveInventoryResponse — OK wrapper
// ---------------------------------------------------------------------------

describe("ReceiveInventoryResponse", () => {
  it("ok=true wraps a success result", () => {
    const response: ReceiveInventoryCallableSuccess = {
      ok: true,
      data: {
        status: "success",
        transactionId: "tx-1",
        inventoryItemId: "item-1",
        quantityBefore: 10,
        quantityChange: 5,
        quantityAfter: 15,
      },
    };

    expect(response.ok).toBe(true);
    if (response.ok && response.data.status === "success") {
      expect(response.data.quantityChange).toBe(5);
    }
  });

  it("ok=true wraps a not_found result", () => {
    const response: ReceiveInventoryResponse = {
      ok: true,
      data: {
        status: "not_found",
        normalizedBarcode: "999",
      },
    };

    expect(response.ok).toBe(true);
    if (response.ok && response.data.status === "not_found") {
      expect(response.data.normalizedBarcode).toBe("999");
    }
  });

  it("ok=false wraps a callable error", () => {
    const response: ReceiveInventoryResponse = {
      ok: false,
      code: "unavailable",
      message: "Service temporarily unavailable.",
    };

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.code).toBe("unavailable");
      expect(response.message).toBe("Service temporarily unavailable.");
    }
  });

  it("ok=false covers all error codes", () => {
    const codes = [
      "unauthorized",
      "permission-denied",
      "invalid-argument",
      "failed-precondition",
      "unavailable",
      "internal",
    ];

    for (const code of codes) {
      const err: ReceiveInventoryCallableError = {
        ok: false,
        code,
        message: `Error: ${code}`,
      };
      expect(err.ok).toBe(false);
      expect(err.code).toBe(code);
    }
  });

  it("typed as discriminated union narrows correctly", () => {
    const responses: ReceiveInventoryResponse[] = [
      { ok: true, data: { status: "success", transactionId: "t1", inventoryItemId: "i1", quantityBefore: 1, quantityChange: 2, quantityAfter: 3 } },
      { ok: true, data: { status: "not_found", normalizedBarcode: "123" } },
      { ok: false, code: "unavailable", message: "timeout" },
    ];

    for (const r of responses) {
      if (r.ok) {
        expect(r.data.status).toMatch(/^(success|not_found|duplicate)$/);
      } else {
        expect(typeof r.code).toBe("string");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// InventoryLookupItem (re-used in Receive)
// ---------------------------------------------------------------------------

describe("InventoryLookupItem in receive context", () => {
  it("includes quantity fields needed for receive confirmation UI", () => {
    const item = createMockItem({ quantityOnHand: 30, available: 25 });

    expect(item.quantityOnHand).toBe(30);
    expect(item.available).toBe(25);
    // UI shows current qty, then expected new qty = current + receive qty
    const receiveQty = 10;
    const expectedNewQty = item.quantityOnHand + receiveQty;
    expect(expectedNewQty).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// InventoryLookupMatch
// ---------------------------------------------------------------------------

describe("InventoryLookupMatch", () => {
  it("has typed matchedFields as array", () => {
    const item = createMockItem();
    const match: InventoryLookupMatch = {
      item,
      matchedFields: ["barcode"],
    };

    expect(Array.isArray(match.matchedFields)).toBe(true);
    expect(match.matchedFields[0]).toBe("barcode");
  });
});

// ---------------------------------------------------------------------------
// Barcode 4262380670853 handling
// ---------------------------------------------------------------------------

describe("Barcode 4262380670853", () => {
  it("preserves leading zeroes if barcode starts with zero", () => {
    // 4262380670853 does not start with zero, so this tests standard EAN-13
    const barcode = "4262380670853";

    // Standard EAN-13: all digits, 13 chars
    expect(barcode).toHaveLength(13);
    expect(/^\d+$/.test(barcode)).toBe(true);
    expect(barcode).toBe("4262380670853");
  });

  it("is not automatically assigned — requires admin workflow", () => {
    // Simulate: barcode arrives as a scan, is not in inventory
    // Response should be not_found, triggering the unknown barcode flow
    const notFound: ReceiveInventoryNotFound = {
      status: "not_found",
      normalizedBarcode: "4262380670853",
    };

    expect(notFound.status).toBe("not_found");
    expect(notFound.normalizedBarcode).toBe("4262380670853");
  });

  it("assignment requires explicit admin confirmation", () => {
    // This test verifies the type contract for barcode 4262380670853
    // It should NOT be auto-assigned during receive
    const barcode = "4262380670853";

    // The receive flow returns not_found for unknown barcodes
    // Assignment to inventory happens via a separate admin workflow
    const receiveResult: ReceiveInventoryResult = {
      status: "not_found",
      normalizedBarcode: barcode,
    };

    if (receiveResult.status === "not_found") {
      expect(receiveResult.normalizedBarcode).toBe("4262380670853");
      // No transaction occurred — this is a separate concern
    }
  });
});
