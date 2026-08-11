import { describe, expect, it } from "vitest";

import {
  assertMetadataOnlyInventoryWrite,
  getProtectedInventoryFields,
  isInventoryCollectionPath,
} from "./protectedFields";

describe("protected inventory field guard", () => {
  it("allows metadata-only inventory payloads", () => {
    expect(() =>
      assertMetadataOnlyInventoryWrite(
        { name: "Concentrator", notes: "Updated label" },
        "test"
      )
    ).not.toThrow();
  });

  it("rejects protected inventory state fields", () => {
    expect(() =>
      assertMetadataOnlyInventoryWrite(
        { quantityOnHand: 3, patientName: "Jane Doe" },
        "test"
      )
    ).toThrow(/quantityOnHand, patientName/);
  });

  it("detects inventory document paths", () => {
    expect(isInventoryCollectionPath("inventory")).toBe(true);
    expect(isInventoryCollectionPath("inventory/item-1")).toBe(true);
    expect(isInventoryCollectionPath("products/item-1")).toBe(false);
  });

  it("returns protected fields without including metadata", () => {
    expect(
      getProtectedInventoryFields({
        name: "Wheelchair",
        status: "discontinued",
        warehouseId: "warehouse-1",
      })
    ).toEqual(["status", "warehouseId"]);
  });
});
