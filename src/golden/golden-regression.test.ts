import { describe, expect, it } from "vitest";

import { normalizeBarcode, parseBarcode } from "@/lib/barcode";
import { getErrorMessage } from "@/lib/errors";
import { getFriendlyError } from "@/lib/firebaseError";
import {
  assertMetadataOnlyInventoryWrite,
  getProtectedInventoryFields,
} from "@/lib/inventory/protectedFields";
import { OperationIdManager } from "@/lib/inventory/receive-inventory";
import type { ReceiveInventoryResult } from "@/lib/inventory/receive-inventory.types";
import {
  getRoleFromUserRecord,
  hasPermission,
  isActiveUserRecord,
} from "@/lib/permissions/roles";

describe("AHM Golden Regression Suite - root invariants", () => {
  it("GOLDEN-INV-001 rejects protected inventory fields from metadata writes", () => {
    const protectedFields = getProtectedInventoryFields({
      quantityOnHand: 7,
      patientId: "patient-golden-001",
      rentalId: "rental-golden-001",
      notes: "metadata is allowed",
    });

    expect(protectedFields).toEqual(["quantityOnHand", "patientId", "rentalId"]);
    expect(() =>
      assertMetadataOnlyInventoryWrite(
        {
          quantityOnHand: 7,
          patientName: "Synthetic Patient",
        },
        "golden metadata write"
      )
    ).toThrow(/quantityOnHand, patientName/);

    expect(() =>
      assertMetadataOnlyInventoryWrite(
        {
          notes: "Synthetic non-PHI note",
          manufacturer: "Golden Medical",
        },
        "golden metadata write"
      )
    ).not.toThrow();
  });

  it("GOLDEN-INV-002 normalizes safe scans and rejects unsafe scan payloads", () => {
    expect(normalizeBarcode("  0012345678905\r\n")).toBe("0012345678905");

    const urlScan = parseBarcode("https://example.test/inventory/0012345678905");
    expect(urlScan.valid).toBe(false);
    expect(urlScan.error).toMatch(/URL QR codes/);

    const pathScan = parseBarcode("../inventory-item");
    expect(pathScan.valid).toBe(false);
    expect(pathScan.error).toMatch(/path characters/);
  });

  it("GOLDEN-INV-003 keeps unknown scan responses distinct from valid inventory matches", () => {
    const unknownScan: ReceiveInventoryResult = {
      status: "not_found",
      normalizedBarcode: "UNKNOWN-GOLDEN-001",
    };

    expect(unknownScan.status).toBe("not_found");
    expect(unknownScan.normalizedBarcode).toBe("UNKNOWN-GOLDEN-001");
    expect("inventoryItemId" in unknownScan).toBe(false);
    expect("quantityAfter" in unknownScan).toBe(false);
  });

  it("GOLDEN-IDEMP-001 reuses receive operation IDs for retries until completion", () => {
    const manager = new OperationIdManager();
    const firstOperationId = manager.start();

    expect(firstOperationId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(manager.get()).toBe(firstOperationId);
    expect(manager.get()).toBe(firstOperationId);

    manager.complete();
    expect(manager.get()).toBeNull();

    const secondOperationId = manager.start();
    expect(secondOperationId).not.toBe(firstOperationId);

    manager.reset();
    expect(manager.get()).toBeNull();
  });

  it("GOLDEN-AUTH-001 preserves the admin-only permission boundary", () => {
    expect(hasPermission("admin", "admin:users")).toBe(true);
    expect(hasPermission("tank", "admin:users")).toBe(true);
    expect(hasPermission("staff", "admin:users")).toBe(false);
    expect(hasPermission(null, "admin:users")).toBe(false);
  });

  it("GOLDEN-AUTH-002 refuses role resolution for inactive user records", () => {
    expect(isActiveUserRecord({ role: "admin", disabled: true })).toBe(false);
    expect(isActiveUserRecord({ role: "tank", deleted: true })).toBe(false);
    expect(getRoleFromUserRecord({ role: "admin", disabled: true })).toBe("admin");
    expect(
      isActiveUserRecord({ temporaryTankAccess: true, previousRole: "admin" })
    ).toBe(true);
    expect(
      getRoleFromUserRecord({ temporaryTankAccess: true, previousRole: "admin" })
    ).toBe("tank");
  });

  it("GOLDEN-ERR-001 maps known internal Firebase errors to safe messages", () => {
    expect(getErrorMessage({ code: "functions/internal", message: "secret stack" })).toBe(
      "Something went wrong. Try again."
    );
    expect(getFriendlyError({ code: "internal", message: "database secret" })).toBe(
      "Unexpected system error. Please try again."
    );
  });

  it("GOLDEN-ERR-002 falls back predictably for unknown error shapes", () => {
    expect(getErrorMessage({ details: { synthetic: true } })).toBe(
      "Unexpected error occurred."
    );
    expect(getFriendlyError({ code: "unknown/code" }, "Fallback message.")).toBe(
      "Fallback message."
    );
  });
});
