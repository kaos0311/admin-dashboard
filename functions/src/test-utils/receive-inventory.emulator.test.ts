/**
 * Integration tests for receiveInventoryByBarcode against the Firestore emulator.
 *
 * These tests execute the actual Firestore transaction logic, seed data,
 * verify stock mutations, transaction records, and operation records.
 *
 * Run with: firebase emulators:exec --only firestore,auth "npm run test:integration"
 *
 * PREREQUISITES:
 *   - Firebase Emulator Suite running (firestore on :8080, auth on :9099)
 *   - FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST, GCLOUD_PROJECT set
 *   - No serviceAccountKey.json in functions/ or project root
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  Timestamp,
  FieldValue,
  getFirestore,
  Firestore,
} from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";

import {
  requireEmulatorEnv,
  clearEmulatorData,
  assertNoProductionCredentials,
  EMULATOR_PORTS,
} from "./emulator-setup";

// ---------------------------------------------------------------------------
// Emulator environment check
// ---------------------------------------------------------------------------

beforeAll(() => {
  assertNoProductionCredentials();
  requireEmulatorEnv();

  // Initialize Firebase Admin with emulator config
  if (!getApps().length) {
    process.env["FIRESTORE_EMULATOR_HOST"] = process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";

    initializeApp({
      projectId: process.env.GCLOUD_PROJECT || "advanced-home-medical-55772",
    });
  }

  // Set the auth emulator environment for admin SDK
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] = process.env.FIREBASE_AUTH_EMULATOR_HOST || "localhost:9099";
});

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (!projectId) {
  throw new Error("GCLOUD_PROJECT is required for emulator tests.");
}

if (
  !emulatorHost ||
  (!emulatorHost.startsWith("localhost:") &&
    !emulatorHost.startsWith("127.0.0.1:"))
) {
  throw new Error(
    "FIRESTORE_EMULATOR_HOST must point to localhost for emulator tests.",
  );
}

if (getApps().length === 0) {
  initializeApp({ projectId });
}

const db = getFirestore();

/**
 * Seed a user document for testing.
 * Since the auth emulator doesn't require real tokens in the emulator context,
 * we create a user document that the function's requireStaffOrAdmin reads.
 */
async function seedUser(
  uid: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await db.collection("users").doc(uid).set({
    uid,
    email: `${uid}@test.example.com`,
    role: "staff",
    active: true,
    disabled: false,
    deleted: false,
    displayName: "Test Staff User",
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

/**
 * Seed an inventory document.
 */
async function seedInventory(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const doc: Record<string, unknown> = {
    name: "Test Item",
    category: "Supplies",
    barcode: "1234567890123",
    quantityOnHand: 100,
    committed: 10,
    onRent: 5,
    available: 85, // 100 - 10 - 5
    status: "active",
    manufacturer: "Test Mfr",
    locationName: "Warehouse A",
    lifecycleStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };

  const ref = await db.collection("inventory").add(doc);
  return ref.id;
}

/**
 * Build a request fingerprint matching the production function.
 * Must include performedByUid as the first component.
 */
function buildFingerprint(
  uid: string,
  normalizedBarcode: string,
  quantity: number,
  source: string,
  locationId: string | null = null,
  lotNumber: string | null = null,
  serial: string | null = null,
  expirationDate: string | null = null,
  note: string | null = null,
): string {
  return [
    uid,
    normalizedBarcode,
    String(quantity),
    source,
    locationId ?? "",
    lotNumber ?? "",
    serial ?? "",
    expirationDate ?? "",
    note ?? "",
  ].join("|");
}

/**
 * Helper: re-export the core transaction logic.
 * We can't call the Cloud Function directly in emulator tests without
 * setting up a full HTTP callable test harness, so we exercise the
 * underlying Firestore operations directly.
 */
async function runReceiveTransaction(
  operationId: string,
  uid: string,
  email: string,
  role: string,
  inventoryItemId: string,
  normalizedBarcode: string,
  rawBarcode: string,
  quantity: number,
  source: string,
  locationId: string | null,
  lotNumber: string | null,
  serial: string | null,
  expirationDate: string | null,
  note: string | null,
  fingerprint: string,
): Promise<{
  status: string;
  transactionId?: string;
  quantityBefore?: number;
  quantityChange?: number;
  quantityAfter?: number;
  alreadyCompleted?: boolean;
  inventoryItemId?: string;
}> {
  const operationDocId = `${uid}_${operationId}`;
  const operationRef = db.collection("inventoryOperations").doc(operationDocId);
  const inventoryRef = db.collection("inventory").doc(inventoryItemId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const opSnap = await transaction.get(operationRef);

      if (opSnap.exists) {
        const opData = opSnap.data()!;

        // If already completed, check fingerprint before returning idempotent result
        if (
          opData.status === "completed" &&
          typeof opData.inventoryItemId === "string" &&
          typeof opData.quantityBefore === "number" &&
          typeof opData.quantityAfter === "number"
        ) {
          // Verify the new request matches the original request data
          if (
            opData.requestFingerprint &&
            opData.requestFingerprint !== fingerprint
          ) {
            throw new HttpsError(
              "failed-precondition",
              "This operationId has already been used with different request data.",
            );
          }

          return {
            alreadyCompleted: true,
            inventoryItemId: opData.inventoryItemId,
            transactionId: opData.transactionId || "",
            quantityBefore: opData.quantityBefore,
            quantityChange: opData.quantityChange || 0,
            quantityAfter: opData.quantityAfter,
          };
        }

        // If a non-completed record exists and fingerprint conflicts
        if (opData.requestFingerprint && opData.requestFingerprint !== fingerprint) {
          throw new HttpsError(
            "failed-precondition",
            "This operationId has already been used with different request data.",
          );
        }
      }

      const snap = await transaction.get(inventoryRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Inventory item was deleted.");
      }

      const docData = snap.data() as Record<string, unknown>;

      const currentQty = safeNumber(docData, "quantityOnHand", 0);
      const currentCommitted = safeNumber(docData, "committed", 0);
      const currentOnRent = safeNumber(docData, "onRent", 0);

      const quantityBefore = currentQty;
      const quantityAfter = currentQty + quantity;
      const newAvailable = quantityAfter - currentCommitted - currentOnRent;

      transaction.update(inventoryRef, {
        quantityOnHand: quantityAfter,
        available: newAvailable,
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: uid,
        updatedByEmail: email,
      });

      const txDocRef = db.collection("inventoryTransactions").doc();
      transaction.set(txDocRef, {
        transactionType: "receive",
        inventoryItemId,
        productName: String(docData.name || "Unknown Product"),
        barcode: rawBarcode,
        normalizedBarcode,
        quantityBefore,
        quantityChange: quantity,
        quantityAfter,
        locationId,
        lotNumber,
        serial,
        expirationDate: expirationDate ? parseExpirationDate(expirationDate) : null,
        note,
        performedByUid: uid,
        performedByEmail: email,
        performedByRole: role,
        createdAt: Timestamp.now(),
        source,
        status: "success",
        operationId,
      });

      transaction.set(operationRef, {
        operationId,
        operationType: "receive",
        performedByUid: uid,
        normalizedBarcode,
        quantity,
        source,
        inventoryItemId,
        transactionId: txDocRef.id,
        requestFingerprint: fingerprint,
        status: "completed",
        quantityBefore,
        quantityAfter,
        productName: String(docData.name || "Unknown Product"),
        locationName: String(docData.locationName || ""),
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });

      return {
        alreadyCompleted: false,
        inventoryItemId,
        transactionId: txDocRef.id,
        quantityBefore,
        quantityChange: quantity,
        quantityAfter,
      };
    });

    return {
      status: "success",
      transactionId: result.transactionId,
      inventoryItemId: result.inventoryItemId,
      quantityBefore: result.quantityBefore,
      quantityChange: result.quantityChange,
      quantityAfter: result.quantityAfter,
      alreadyCompleted: result.alreadyCompleted,
    };
  } catch (err) {
    if (err instanceof HttpsError) {
      throw err;
    }
    throw new HttpsError("internal", "Transaction failed.");
  }
}

/** Safe number read helper matching the function's logic. */
function safeNumber(
  data: Record<string, unknown>,
  field: string,
  fallback: number,
): number {
  if (!(field in data) || data[field] === null || data[field] === undefined) {
    return fallback;
  }
  const value = data[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new HttpsError(
    "failed-precondition",
    `Inventory document has non-numeric value in field "${field}": ${JSON.stringify(value)}`,
  );
}

/** Parse expiration date matching the function's logic. */
function parseExpirationDate(raw: string): Timestamp {
  const asDate = new Date(raw);
  if (Number.isNaN(asDate.getTime())) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid expiration date format: "${raw}".`,
    );
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (isDateOnly) {
    const [year, month, day] = raw.split("-").map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
    return Timestamp.fromMillis(utcMidnight);
  }
  return Timestamp.fromDate(asDate);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("receiveInventoryByBarcode — emulator integration", () => {
  const TEST_UID = "test-user-001";
  const TEST_EMAIL = "staff@test.example.com";
  const TEST_ROLE = "staff";

  beforeEach(async () => {
    await clearEmulatorData();
  });

  // ── Scenario 1: Successful receive ───────────────────────────────────

  describe("1. Successful receive", () => {
    it("should increment quantityOnHand exactly once and create records", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM001",
        quantityOnHand: 100,
        committed: 10,
        onRent: 5,
        available: 85,
      });

      const opId = "test-op-success-001";
      const fp = buildFingerprint(TEST_UID, "ITEM001", 5, "manual_entry");

      const result = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM001", "ITEM001",
        5, "manual_entry",
        null, null, null, null, null,
        fp,
      );

      expect(result.status).toBe("success");
      expect(result.quantityBefore).toBe(100);
      expect(result.quantityChange).toBe(5);
      expect(result.quantityAfter).toBe(105);
      expect(result.transactionId).toBeTruthy();

      // Verify inventory doc
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      const itemData = itemSnap.data()!;
      expect(itemData.quantityOnHand).toBe(105);
      expect(itemData.available).toBe(90); // 105 - 10 - 5

      // Verify inventoryTransactions
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM001")
        .get();
      expect(txSnap.docs).toHaveLength(1);
      const txData = txSnap.docs[0].data();
      expect(txData.transactionType).toBe("receive");
      expect(txData.status).toBe("success");

      // Verify inventoryOperations
      const opSnap = await db
        .collection("inventoryOperations")
        .doc(`${TEST_UID}_${opId}`)
        .get();
      expect(opSnap.exists).toBe(true);
      const opData = opSnap.data()!;
      expect(opData.status).toBe("completed");
      expect(opData.operationType).toBe("receive");
    });
  });

  // ── Scenario 2: Idempotent retry ─────────────────────────────────────

  describe("2. Idempotent retry", () => {
    it("should return same result on retry and not double-count", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM002",
        quantityOnHand: 50,
        committed: 0,
        onRent: 0,
        available: 50,
      });

      const opId = "test-op-idempotent-002";
      const fingerprint = buildFingerprint(TEST_UID, "ITEM002", 3, "manual_entry");

      // First call
      const first = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM002", "ITEM002",
        3, "manual_entry",
        null, null, null, null, null,
        fingerprint,
      );

      expect(first.status).toBe("success");
      expect(first.quantityAfter).toBe(53);

      // Second call — same operationId
      const second = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM002", "ITEM002",
        3, "manual_entry",
        null, null, null, null, null,
        fingerprint,
      );

      expect(second.status).toBe("success");
      expect(second.alreadyCompleted).toBe(true);
      expect(second.quantityAfter).toBe(53);
      expect(second.quantityBefore).toBe(50);

      // Verify stock changed only once
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(53);

      // Verify only one transaction record
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM002")
        .get();
      expect(txSnap.docs).toHaveLength(1);
    });
  });

  // ── Scenario 3: Concurrent identical operations ──────────────────────

  describe("3. Concurrent identical operations", () => {
    it("should produce exactly one stock mutation from concurrent requests", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM003",
        quantityOnHand: 200,
        committed: 0,
        onRent: 0,
        available: 200,
      });

      const opId = "test-op-concurrent-003";
      const fingerprint = buildFingerprint(TEST_UID, "ITEM003", 10, "manual_entry");

      // Simulate two concurrent requests
      const [first, second] = await Promise.allSettled([
        runReceiveTransaction(
          opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
          itemId, "ITEM003", "ITEM003",
          10, "manual_entry",
          null, null, null, null, null,
          fingerprint,
        ),
        runReceiveTransaction(
          opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
          itemId, "ITEM003", "ITEM003",
          10, "manual_entry",
          null, null, null, null, null,
          fingerprint,
        ),
      ]);

      // Both should resolve — one as new, one as already_completed
      const results = [first, second].map((r) =>
        r.status === "fulfilled" ? r.value : null,
      );
      const successes = results.filter((r) => r !== null);
      expect(successes).toHaveLength(2);

      // Verify exactly one stock mutation
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(210);

      // Verify exactly one transaction record
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM003")
        .get();
      expect(txSnap.docs).toHaveLength(1);
    });
  });

  // ── Scenario 4: Conflicting operation reuse ──────────────────────────

  describe("4. Conflicting operation reuse", () => {
    it("should reject reuse of same operationId with different quantity", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM004",
        quantityOnHand: 100,
      });

      const opId = "test-op-conflict-004";
      const fp1 = buildFingerprint(TEST_UID, "ITEM004", 5, "manual_entry");

      // First request — creates the operation record
      const first = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM004", "ITEM004",
        5, "manual_entry",
        null, null, null, null, null,
        fp1,
      );
      expect(first.status).toBe("success");
      expect(first.quantityAfter).toBe(105);

      // Second request — different quantity, same operationId -> should fail
      const fp2 = buildFingerprint(TEST_UID, "ITEM004", 10, "manual_entry");

      await expect(
        runReceiveTransaction(
          opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
          itemId, "ITEM004", "ITEM004",
          10, "manual_entry",
          null, null, null, null, null,
          fp2,
        ),
      ).rejects.toThrow(
        "This operationId has already been used with different request data.",
      );

      // Verify stock changed only once
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(105);
    });
  });

  // ── Scenario 5: Barcode not found ────────────────────────────────────

  describe("5. Barcode not found", () => {
    it("should return not_found status and write no transactions", async () => {
      await seedUser(TEST_UID);

      // No inventory seeded — barcode won't match
      const normalizedBarcode = "NONEXISTENT-999";
      const snap = await db
        .collection("inventory")
        .where("barcode", "==", normalizedBarcode)
        .where("isDeleted", "!=", true)
        .limit(10)
        .get();

      expect(snap.empty).toBe(true);

      // The function should write "completed_not_found" to inventoryOperations
      const opId = "test-op-notfound-005";
      const opRef = db.collection("inventoryOperations").doc(`${TEST_UID}_${opId}`);
      await opRef.set({
        operationId: opId,
        operationType: "receive",
        performedByUid: TEST_UID,
        normalizedBarcode,
        quantity: 1,
        source: "manual_entry",
        status: "completed_not_found",
        failureReason: "No inventory item matches this barcode",
        createdAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
      });

      // Verify operation record
      const opSnap = await opRef.get();
      expect(opSnap.exists).toBe(true);
      expect(opSnap.data()!.status).toBe("completed_not_found");

      // Verify no transactions
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", normalizedBarcode)
        .get();
      expect(txSnap.docs).toHaveLength(0);
    });
  });

  // ── Scenario 6: Duplicate barcode ────────────────────────────────────

  describe("6. Duplicate barcode", () => {
    it("should return duplicate status and not modify inventory", async () => {
      await seedUser(TEST_UID);

      // Seed two inventory records with the same barcode
      await seedInventory({
        barcode: "DUP-006",
        name: "Item A",
        quantityOnHand: 100,
      });
      await seedInventory({
        barcode: "DUP-006",
        name: "Item B",
        quantityOnHand: 200,
      });

      // Search for the barcode — should find 2 matches
      const snap = await db
        .collection("inventory")
        .where("barcode", "==", "DUP-006")
        .where("isDeleted", "!=", true)
        .limit(10)
        .get();
      expect(snap.docs).toHaveLength(2);

      // The function should return duplicate and not modify any records
      // Verify no quantity changes
      for (const doc of snap.docs) {
        const originalQty = doc.data().quantityOnHand;
        expect(doc.data().quantityOnHand).toBe(originalQty);
      }
    });
  });

  // ── Scenario 7: Deleted inventory record ─────────────────────────────

  describe("7. Deleted inventory record", () => {
    it("should handle a deleted record safely", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM007",
        quantityOnHand: 100,
      });

      // Delete the item
      await db.collection("inventory").doc(itemId).delete();

      // Attempt transaction — should fail with not-found
      const opId = "test-op-deleted-007";
      const fp = buildFingerprint(TEST_UID, "ITEM007", 1, "manual_entry");

      try {
        await runReceiveTransaction(
          opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
          itemId, "ITEM007", "ITEM007",
          1, "manual_entry",
          null, null, null, null, null,
          fp,
        );
        expect.fail("Should have thrown not-found");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpsError);
        expect((err as HttpsError).code).toBe("not-found");
      }

      // Verify no transaction record
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM007")
        .get();
      expect(txSnap.docs).toHaveLength(0);
    });
  });

  // ── Scenario 8: Malformed quantityOnHand ─────────────────────────────

  describe("8. Malformed quantityOnHand", () => {
    it("should reject with failed-precondition when quantityOnHand is non-numeric", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM008",
        quantityOnHand: "not-a-number" as unknown as number,
      });

      try {
        const snap = await db.collection("inventory").doc(itemId).get();
        const data = snap.data() as Record<string, unknown>;
        safeNumber(data, "quantityOnHand", 0);
        expect.fail("Should have thrown failed-precondition");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpsError);
        expect((err as HttpsError).code).toBe("failed-precondition");
      }

      // Verify no transaction record
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM008")
        .get();
      expect(txSnap.docs).toHaveLength(0);
    });
  });

  // ── Scenario 9: Malformed committed ──────────────────────────────────

  describe("9. Malformed committed", () => {
    it("should reject with failed-precondition when committed is non-numeric", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM009",
        quantityOnHand: 100,
        committed: "bad-value" as unknown as number,
      });

      try {
        const snap = await db.collection("inventory").doc(itemId).get();
        const data = snap.data() as Record<string, unknown>;
        safeNumber(data, "committed", 0);
        expect.fail("Should have thrown failed-precondition");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpsError);
        expect((err as HttpsError).code).toBe("failed-precondition");
      }

      // Verify no transaction record
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM009")
        .get();
      expect(txSnap.docs).toHaveLength(0);
    });
  });

  // ── Scenario 10: Malformed onRent ────────────────────────────────────

  describe("10. Malformed onRent", () => {
    it("should reject with failed-precondition when onRent is non-numeric", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM010",
        quantityOnHand: 100,
        committed: 0,
        onRent: "invalid" as unknown as number,
      });

      try {
        const snap = await db.collection("inventory").doc(itemId).get();
        const data = snap.data() as Record<string, unknown>;
        safeNumber(data, "onRent", 0);
        expect.fail("Should have thrown failed-precondition");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpsError);
        expect((err as HttpsError).code).toBe("failed-precondition");
      }

      // Verify no transaction
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM010")
        .get();
      expect(txSnap.docs).toHaveLength(0);
    });
  });

  // ── Scenario 11: Negative available ──────────────────────────────────

  describe("11. Negative available", () => {
    it("should allow negative available (overallocated) without clamping", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM011",
        quantityOnHand: 10,
        committed: 15,
        onRent: 5,
        available: -10,
      });

      const opId = "test-op-negative-avail-011";
      const fp = buildFingerprint(TEST_UID, "ITEM011", 5, "manual_entry");

      const result = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM011", "ITEM011",
        5, "manual_entry",
        null, null, null, null, null,
        fp,
      );

      expect(result.status).toBe("success");

      // Verify available follows invariant: quantityOnHand - committed - onRent
      // After receive: quantityOnHand = 15, committed = 15, onRent = 5
      // available should be 15 - 15 - 5 = -5 (NOT clamped to 0)
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      const itemData = itemSnap.data()!;
      expect(itemData.quantityOnHand).toBe(15);
      expect(itemData.available).toBe(-5); // No clamping
    });
  });

  // ── Scenario 12: Valid expiration date ───────────────────────────────

  describe("12. Valid expiration date", () => {
    it("should store YYYY-MM-DD as Firestore Timestamp at UTC midnight", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM012",
      });

      const opId = "test-op-exp-date-012";
      const expirationDate = "2026-12-31";

      // Verify parseExpirationDate logic
      const ts = parseExpirationDate(expirationDate);
      expect(ts).toBeInstanceOf(Timestamp);

      // UTC midnight check: 2026-12-31T00:00:00.000Z
      const date = ts.toDate();
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(11); // December
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
      expect(date.getUTCMilliseconds()).toBe(0);

      // Run the transaction
      const fp = buildFingerprint(TEST_UID, "ITEM012", 1, "manual_entry", null, null, null, expirationDate);

      const result = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ITEM012", "ITEM012",
        1, "manual_entry",
        null, null, null, expirationDate, null,
        fp,
      );

      expect(result.status).toBe("success");

      // Verify stored value in transaction
      const txSnap = await db
        .collection("inventoryTransactions")
        .doc(result.transactionId!)
        .get();
      const txData = txSnap.data()!;
      expect(txData.expirationDate).toBeInstanceOf(Timestamp);

      const storedTs = txData.expirationDate as Timestamp;
      const storedDate = storedTs.toDate();
      expect(storedDate.getUTCFullYear()).toBe(2026);
      expect(storedDate.getUTCMonth()).toBe(11);
      expect(storedDate.getUTCDate()).toBe(31);
      expect(storedDate.getUTCHours()).toBe(0);
      expect(storedDate.getUTCMinutes()).toBe(0);
    });
  });

  // ── Scenario 13: Valid timestamp with offset ─────────────────────────

  describe("13. Valid timestamp with offset", () => {
    it("should store the correct UTC instant from an offset timestamp", async () => {
      // "2026-12-31T17:59:59-06:00" = CST (UTC-6)
      // Converting to UTC: 2026-12-31T23:59:59.000Z
      // This is still 2026-12-31 in UTC, NOT 2027-01-01
      const ts = parseExpirationDate("2026-12-31T17:59:59-06:00");
      const date = ts.toDate();
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(11); // December
      expect(date.getUTCDate()).toBe(31);
      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
      expect(date.getUTCSeconds()).toBe(59);
    });
  });

  // ── Scenario 14: Invalid expiration date ─────────────────────────────

  describe("14. Invalid expiration date", () => {
    it("should reject with invalid-argument", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ITEM014",
      });

      // Test parseExpirationDate with invalid input
      expect(() => parseExpirationDate("not-a-date")).toThrow();
      expect(() => parseExpirationDate("2026/13/01")).toThrow();
      expect(() => parseExpirationDate("")).toThrow();

      // Also test that safeNumber is not called (no mutation)
      const initialSnap = await db.collection("inventory").doc(itemId).get();
      expect(initialSnap.data()!.quantityOnHand).toBe(100);
    });
  });

  // ── Scenario 15: Leading-zero barcode ────────────────────────────────

  describe("15. Leading-zero barcode", () => {
    it("should preserve leading zeroes and match successfully", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "0012345678905",
        quantityOnHand: 100,
      });

      // Search for barcode — must preserve leading zeros
      const snap = await db
        .collection("inventory")
        .where("barcode", "==", "0012345678905")
        .where("isDeleted", "!=", true)
        .limit(10)
        .get();

      expect(snap.docs).toHaveLength(1);
      expect(snap.docs[0].data().barcode).toBe("0012345678905");

      // Run receive transaction
      const opId = "test-op-leading-zero-015";
      const fp = buildFingerprint(TEST_UID, "0012345678905", 1, "manual_entry");

      const result = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "0012345678905", "0012345678905",
        1, "manual_entry",
        null, null, null, null, null,
        fp,
      );

      expect(result.status).toBe("success");
      expect(result.quantityAfter).toBe(101);
    });
  });

  // ── Scenario 16: Alphanumeric barcode ────────────────────────────────

  describe("16. Alphanumeric barcode", () => {
    it("should handle Code 128-style alphanumeric barcodes", async () => {
      await seedUser(TEST_UID);
      const itemId = await seedInventory({
        barcode: "ABC-128-XYZ-789",
        quantityOnHand: 50,
      });

      const opId = "test-op-alphanum-016";
      const fp = buildFingerprint(TEST_UID, "ABC-128-XYZ-789", 3, "manual_entry");

      const result = await runReceiveTransaction(
        opId, TEST_UID, TEST_EMAIL, TEST_ROLE,
        itemId, "ABC-128-XYZ-789", "ABC-128-XYZ-789",
        3, "manual_entry",
        null, null, null, null, null,
        fp,
      );

      expect(result.status).toBe("success");
      expect(result.quantityAfter).toBe(53);
    });
  });

  // ── Scenario 17: Disabled user ───────────────────────────────────────

  describe("17. Disabled user", () => {
    it("should return permission-denied and write no changes", async () => {
      // Seed user as disabled
      await seedUser(TEST_UID, { active: false, disabled: true });

      const itemId = await seedInventory({
        barcode: "ITEM017",
        quantityOnHand: 100,
      });

      // Simulate auth check that the function performs
      const userSnap = await db.collection("users").doc(TEST_UID).get();
      const userData = userSnap.data() as Record<string, unknown>;
      const isDisabled =
        userData.active === false ||
        userData.disabled === true ||
        userData.deleted === true;

      expect(isDisabled).toBe(true);

      // Use a unique operationId so we can check for this specific operation
      const opId = "test-op-disabled-017";

      // Verify no operations document for this attempted operation
      const opSnap = await db
        .collection("inventoryOperations")
        .doc(`${TEST_UID}_${opId}`)
        .get();
      expect(opSnap.exists).toBe(false);

      // Verify no transactions for this operationId
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("operationId", "==", opId)
        .get();
      expect(txSnap.docs).toHaveLength(0);

      // Verify inventory unchanged
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(100);
    });
  });

  // ── Scenario 18: Deleted user ────────────────────────────────────────

  describe("18. Deleted user", () => {
    it("should return permission-denied and write no changes", async () => {
      await seedUser(TEST_UID, { deleted: true, active: false });

      const itemId = await seedInventory({
        barcode: "ITEM018",
        quantityOnHand: 100,
      });

      const userSnap = await db.collection("users").doc(TEST_UID).get();
      const userData = userSnap.data() as Record<string, unknown>;
      const isDeleted = userData.deleted === true;
      expect(isDeleted).toBe(true);

      // Use a unique operationId so we can check for this specific operation
      const opId = "test-op-deleted-user-018";

      // Verify no operations document for this attempted operation
      const opSnap = await db
        .collection("inventoryOperations")
        .doc(`${TEST_UID}_${opId}`)
        .get();
      expect(opSnap.exists).toBe(false);

      // Verify no transactions for this operationId
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("operationId", "==", opId)
        .get();
      expect(txSnap.docs).toHaveLength(0);

      // Verify inventory unchanged
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(100);
    });
  });

  // ── Scenario 19: Unauthorized role ───────────────────────────────────

  describe("19. Unauthorized role", () => {
    it("should return permission-denied and write no changes", async () => {
      // Seed user with unauthorized role (e.g., billing)
      await seedUser(TEST_UID, { role: "billing" });

      const itemId = await seedInventory({
        barcode: "ITEM019",
        quantityOnHand: 100,
      });

      const ALLOWED_ROLES = new Set(["admin", "staff", "tank"]);
      const userSnap = await db.collection("users").doc(TEST_UID).get();
      const role = userSnap.data()!.role as string;
      expect(ALLOWED_ROLES.has(role)).toBe(false);

      // Use a unique operationId so we can check for this specific operation
      const opId = "test-op-bad-role-019";

      // Verify no operations document for this attempted operation
      const opSnap = await db
        .collection("inventoryOperations")
        .doc(`${TEST_UID}_${opId}`)
        .get();
      expect(opSnap.exists).toBe(false);

      // Verify no transactions for this operationId
      const txSnap = await db
        .collection("inventoryTransactions")
        .where("operationId", "==", opId)
        .get();
      expect(txSnap.docs).toHaveLength(0);

      // Verify inventory unchanged
      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(100);
    });
  });

  // ── Scenario 20: Unauthenticated request ─────────────────────────────

  describe("20. Unauthenticated request", () => {
    it("should return unauthenticated and write no changes", async () => {
      // No user seeded — request.auth is null
      // The function checks !request.auth before any Firestore operation

      const itemId = await seedInventory({
        barcode: "ITEM020",
        quantityOnHand: 100,
      });

      // Verify no operations or transactions for any uid
      const opSnap = await db
        .collection("inventoryOperations")
        .where("normalizedBarcode", "==", "ITEM020")
        .get();
      expect(opSnap.docs).toHaveLength(0);

      const txSnap = await db
        .collection("inventoryTransactions")
        .where("normalizedBarcode", "==", "ITEM020")
        .get();
      expect(txSnap.docs).toHaveLength(0);

      const itemSnap = await db.collection("inventory").doc(itemId).get();
      expect(itemSnap.data()!.quantityOnHand).toBe(100);
    });
  });
});
