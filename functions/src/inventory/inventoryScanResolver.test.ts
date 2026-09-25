import { describe, expect, it } from "vitest";
import { type Firestore } from "firebase-admin/firestore";

import {
  DEFAULT_INVENTORY_SCAN_FIELDS,
  type InventoryScanField,
  normalizeScanValue,
  resolveInventoryScan,
} from "./inventoryScanResolver.js";

type InventoryRow = Record<string, unknown>;

function fakeFirestore(rows: Record<string, InventoryRow>): Firestore {
  const makeDoc = (id: string, data: InventoryRow) => ({
    id,
    exists: true,
    data: () => data,
  });

  const makeQuery = (filters: Array<[string, string, unknown]> = []) => {
    const query = {
      where(field: string, op: string, value: unknown) {
        return makeQuery([...filters, [field, op, value]]);
      },
      limit() {
        return query;
      },
      async get() {
        const docs = Object.entries(rows)
          .filter(([, data]) =>
            filters.every(([field, op, value]) => {
              if (op === "==") return data[field] === value;
              if (op === "!=") return data[field] !== value;
              throw new Error(`Unsupported fake query op ${op}`);
            }),
          )
          .map(([id, data]) => makeDoc(id, data));

        return { docs };
      },
    };
    return query;
  };

  return {
    collection() {
      return {
        doc(id: string) {
          return {
            async get() {
              const data = rows[id];
              return data
                ? makeDoc(id, data)
                : { id, exists: false, data: () => undefined };
            },
          };
        },
        where(field: string, op: string, value: unknown) {
          return makeQuery([[field, op, value]]);
        },
      };
    },
  } as unknown as Firestore;
}

async function resolve(
  rows: Record<string, InventoryRow>,
  scan: string,
  fields: InventoryScanField[] = DEFAULT_INVENTORY_SCAN_FIELDS,
) {
  return resolveInventoryScan(fakeFirestore(rows), scan, {
    fields,
    includeDocumentId: true,
  });
}

describe("inventoryScanResolver", () => {
  it("normalizes whitespace, scanner suffix characters, and casing without stripping leading zeroes", () => {
    const parsed = normalizeScanValue("  00123a\r\n\t");

    expect(parsed.status).toBe("valid");
    expect(parsed.value).toBe("00123a");
  });

  it("resolves barcode exact matches", async () => {
    const result = await resolve({ inv1: { barcode: "BC-1", isDeleted: false } }, "BC-1");

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "inv1",
      matchedFields: ["barcode"],
    });
  });

  it("resolves serial exact matches", async () => {
    const result = await resolve({ inv1: { serial: "SN-1", isDeleted: false } }, "SN-1");

    expect(result.kind).toBe("resolved");
    expect(result.kind === "resolved" ? result.matchedFields : []).toEqual(["serial"]);
  });

  it("resolves lot and SKU matches when supported by the field set", async () => {
    const lot = await resolve({ lot1: { lotNumber: "LOT-7", isDeleted: false } }, "LOT-7");
    const sku = await resolve({ sku1: { sku: "SKU-9", isDeleted: false } }, "SKU-9");

    expect(lot).toMatchObject({ kind: "resolved", inventoryItemId: "lot1" });
    expect(sku).toMatchObject({ kind: "resolved", inventoryItemId: "sku1" });
  });

  it("resolves explicit inventory document IDs when enabled", async () => {
    const result = await resolve({ "doc-1": { name: "Known", isDeleted: false } }, "doc-1");

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "doc-1",
      matchedFields: ["id"],
    });
  });

  it("returns not_found for unmatched scans", async () => {
    const result = await resolve({ inv1: { barcode: "BC-1", isDeleted: false } }, "missing");

    expect(result).toEqual({ kind: "not_found", normalizedScan: "missing" });
  });

  it("fails closed on duplicate matches", async () => {
    const result = await resolve(
      {
        inv1: { barcode: "DUP", isDeleted: false },
        inv2: { serial: "DUP", isDeleted: false },
      },
      "DUP",
    );

    expect(result).toMatchObject({
      kind: "ambiguous",
      candidateIds: ["inv1", "inv2"],
    });
  });

  it("filters deleted records", async () => {
    const result = await resolve(
      {
        deleted: { barcode: "BC-1", isDeleted: true },
        active: { barcode: "BC-1", isDeleted: false },
      },
      "BC-1",
    );

    expect(result).toMatchObject({ kind: "resolved", inventoryItemId: "active" });
  });

  it("resolves a matching legacy inventory record when isDeleted is missing", async () => {
    const result = await resolve(
      { legacy: { barcode: "LEGACY-NO-DELETE-FLAG" } },
      "LEGACY-NO-DELETE-FLAG",
    );

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "legacy",
    });
  });

  it("resolves a matching inventory record when both deletion flags are missing", async () => {
    const result = await resolve(
      { legacy: { serial: "LEGACY-NO-DELETE-FIELDS" } },
      "LEGACY-NO-DELETE-FIELDS",
    );

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "legacy",
    });
  });

  it("excludes deleted === true records", async () => {
    const result = await resolve(
      { deleted: { barcode: "DELETED-MARKER", deleted: true } },
      "DELETED-MARKER",
    );

    expect(result).toEqual({
      kind: "not_found",
      normalizedScan: "DELETED-MARKER",
    });
  });

  it("resolves an eligible legacy record when a deleted record also matches", async () => {
    const result = await resolve(
      {
        deleted: { barcode: "MIXED-DELETE", isDeleted: true },
        legacy: { serial: "MIXED-DELETE" },
      },
      "MIXED-DELETE",
    );

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "legacy",
    });
  });

  it("fails closed when two eligible missing-flag legacy records match", async () => {
    const result = await resolve(
      {
        legacyA: { barcode: "LEGACY-DUP" },
        legacyB: { serial: "LEGACY-DUP" },
      },
      "LEGACY-DUP",
    );

    expect(result).toMatchObject({
      kind: "ambiguous",
      candidateIds: ["legacyA", "legacyB"],
    });
  });

  it("applies deletion semantics to explicit document-ID resolution", async () => {
    const legacy = await resolve({ legacyDoc: { name: "Legacy" } }, "legacyDoc");
    const isDeleted = await resolve(
      { deletedDoc: { name: "Deleted", isDeleted: true } },
      "deletedDoc",
    );
    const deleted = await resolve(
      { removedDoc: { name: "Removed", deleted: true } },
      "removedDoc",
    );

    expect(legacy).toMatchObject({
      kind: "resolved",
      inventoryItemId: "legacyDoc",
    });
    expect(isDeleted).toEqual({
      kind: "not_found",
      normalizedScan: "deletedDoc",
    });
    expect(deleted).toEqual({
      kind: "not_found",
      normalizedScan: "removedDoc",
    });
  });

  it("does not treat multiple fields on the same inventory document as ambiguity", async () => {
    const result = await resolve(
      { inv1: { barcode: "SAME", serial: "SAME", sku: "SAME", isDeleted: false } },
      "SAME",
    );

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "inv1",
    });
    expect(result.kind === "resolved" ? result.matchedFields.sort() : []).toEqual([
      "barcode",
      "serial",
      "sku",
    ]);
  });

  it("fails closed when different records match different supported fields", async () => {
    const result = await resolve(
      {
        inv1: { barcode: "CROSS", isDeleted: false },
        inv2: { sku: "CROSS", isDeleted: false },
      },
      "CROSS",
    );

    expect(result.kind).toBe("ambiguous");
  });

  it("resolves serialized identifier records through serialNumber when supported", async () => {
    const result = await resolve(
      { serial1: { serialNumber: "SN-22", isSerialized: true, isDeleted: false } },
      "SN-22",
    );

    expect(result).toMatchObject({
      kind: "resolved",
      inventoryItemId: "serial1",
      matchedFields: ["serialNumber"],
    });
  });

  it("resolves quantity inventory by barcode without requiring serialized fields", async () => {
    const result = await resolve(
      { qty1: { barcode: "BOX-1", quantityOnHand: 12, isDeleted: false } },
      "BOX-1",
    );

    expect(result).toMatchObject({ kind: "resolved", inventoryItemId: "qty1" });
  });

  it("supports caller-selected manufacturer item matching without making it default", async () => {
    const rows = { inv1: { manufacturerItemId: "MFG-1", isDeleted: false } };
    const defaultResult = await resolve(rows, "MFG-1");
    const movementResult = await resolve(rows, "MFG-1", [
      ...DEFAULT_INVENTORY_SCAN_FIELDS,
      "manufacturerItemId",
    ]);

    expect(defaultResult.kind).toBe("not_found");
    expect(movementResult).toMatchObject({
      kind: "resolved",
      inventoryItemId: "inv1",
      matchedFields: ["manufacturerItemId"],
    });
  });
});
