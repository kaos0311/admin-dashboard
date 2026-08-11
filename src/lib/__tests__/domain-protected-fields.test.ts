import { describe, expect, it } from "vitest";

import {
  assertDraftRentalCreate,
  assertMetadataOnlyDomainWrite,
  getProtectedDomainFields,
} from "@/lib/domain/protectedFields";

describe("domain protected field guards", () => {
  it("rejects protected rental workflow fields", () => {
    expect(() =>
      assertMetadataOnlyDomainWrite(
        "rentals/rental-1",
        {
          exchangeCheckoutMovementId: "movement-2",
          exchangedAt: "2026-08-06T12:00:00.000Z",
          patientId: "patient-1",
          notes: "changed",
        },
        "test"
      )
    ).toThrow(/protected domain workflow fields/);
  });

  it("allows draft rental metadata creation", () => {
    expect(() =>
      assertDraftRentalCreate(
        { status: "draft", productName: "Oxygen Concentrator", notes: "intake" },
        "test"
      )
    ).not.toThrow();
  });

  it("rejects non-draft rental creates", () => {
    expect(() =>
      assertDraftRentalCreate(
        { status: "available", productName: "Oxygen Concentrator" },
        "test"
      )
    ).toThrow(/draft rental metadata/);
  });

  it("rejects protected patient-equipment workflow fields", () => {
    expect(
      getProtectedDomainFields("patients/patient-1/equipment/asset-1", {
        status: "active",
        deliveryTicketId: "ticket-1",
        transferredFromPatientId: "patient-0",
        replacesInventoryItemId: "asset-0",
        note: "manual note",
      })
    ).toEqual([
      "status",
      "deliveryTicketId",
      "transferredFromPatientId",
      "replacesInventoryItemId",
    ]);
  });

  it("does not treat ordinary patient updates as patient-equipment writes", () => {
    expect(
      getProtectedDomainFields("patients/patient-1", {
        status: "active",
        notes: "changed",
      })
    ).toEqual([]);
  });
});
