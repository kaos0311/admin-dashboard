import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitChunkedWithCustomBuilder } from "@/lib/firestoreWriteQueue";

function runValidator(root: string) {
  return execFileSync("node", ["scripts/validate-inventory-writes.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      INVENTORY_WRITE_VALIDATION_ROOT: root,
    },
    stdio: "pipe",
  });
}

describe("inventory write validation", () => {
  it("fails when direct Firestore writes mutate protected inventory fields", () => {
    const root = mkdtempSync(join(tmpdir(), "inventory-write-validation-"));
    writeFileSync(
      join(root, "bad.ts"),
      `
        import { doc, updateDoc } from "firebase/firestore";
        async function bad(db: unknown) {
          await updateDoc(doc(db as never, "inventory", "abc"), {
            quantityOnHand: 5,
            available: 5,
          });
        }
      `,
    );

    expect(() => runValidator(root)).toThrow();
  });

  it("fails when generic safe actions mutate protected inventory fields", () => {
    const root = mkdtempSync(join(tmpdir(), "inventory-write-validation-"));
    writeFileSync(
      join(root, "bad-generic.ts"),
      `
        import { doc } from "firebase/firestore";
        import { safeUpdateDocument } from "@/lib/firestoreSafeActions";
        async function bad(db: unknown) {
          await safeUpdateDocument(doc(db as never, "inventory", "abc"), {
            patientName: "Jane Doe",
          });
        }
      `,
    );

    expect(() => runValidator(root)).toThrow();
  });

  it("fails when queued inventory writes include protected fields", () => {
    const root = mkdtempSync(join(tmpdir(), "inventory-write-validation-"));
    writeFileSync(
      join(root, "bad-queue.ts"),
      `
        import { commitChunkedSets } from "@/lib/firestoreWriteQueue";
        async function bad(db: never) {
          await commitChunkedSets(db, "inventory", [{
            status: "discontinued",
          }]);
        }
      `,
    );

    expect(() => runValidator(root)).toThrow();
  });

  it("fails when custom queued inventory writes include protected fields", () => {
    const root = mkdtempSync(join(tmpdir(), "inventory-write-validation-"));
    writeFileSync(
      join(root, "bad-custom-queue.ts"),
      `
        import { doc } from "firebase/firestore";
        import { commitChunkedWithCustomBuilder } from "@/lib/firestoreWriteQueue";
        async function bad(db: never) {
          await commitChunkedWithCustomBuilder(db, [{ id: "abc", quantityOnHand: 5 }], (batch, item) => {
            batch.update(doc(db, "inventory", item.id), { quantityOnHand: item.quantityOnHand });
          });
        }
      `,
    );

    expect(() => runValidator(root)).toThrow();
  });

  it("allows metadata-only inventory writes", () => {
    const root = mkdtempSync(join(tmpdir(), "inventory-write-validation-"));
    writeFileSync(
      join(root, "good.ts"),
      `
        import { doc, updateDoc } from "firebase/firestore";
        async function good(db: unknown) {
          await updateDoc(doc(db as never, "inventory", "abc"), {
            name: "Oxygen Concentrator",
            notes: "Updated label",
          });
        }
      `,
    );

    expect(() => runValidator(root)).not.toThrow();
  });

  it("requires runtime validation for custom chunked builders", async () => {
    await expect(
      commitChunkedWithCustomBuilder(
        {} as never,
        [{ id: "abc", quantityOnHand: 5 }],
        () => undefined
      )
    ).rejects.toThrow(/requires validateItem/);
  });
});
