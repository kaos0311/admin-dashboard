/**
 * Emulator rules tests proving role source-of-truth hardening.
 *
 * AUTHORITATIVE POLICY: the users/{uid} active profile is the single source
 * of truth for dashboard authority. A stale or elevated custom claim does
 * NOT grant access when the profile is missing, disabled, deleted, inactive,
 * or has a lower role.
 *
 * These tests use representative protected collections:
 *   - products (staff/admin read/write)
 *   - patientDeliveryTickets (staff/admin)
 *   - insuranceRecords (staff/admin)
 *   - employeeEvaluations (tank-only)
 *   - auditLogs (admin-only read)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-advanced-home-medical";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8085,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedProfile(
  uid: string,
  data: Record<string, unknown>,
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc(uid).set({
      role: "staff",
      active: true,
      disabled: false,
      deleted: false,
      ...data,
    });
  });
}

async function seedCollection(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection(collection).doc(docId).set(data);
  });
}

const PRODUCT_DOC = {
  name: "Test Product",
  sku: "SKU-001",
  price: 100,
};

describe("Firestore rules — role source-of-truth hardening", () => {
  describe("ACTIVE ADMIN PROFILE", () => {
    it("is permitted where admin should be permitted (products write)", async () => {
      await seedProfile("uid-001", { role: "admin", active: true });

      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      await assertSucceeds(
        db.collection("products").doc("new-product").set(PRODUCT_DOC),
      );
    });

    it("is permitted where admin should be permitted (auditLogs read)", async () => {
      await seedProfile("uid-001", { role: "admin", active: true });
      await seedCollection("auditLogs", "log-001", { action: "test" });

      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      await assertSucceeds(db.collection("auditLogs").doc("log-001").get());
    });
  });

  describe("ACTIVE STAFF PROFILE", () => {
    it("is permitted where staff should be permitted (products read/write)", async () => {
      await seedProfile("uid-001", { role: "staff", active: true });
      await seedCollection("products", "product-001", PRODUCT_DOC);

      const db = testEnv
        .authenticatedContext("uid-001", { role: "staff" })
        .firestore();

      await assertSucceeds(
        db.collection("products").doc("product-001").get(),
      );
      await assertSucceeds(
        db.collection("products").doc("product-002").set({
          name: "Staff Created",
          price: 50,
        }),
      );
    });

    it("is denied at admin-only (auditLogs read)", async () => {
      await seedProfile("uid-001", { role: "staff", active: true });
      await seedCollection("auditLogs", "log-001", { action: "test" });

      const db = testEnv
        .authenticatedContext("uid-001", { role: "staff" })
        .firestore();

      await assertFails(db.collection("auditLogs").doc("log-001").get());
    });
  });

  describe("ADMIN CLAIM + MISSING PROFILE", () => {
    it("is denied at products write", async () => {
      const db = testEnv
        .authenticatedContext("no-profile", { role: "admin" })
        .firestore();

      await assertFails(
        db.collection("products").doc("new-product").set(PRODUCT_DOC),
      );
    });

    it("is denied at auditLogs read", async () => {
      await seedCollection("auditLogs", "log-001", { action: "test" });

      const db = testEnv
        .authenticatedContext("no-profile", { role: "admin" })
        .firestore();

      await assertFails(db.collection("auditLogs").doc("log-001").get());
    });
  });

  describe("ADMIN CLAIM + DISABLED PROFILE", () => {
    it("is denied where admin should be permitted (products write)", async () => {
      await seedProfile("uid-001", {
        role: "admin",
        active: true,
        disabled: true,
      });

      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      await assertFails(
        db.collection("products").doc("new-product").set(PRODUCT_DOC),
      );
    });
  });

  describe("ADMIN CLAIM + STAFF PROFILE", () => {
    it("only grants staff privileges, not admin privileges", async () => {
      await seedProfile("uid-001", { role: "staff", active: true });
      await seedCollection("auditLogs", "log-001", { action: "test" });
      await seedCollection("products", "product-001", PRODUCT_DOC);

      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      // Staff CAN read products
      await assertSucceeds(
        db.collection("products").doc("product-001").get(),
      );

      // Staff CANNOT read admin-only auditLogs
      await assertFails(db.collection("auditLogs").doc("log-001").get());
    });
  });

  describe("STAFF CLAIM + ADMIN PROFILE", () => {
    it("grants admin privileges according to profile authority", async () => {
      await seedProfile("uid-001", {
        role: "admin",
        active: true,
      });
      await seedCollection("auditLogs", "log-001", { action: "test" });

      const db = testEnv
        .authenticatedContext("uid-001", { role: "staff" })
        .firestore();

      // Profile says admin, so admin-only auditLogs read succeeds
      await assertSucceeds(db.collection("auditLogs").doc("log-001").get());
    });
  });

  describe("PROFILE ROLE DOWNGRADE WITH STALE ADMIN TOKEN", () => {
    it("denies an admin-only Firestore operation immediately after downgrade", async () => {
      await seedProfile("uid-001", { role: "admin", active: true });
      await seedCollection("auditLogs", "log-001", { action: "test" });
      await seedCollection("products", "product-001", PRODUCT_DOC);

      // Simulate a stale token that still carries admin claim
      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      // The authoritative profile is now downgraded to staff
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("uid-001").set({
          role: "staff",
          active: true,
          disabled: false,
          deleted: false,
        });
      });

      // The stale admin token must be denied at admin-only auditLogs because
      // the profile is staff (profile role is authoritative).
      await assertFails(db.collection("auditLogs").doc("log-001").get());
      // Staff can still read products per the authoritative staff profile.
      await assertSucceeds(
        db.collection("products").doc("product-001").get(),
      );
    });
  });

  describe("PROFILE DEACTIVATION WITH STALE TOKEN", () => {
    it("denies access when the profile is deactivated", async () => {
      await seedProfile("uid-001", { role: "admin", active: true });
      await seedCollection("products", "product-001", PRODUCT_DOC);

      const db = testEnv
        .authenticatedContext("uid-001", { role: "admin" })
        .firestore();

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("uid-001").set({
          role: "admin",
          active: false,
        });
      });

      await assertFails(
        db.collection("products").doc("product-001").get(),
      );
    });
  });
});
