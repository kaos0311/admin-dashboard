import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assertFails,
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

async function seedOrderStaffProfile() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc("staff-001").set({
      role: "staff",
      active: true,
      disabled: false,
      deleted: false,
    });
  });
}

async function seedOrderAdminProfile() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc("admin-001").set({
      role: "admin",
      active: true,
      disabled: false,
      deleted: false,
    });
  });
}

const seedOrderFull = {
  patientName: "Test Patient",
  patientAddress: "123 Test St",
  productId: "product-test",
  productType: "Wheelchair",
  purchaseCost: 250,
  quantity: 2,
  barcode: "BC-001",
  phone: "555-0100",
  facilityName: "Facility A",
  notes: "Leave at door",
  status: "processing",
  inventoryAllocated: false,
  inventoryRestored: false,
  inventoryAllocations: [],
  inventoryAllocationSourceId: "",
  createdBy: "workflow@example.com",
  createdByUid: "workflow-actor",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedBy: "workflow@example.com",
  updatedByUid: "workflow-actor",
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  patientKey: "test patient|addr:123testst",
  orderKey: "test patient wheelchair",
  searchText: "test patient",
  normalizedName: "test patient",
  normalizedDob: "",
  normalizedPhone: "",
  normalizedAddress: "123 test st",
  needsReview: false,
  reviewReasons: [],
  smartRouteTargets: ["orders", "patients", "analytics"],
  linkedPatientId: "",
  linkedInventoryId: "product-test",
  isHospice: false,
};

const clientEditableCreate = {
  patientName: "New Patient",
  patientAddress: "456 Other St",
  productId: "product-new",
  productType: "Walker",
  purchaseCost: 100,
  quantity: 1,
  barcode: "BC-NEW",
  phone: "555-0200",
  facilityName: "Facility B",
  notes: "Front desk",
  isHospice: false,
  linkedInventoryId: "product-new",
  dob: "1980-01-01",
  insurance: "Medicare",
  salesOrderNumber: "SO-001",
  customerId: "C-001",
  sourceImportId: "",
  sourceReportType: "",
};

const clientEditableUpdate = {
  patientName: "Renamed Patient",
  patientAddress: "789 Changed St",
  productType: "Rollator",
  purchaseCost: 120,
  barcode: "BC-CHANGED",
  phone: "555-0300",
  facilityName: "Facility C",
  notes: "Updated note",
};

describe("orders firestore rules security boundary", () => {
  it("staff can read orders", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    const snap = await db.collection("orders").doc("order-001").get();
    expect(snap.exists).toBe(true);
  });

  it("admin can read orders", async () => {
    await seedOrderAdminProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("admin-001", { role: "admin" }).firestore();
    const snap = await db.collection("orders").doc("order-001").get();
    expect(snap.exists).toBe(true);
  });

  it("denies unauthenticated read of orders", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection("orders").doc("order-001").get());
  });

  it("denies client create of an order even with only client-editable fields", async () => {
    await seedOrderStaffProfile();
    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(db.collection("orders").add(clientEditableCreate));
  });

  it("denies client update of any order field, including ordinary fields", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(
      db.collection("orders").doc("order-001").update(clientEditableUpdate),
    );
  });

  it("denies client status change on an order", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(
      db.collection("orders").doc("order-001").update({ status: "cancelled" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ status: "ready" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ status: "delivered" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ status: "archived" }),
    );
  });

  it("denies client mutation of protected/system fields", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(
      db.collection("orders").doc("order-001").update({ inventoryAllocated: true }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ inventoryRestored: true }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ needsReview: true }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ updatedByUid: "hacker" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ archivedAt: new Date() }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ archivedByUid: "hacker" }),
    );
  });

  it("denies client rewrite of immutable provenance fields", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(
      db.collection("orders").doc("order-001").update({ createdBy: "attacker@example.com" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ createdByUid: "attacker-uid" }),
    );
    await assertFails(
      db.collection("orders").doc("order-001").update({ createdAt: new Date() }),
    );
  });

  it("denies client delete of an order", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(db.collection("orders").doc("order-001").delete());
  });

  it("denies arbitrary unrecognized field injection on create and update", async () => {
    await seedOrderStaffProfile();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("orders").doc("order-001").set(seedOrderFull);
    });

    const db = testEnv.authenticatedContext("staff-001", { role: "staff" }).firestore();
    await assertFails(
      db.collection("orders").doc("order-001").update({ arbitraryEvilField: "pwned" }),
    );
    await assertFails(
      db.collection("orders").add({
        ...clientEditableCreate,
        arbitraryEvilField: "pwned",
      }),
    );
  });
});
