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

  it("catches direct protected rental writes", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad-rental.ts"),
      `
        import { doc, updateDoc } from "firebase/firestore";
        await updateDoc(doc(db, "rentals", "rental-1"), {
          status: "checked_out",
          patientId: "patient-1",
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

  it("catches direct protected rental exchange writes", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad-rental-exchange.ts"),
      `
        import { doc, updateDoc } from "firebase/firestore";
        await updateDoc(doc(db, "rentals", "rental-1"), {
          previousInventoryItemId: "old-asset",
          exchangedAt: serverTimestamp(),
          exchangeCheckoutMovementId: "movement-2",
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

  it("catches direct protected patient-equipment writes", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad-equipment.ts"),
      `
        import { collection, addDoc } from "firebase/firestore";
        await addDoc(collection(db, "patients", patientId, "equipment"), {
          inventoryId: "asset-1",
          status: "active",
          assignedAt: serverTimestamp(),
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

  it("catches protected rental writes through generic safe actions", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad-safe-action.ts"),
      `
        import { doc } from "firebase/firestore";
        import { safeUpdateDocument } from "@/lib/firestoreSafeActions";
        await safeUpdateDocument(doc(db, "rentals", "rental-1"), {
          movementId: "movement-1",
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

  it("catches protected rental writes through chunked queues", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "bad-queue.ts"),
      `
        import { commitChunkedSets } from "@/lib/firestoreWriteQueue";
        await commitChunkedSets(db, "rentals", [{
          status: "available",
          patientName: "Jane Doe",
        }]);
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

  it("allows guarded draft rental metadata creates", () => {
    const root = mkdtempSync(join(tmpdir(), "domain-write-validation-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "good-draft-rental.ts"),
      `
        import { collection, addDoc } from "firebase/firestore";
        import { assertDraftRentalCreate } from "@/lib/domain/protectedFields";
        const draftRental = {
          productName: "Oxygen Concentrator",
          status: "draft",
          notes: "intake only",
        };
        assertDraftRentalCreate(draftRental, "test");
        await addDoc(collection(db, "rentals"), draftRental);
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
    ).not.toThrow();
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
