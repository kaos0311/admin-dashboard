import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

    expect(() =>
      execFileSync("node", ["scripts/validate-inventory-writes.cjs"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          INVENTORY_WRITE_VALIDATION_ROOT: root,
        },
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
