import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  clearEmulatorData,
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "./test-utils/emulator-setup";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

let resetOperationalDatabase: any;

const ADMIN_UID = "reset-admin-001";
const STAFF_UID = "reset-staff-001";

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function callableRequest(data: Record<string, unknown>, authContext?: CallableAuthContext, ip = "127.0.0.1") {
  return {
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: { "x-forwarded-for": ip },
    },
  };
}

async function invokeResetOperationalDatabase(data: Record<string, unknown>, authContext?: CallableAuthContext): Promise<any> {
  const callable = resetOperationalDatabase as unknown as {
    run: (request: Record<string, unknown>) => Promise<any>;
  };
  return callable.run(callableRequest(data, authContext));
}

async function seedUser(uid: string, role: string, overrides: Record<string, unknown> = {}) {
  await db.collection("users").doc(uid).set({
    uid,
    email: `${uid}@example.test`,
    role,
    active: true,
    disabled: false,
    deleted: false,
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedCollection(collectionPath: string, count: number, overrides: Record<string, unknown> = {}) {
  const batch = db.batch();
  const baseDoc: Record<string, unknown> = {
    createdAt: Timestamp.now(),
    ...overrides,
  };

  for (let i = 0; i < count; i++) {
    const docRef = db.collection(collectionPath).doc();
    batch.set(docRef, { ...baseDoc, index: i });
  }

  await batch.commit();
}

async function countCollection(collectionPath: string): Promise<number> {
  const snapshot = await db.collection(collectionPath).count().get();
  return snapshot.data().count ?? 0;
}

const OPERATIONAL_COLLECTIONS = [
  "importJobs",
  "importedReports",
  "patients_index",
  "patients",
  "hospicePatients",
  "hospiceOversight",
  "insurancePatients",
  "insuranceRecords",
  "analytics",
  "orders",
  "rentals",
  "products",
  "inventory",
  "inventoryMovements",
  "wip",
  "reports",
  "reportRows",
  "deliveryReports",
  "patientReports",
  "insuranceReports",
  "hospiceReports",
];

beforeAll(async () => {
  process.env.RESET_OPERATIONAL_DATABASE_ALLOWED = "true";
  const mod = await import("./resetOperationalDatabase.js");
  resetOperationalDatabase = mod.resetOperationalDatabase;
});

afterAll(async () => {
  delete process.env.RESET_OPERATIONAL_DATABASE_ALLOWED;
});

beforeEach(async () => {
  await clearEmulatorData();
});

describe("resetOperationalDatabase emulator", () => {
  it("rejects unauthenticated requests", async () => {
    await expect(
      invokeResetOperationalDatabase({ confirmText: "RESET DATABASE" })
    ).rejects.toThrow(/You must be signed in/i);
  });

  it("rejects non-admin requests", async () => {
    await seedUser(STAFF_UID, "staff");

    await expect(
      invokeResetOperationalDatabase(
        { confirmText: "RESET DATABASE" },
        { uid: STAFF_UID, role: "staff", email: `${STAFF_UID}@example.test` }
      )
    ).rejects.toThrow(/Only admins can reset the operational database/i);
  });

  it("rejects wrong confirmation text", async () => {
    await seedUser(ADMIN_UID, "admin");

    await expect(
      invokeResetOperationalDatabase(
        { confirmText: "WRONG TEXT" },
        { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
      )
    ).rejects.toThrow(/Type RESET DATABASE to confirm/i);
  });

  it("accepts correct admin + confirmation on empty collections", async () => {
    await seedUser(ADMIN_UID, "admin");

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);
    expect(result.clearedCollections).toEqual(OPERATIONAL_COLLECTIONS);
    expect(result.deletedCounts).toBeDefined();

    const totalDeleted = Object.values(result.deletedCounts).reduce(
      (sum: number, count: unknown) => sum + (typeof count === "number" ? count : 0),
      0
    );
    expect(totalDeleted).toBe(0);
  });

  it("clears populated test collections fully", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedCollection("orders", 25);
    await seedCollection("patients", 15);
    await seedCollection("inventory", 10);

    expect((await countCollection("orders"))).toBe(25);
    expect((await countCollection("patients"))).toBe(15);
    expect((await countCollection("inventory"))).toBe(10);

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);
    expect(result.deletedCounts.orders).toBe(25);
    expect(result.deletedCounts.patients).toBe(15);
    expect(result.deletedCounts.inventory).toBe(10);

    expect((await countCollection("orders"))).toBe(0);
    expect((await countCollection("patients"))).toBe(0);
    expect((await countCollection("inventory"))).toBe(0);
  });

  it("clears multiple batches fully", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedCollection("orders", 401);

    expect((await countCollection("orders"))).toBe(401);

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);
    expect(result.deletedCounts.orders).toBe(401);
    expect((await countCollection("orders"))).toBe(0);
  });

  it("clears all configured operational collections", async () => {
    await seedUser(ADMIN_UID, "admin");

    for (const collectionName of OPERATIONAL_COLLECTIONS) {
      await seedCollection(collectionName, 3);
    }

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);
    expect(result.clearedCollections).toEqual(OPERATIONAL_COLLECTIONS);

    for (const collectionName of OPERATIONAL_COLLECTIONS) {
      expect((await countCollection(collectionName))).toBe(0);
    }
  });

  it("preserves protected and reference collections", async () => {
    await seedUser(ADMIN_UID, "admin");

    await db.collection("users").doc("protected-user").set({ role: "staff" });
    await db.collection("settings").doc("protected-setting").set({ value: "keep" });
    await db.collection("apiRegistry").doc("protected-api").set({ name: "keep" });
    await db.collection("hcpcsCodes").doc("protected-code").set({ code: "keep" });
    await db.collection("roles").doc("protected-role").set({ name: "keep" });
    await db.collection("permissions").doc("protected-perm").set({ name: "keep" });
    await db.collection("auditLogs").doc("protected-audit").set({ action: "keep" });

    await seedCollection("orders", 5);

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);

    expect((await db.collection("users").doc("protected-user").get()).exists).toBe(true);
    expect((await db.collection("settings").doc("protected-setting").get()).exists).toBe(true);
    expect((await db.collection("apiRegistry").doc("protected-api").get()).exists).toBe(true);
    expect((await db.collection("hcpcsCodes").doc("protected-code").get()).exists).toBe(true);
    expect((await db.collection("roles").doc("protected-role").get()).exists).toBe(true);
    expect((await db.collection("permissions").doc("protected-perm").get()).exists).toBe(true);
    expect((await db.collection("auditLogs").doc("protected-audit").get()).exists).toBe(true);

    expect((await countCollection("orders"))).toBe(0);
  });

  it("writes an audit record that survives the reset", async () => {
    await seedUser(ADMIN_UID, "admin");

    const result = await invokeResetOperationalDatabase(
      { confirmText: "RESET DATABASE" },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result.ok).toBe(true);

    const auditSnapshots = await db
      .collection("auditLogs")
      .where("action", "==", "database_reset_completed")
      .get();

    expect(auditSnapshots.empty).toBe(false);

    const auditDoc = auditSnapshots.docs[0].data();
    expect(auditDoc.action).toBe("database_reset_completed");
    expect(auditDoc.actorUid).toBe(ADMIN_UID);
    expect(auditDoc.targetCollection).toBe("operational_database");
    expect(auditDoc.details.clearedCollections).toEqual(OPERATIONAL_COLLECTIONS);
    expect(auditDoc.details.deletedCounts).toBeDefined();
  });

  it("does not report false success on failure", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedCollection("orders", 5);

    await expect(
      invokeResetOperationalDatabase(
        { confirmText: "WRONG" },
        { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
      )
    ).rejects.toThrow();

    const auditSnapshots = await db
      .collection("auditLogs")
      .where("action", "==", "database_reset_completed")
      .get();

    expect(auditSnapshots.empty).toBe(true);
    expect((await countCollection("orders"))).toBe(5);
  });
});
