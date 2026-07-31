import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("domain workflow write validation", () => {
  it("catches prohibited direct delivery workflow writes", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad.ts"),
      `
        import { doc, updateDoc } from "firebase/firestore";
        await updateDoc(doc(db, "patientDeliveryTickets", "ticket-1"), {
          deliveredScanCount: 1,
          fulfillmentStatus: "delivered",
        });
      `
    );

    expect(() =>
      execFileSync("node", [join(process.cwd(), "scripts/validate-domain-writes.cjs")], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DOMAIN_WRITE_VALIDATION_ROOT: root,
        },
      })
    ).toThrow();
  });

  it("catches prohibited two-phase rental checkout calls", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad.ts"),
      `
        import { checkoutRentalWorkflow } from "@/lib/domainWorkflows";
        await checkoutRentalWorkflow({
          operationId: "rental-checkout-abc12345",
          rentalId: "rental-1",
          inventoryItemId: "asset-1",
        });
      `
    );

    expect(() =>
      execFileSync("node", [join(process.cwd(), "scripts/validate-domain-writes.cjs")], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DOMAIN_WRITE_VALIDATION_ROOT: root,
        },
      })
    ).toThrow();
  });

  it("declares required rental workflow composite indexes", () => {
    const indexes = JSON.parse(readFileSync(join(process.cwd(), "firestore.indexes.json"), "utf8")) as {
      indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string }> }>;
    };

    expect(indexes.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionGroup: "rentals",
          fields: expect.arrayContaining([
            expect.objectContaining({ fieldPath: "patientId" }),
            expect.objectContaining({ fieldPath: "status" }),
          ]),
        }),
        expect.objectContaining({
          collectionGroup: "patientDeliveryTickets",
          fields: expect.arrayContaining([
            expect.objectContaining({ fieldPath: "patientKey" }),
            expect.objectContaining({ fieldPath: "fulfillmentStatus" }),
          ]),
        }),
      ])
    );
  });
});
