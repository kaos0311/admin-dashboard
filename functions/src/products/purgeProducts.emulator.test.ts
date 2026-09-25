import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  clearEmulatorData,
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "../test-utils/emulator-setup";

import {
  PURGE_PRODUCTS_CONFIRM_TEXT,
  purgeProducts,
} from "./purgeProducts.js";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const ADMIN_UID = "purge-admin-001";
const STAFF_UID = "purge-staff-001";

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function callableRequest(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
  ip = "127.0.0.1"
) {
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

async function invokePurgeProducts(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext
): Promise<any> {
  const callable = purgeProducts as unknown as {
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

async function seedProducts(count: number) {
  const batch = db.batch();

  for (let i = 0; i < count; i++) {
    const docRef = db.collection("products").doc();
    batch.set(docRef, {
      name: `Test Product ${i}`,
      sku: `SKU-${i}`,
      createdAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

async function countProducts(): Promise<number> {
  const snapshot = await db.collection("products").count().get();
  return snapshot.data().count ?? 0;
}

async function countAuditLogs(): Promise<number> {
  const snapshot = await db.collection("auditLogs").count().get();
  return snapshot.data().count ?? 0;
}

beforeEach(async () => {
  await clearEmulatorData();
});

describe("purgeProducts emulator", () => {
  it("rejects non-admin requests", async () => {
    await seedUser(STAFF_UID, "staff");

    await expect(
      invokePurgeProducts(
        { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
        { uid: STAFF_UID, role: "staff", email: `${STAFF_UID}@example.test` }
      )
    ).rejects.toThrow(/Only admins can purge products/i);
  });

  it("rejects wrong confirmation text", async () => {
    await seedUser(ADMIN_UID, "admin");

    await expect(
      invokePurgeProducts(
        { confirmText: "WRONG TEXT" },
        { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
      )
    ).rejects.toThrow(/Confirmation text must be exactly: PURGE PRODUCTS/i);
  });

  it("returns deletedCount 0 on an empty products collection", async () => {
    await seedUser(ADMIN_UID, "admin");

    const result = await invokePurgeProducts(
      { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result).toEqual({ status: "success", deletedCount: 0 });
    expect(await countProducts()).toBe(0);
  });

  it("fully deletes a collection smaller than one batch", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedProducts(3);

    expect(await countProducts()).toBe(3);

    const result = await invokePurgeProducts(
      { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result).toEqual({ status: "success", deletedCount: 3 });
    expect(await countProducts()).toBe(0);
  });

  it("fully deletes a collection larger than one batch", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedProducts(401);

    expect(await countProducts()).toBe(401);

    const result = await invokePurgeProducts(
      { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result).toEqual({ status: "success", deletedCount: 401 });
    expect(await countProducts()).toBe(0);
  });

  it("returns an exact deletedCount for multi-batch collections", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedProducts(850);

    const result = await invokePurgeProducts(
      { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result).toEqual({ status: "success", deletedCount: 850 });
    expect(await countProducts()).toBe(0);
  });

  it("writes an audit log entry after a successful purge", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedProducts(5);

    const result = await invokePurgeProducts(
      { confirmText: PURGE_PRODUCTS_CONFIRM_TEXT },
      { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
    );

    expect(result).toEqual({ status: "success", deletedCount: 5 });

    const auditSnapshots = await db
      .collection("auditLogs")
      .where("action", "==", "products_purged")
      .get();

    expect(auditSnapshots.empty).toBe(false);

    const auditDoc = auditSnapshots.docs[0].data();
    expect(auditDoc.actorUid).toBe(ADMIN_UID);
    expect(auditDoc.deletedCount).toBe(5);
    expect(auditDoc.targetCollection).toBe("products");
  });

  it("does not report success or write an audit log on wrong confirmation", async () => {
    await seedUser(ADMIN_UID, "admin");
    await seedProducts(5);

    await expect(
      invokePurgeProducts(
        { confirmText: "WRONG" },
        { uid: ADMIN_UID, role: "admin", email: `${ADMIN_UID}@example.test` }
      )
    ).rejects.toThrow();

    expect(await countProducts()).toBe(5);
    expect(await countAuditLogs()).toBe(0);
  });
});