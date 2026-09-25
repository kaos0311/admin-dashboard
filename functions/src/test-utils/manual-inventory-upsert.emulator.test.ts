import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "./emulator-setup";
import {
  manualInventoryUpsert,
  manualInventoryUpsertCallable,
} from "../inventory/manualInventoryUpsert";
import type {
  ManualInventoryUpsertInput,
  ManualInventoryUpsertResult,
} from "../inventory/types";
import type { MovementActor } from "../inventory/movementService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const actor: MovementActor = {
  uid: "manual-upsert-staff-001",
  email: "manual-upsert-staff@example.test",
  role: "staff",
};

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function baseInput(overrides: Partial<ManualInventoryUpsertInput> = {}): ManualInventoryUpsertInput {
  return {
    operationId: "manual-upsert-op-001",
    productId: "product-1",
    name: "Manual CPAP Mask",
    category: "Supplies",
    manufacturer: "Acme",
    manufacturerItemId: "MFG-1",
    sku: "SKU-1",
    hcpc: "a7030",
    barcode: "BAR-1",
    serial: "",
    lotNumber: "",
    locationName: "Main Location",
    binLocation: "A1",
    reorderLevel: 2,
    unitCost: 12.5,
    notes: "Manual save.",
    source: "inventory",
    sourceId: "manual_entry",
    ...overrides,
  };
}

function callableRequest(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
  ip = "127.0.0.1",
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

async function invokeManualInventoryUpsertCallable(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
) {
  const callable = manualInventoryUpsertCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<ManualInventoryUpsertResult>;
  };
  return callable.run(callableRequest(data, authContext));
}

async function seedUser(uid: string, overrides: Record<string, unknown> = {}) {
  await db.collection("users").doc(uid).set({
    role: "staff",
    email: `${uid}@example.test`,
    active: true,
    disabled: false,
    deleted: false,
    ...overrides,
  });
}

async function seedInventory(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("inventory").doc(id).set({
    productId: "existing-product",
    name: "Existing Item",
    category: "Supplies",
    barcode: `BAR-${id}`,
    serial: `SER-${id}`,
    lotNumber: `LOT-${id}`,
    sku: `SKU-${id}`,
    manufacturerItemId: `MFG-${id}`,
    locationName: "Main Location",
    binLocation: "A1",
    quantityOnHand: 5,
    available: 5,
    committed: 0,
    onRent: 0,
    onOrder: 0,
    status: "available",
    lifecycleStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    notes: "Existing notes.",
    ...overrides,
  });
}

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("inventory")),
    db.recursiveDelete(db.collection("inventoryIdentityLocks")),
    db.recursiveDelete(db.collection("inventoryOperations")),
    db.recursiveDelete(db.collection("products")),
    db.recursiveDelete(db.collection("rateLimitBuckets")),
    db.recursiveDelete(db.collection("users")),
  ]);
  await seedUser(actor.uid, { role: actor.role, email: actor.email });
});

describe("manualInventoryUpsert", () => {
  it("creates new inventory metadata with zero stock defaults", async () => {
    const result = await manualInventoryUpsert(baseInput(), actor, db);

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("Expected created result.");

    const inventory = (await db.collection("inventory").doc(result.inventoryItemId).get()).data();
    expect(inventory).toMatchObject({
      productId: "product-1",
      name: "Manual CPAP Mask",
      category: "Supplies",
      barcode: "BAR-1",
      quantityOnHand: 0,
      available: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      status: "available",
      lifecycleStatus: "active",
      isDeleted: false,
    });
  });

  it("merges into one canonical barcode match without changing stock", async () => {
    await seedInventory("merge-barcode", {
      barcode: "BAR-MERGE",
      quantityOnHand: 9,
      available: 7,
    });

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: "manual-upsert-merge-barcode",
        barcode: "BAR-MERGE",
        name: "Updated Merge Name",
      }),
      actor,
      db,
    );

    expect(result).toEqual({
      status: "merged",
      inventoryItemId: "merge-barcode",
    });
    const inventory = (await db.collection("inventory").doc("merge-barcode").get()).data();
    expect(inventory).toMatchObject({
      name: "Updated Merge Name",
      barcode: "BAR-MERGE",
      quantityOnHand: 9,
      available: 7,
    });
  });

  it.each([
    ["serial", { serial: "SER-SINGLE", barcode: "" }, { serial: "SER-SINGLE" }],
    ["lot", { lotNumber: "LOT-SINGLE", barcode: "" }, { lotNumber: "LOT-SINGLE" }],
    ["sku", { sku: "SKU-SINGLE", barcode: "", binLocation: "A1" }, { sku: "SKU-SINGLE" }],
  ])("merges by %s when exactly one active record is eligible", async (_label, input, seed) => {
    await seedInventory("single-match", seed);

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: `manual-upsert-${_label}`,
        ...input,
      }),
      actor,
      db,
    );

    expect(result.status).toBe("merged");
    expect("inventoryItemId" in result ? result.inventoryItemId : "").toBe("single-match");
  });

  it("does not treat productId as inventory merge identity", async () => {
    await db.collection("products").doc("product-only").set({
      name: "Product Only",
      deleted: false,
    });
    await seedInventory("same-product", {
      productId: "product-only",
      barcode: "",
      serial: "",
      lotNumber: "",
      sku: "",
      manufacturerItemId: "",
    });

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: "manual-upsert-product-id",
        productId: "product-only",
        barcode: "",
        serial: "",
        lotNumber: "",
        sku: "",
        manufacturerItemId: "",
      }),
      actor,
      db,
    );

    expect(result.status).toBe("created");
    expect("inventoryItemId" in result ? result.inventoryItemId : "").not.toBe("same-product");
  });

  it("fails closed when multiple eligible records match", async () => {
    await seedInventory("ambiguous-a", { barcode: "AMBIG" });
    await seedInventory("ambiguous-b", { barcode: "AMBIG" });

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: "manual-upsert-ambiguous",
        barcode: "AMBIG",
      }),
      actor,
      db,
    );

    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") throw new Error("Expected ambiguous.");
    expect(result.matches.map((match) => match.inventoryItemId).sort()).toEqual([
      "ambiguous-a",
      "ambiguous-b",
    ]);
  });

  it("does not select deleted inventory", async () => {
    await seedInventory("deleted-match", {
      barcode: "DELETED-MATCH",
      isDeleted: true,
      deleted: true,
    });

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: "manual-upsert-deleted",
        barcode: "DELETED-MATCH",
      }),
      actor,
      db,
    );

    expect(result.status).toBe("created");
    expect("inventoryItemId" in result ? result.inventoryItemId : "").not.toBe("deleted-match");
  });

  it("treats missing legacy delete flags as eligible inventory", async () => {
    await db.collection("inventory").doc("legacy-missing-delete-flags").set({
      productId: "existing-product",
      name: "Existing Legacy Item",
      category: "Supplies",
      barcode: "LEGACY-ACTIVE",
      serial: "SER-LEGACY-ACTIVE",
      lotNumber: "LOT-LEGACY-ACTIVE",
      sku: "SKU-LEGACY-ACTIVE",
      manufacturerItemId: "MFG-LEGACY-ACTIVE",
      locationName: "Main Location",
      binLocation: "A1",
      quantityOnHand: 5,
      available: 5,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      status: "available",
      lifecycleStatus: "active",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const result = await manualInventoryUpsert(
      baseInput({
        operationId: "manual-upsert-legacy-missing-delete-flags",
        barcode: "LEGACY-ACTIVE",
      }),
      actor,
      db,
    );

    expect(result).toEqual({
      status: "merged",
      inventoryItemId: "legacy-missing-delete-flags",
    });
  });

  it("does not create duplicate active inventory for concurrent creates of the same barcode", async () => {
    const first = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-create-a",
        barcode: "CONCURRENT-001",
        name: "Concurrent Create A",
      }),
      actor,
      db,
    );
    const second = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-create-b",
        barcode: "CONCURRENT-001",
        name: "Concurrent Create B",
      }),
      actor,
      db,
    );

    const settled = await Promise.allSettled([first, second]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const results = settled.map((result) => {
      if (result.status !== "fulfilled") throw result.reason;
      return result.value;
    });

    expect(results.map((result) => result.status).sort()).toEqual(["created", "merged"]);
    expect(new Set(results.map((result) => "inventoryItemId" in result ? result.inventoryItemId : "")).size).toBe(1);

    const snap = await db.collection("inventory").where("barcode", "==", "CONCURRENT-001").get();
    const active = snap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return data.isDeleted !== true && data.deleted !== true;
    });
    expect(active).toHaveLength(1);
  });

  it("serializes overlapping barcode and barcode-lot concurrent creates through identity locks", async () => {
    const first = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-overlap-barcode-lot",
        barcode: "CONCURRENT-OVERLAP",
        lotNumber: "LOT-A",
      }),
      actor,
      db,
    );
    const second = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-overlap-barcode-only",
        barcode: "CONCURRENT-OVERLAP",
        lotNumber: "",
      }),
      actor,
      db,
    );

    const settled = await Promise.allSettled([first, second]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);

    const snap = await db.collection("inventory").where("barcode", "==", "CONCURRENT-OVERLAP").get();
    const active = snap.docs.filter((docSnap) => {
      const data = docSnap.data();
      return data.isDeleted !== true && data.deleted !== true;
    });
    expect(active).toHaveLength(1);
  });

  it("concurrently merges different operations into one target without changing protected stock", async () => {
    await seedInventory("concurrent-merge-target", {
      barcode: "CONCURRENT-MERGE",
      quantityOnHand: 11,
      available: 8,
      committed: 2,
      onRent: 1,
      onOrder: 4,
      status: "available",
      lifecycleStatus: "active",
    });

    const first = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-merge-a",
        barcode: "CONCURRENT-MERGE",
        notes: "Concurrent merge A",
      }),
      actor,
      db,
    );
    const second = manualInventoryUpsert(
      baseInput({
        operationId: "concurrent-merge-b",
        barcode: "CONCURRENT-MERGE",
        notes: "Concurrent merge B",
      }),
      actor,
      db,
    );

    const settled = await Promise.allSettled([first, second]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    for (const result of settled) {
      if (result.status !== "fulfilled") throw result.reason;
      expect(result.value).toEqual({
        status: "merged",
        inventoryItemId: "concurrent-merge-target",
      });
    }

    const snap = await db.collection("inventory").where("barcode", "==", "CONCURRENT-MERGE").get();
    expect(snap.size).toBe(1);
    const inventory = (await db.collection("inventory").doc("concurrent-merge-target").get()).data();
    expect(inventory).toMatchObject({
      quantityOnHand: 11,
      available: 8,
      committed: 2,
      onRent: 1,
      onOrder: 4,
      status: "available",
      lifecycleStatus: "active",
    });

    for (const operationId of ["concurrent-merge-a", "concurrent-merge-b"]) {
      const operation = await db
        .collection("inventoryOperations")
        .doc(`${actor.uid}_${operationId}`)
        .get();
      expect(operation.data()?.manualInventoryUpsertResult).toMatchObject({
        status: "merged",
        inventoryItemId: "concurrent-merge-target",
      });
    }
  });

  it("ignores malicious protected fields on create requests", async () => {
    const result = await manualInventoryUpsert(
      {
        ...baseInput({
          operationId: "manual-upsert-protected-fields",
          barcode: "PROTECTED-FIELDS",
        }),
        quantityOnHand: 999,
        available: 999,
        committed: 999,
        onRent: 999,
        onOrder: 999,
        totalValue: 999,
        status: "rented",
        lifecycleStatus: "retired",
        isDeleted: true,
        deleted: true,
      } as unknown as ManualInventoryUpsertInput,
      actor,
      db,
    );

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("Expected created result.");
    const inventory = (await db.collection("inventory").doc(result.inventoryItemId).get()).data();
    expect(inventory).toMatchObject({
      quantityOnHand: 0,
      available: 0,
      committed: 0,
      onRent: 0,
      onOrder: 0,
      totalValue: 0,
      status: "available",
      lifecycleStatus: "active",
      isDeleted: false,
    });
    expect(inventory?.deleted).toBeUndefined();
  });

  it("replays exact create without duplicating inventory", async () => {
    const input = baseInput({ operationId: "manual-upsert-replay-create", barcode: "REPLAY-CREATE" });

    const first = await manualInventoryUpsert(input, actor, db);
    const second = await manualInventoryUpsert(input, actor, db);

    expect(first.status).toBe("created");
    expect(second).toEqual({
      status: "duplicate_operation",
      action: "created",
      inventoryItemId: "inventoryItemId" in first ? first.inventoryItemId : "",
    });
    const snap = await db.collection("inventory").where("barcode", "==", "REPLAY-CREATE").get();
    expect(snap.size).toBe(1);
  });

  it("replays exact merge without double-changing metadata", async () => {
    await seedInventory("replay-merge", { barcode: "REPLAY-MERGE", notes: "Original" });
    const input = baseInput({
      operationId: "manual-upsert-replay-merge",
      barcode: "REPLAY-MERGE",
      notes: "Merged once",
    });

    const first = await manualInventoryUpsert(input, actor, db);
    const second = await manualInventoryUpsert(input, actor, db);

    expect(first).toEqual({
      status: "merged",
      inventoryItemId: "replay-merge",
    });
    expect(second).toEqual({
      status: "duplicate_operation",
      action: "merged",
      inventoryItemId: "replay-merge",
    });
    const inventory = (await db.collection("inventory").doc("replay-merge").get()).data();
    expect(inventory?.notes).toBe("Merged once");
  });

  it("rejects same operationId with different request data", async () => {
    const input = baseInput({ operationId: "manual-upsert-conflict", barcode: "CONFLICT-1" });
    await manualInventoryUpsert(input, actor, db);

    await expect(
      manualInventoryUpsert({ ...input, name: "Different Name" }, actor, db),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("stores and replays ambiguous operation results without mutating inventory", async () => {
    await seedInventory("ambiguous-replay-a", { barcode: "AMBIG-REPLAY" });
    await seedInventory("ambiguous-replay-b", { barcode: "AMBIG-REPLAY" });
    const input = baseInput({
      operationId: "manual-upsert-ambiguous-replay",
      barcode: "AMBIG-REPLAY",
    });

    const first = await manualInventoryUpsert(input, actor, db);
    const second = await manualInventoryUpsert(input, actor, db);

    expect(first).toEqual(second);
    expect(first.status).toBe("ambiguous");
    const operation = await db
      .collection("inventoryOperations")
      .doc(`${actor.uid}_${input.operationId}`)
      .get();
    expect(operation.data()?.manualInventoryUpsertResult).toMatchObject({
      status: "ambiguous",
    });
  });

  it.each([
    ["missing operationId", { operationId: "" }],
    ["malformed operationId", { operationId: "bad id with spaces" }],
  ])("rejects %s", async (_label, override) => {
    await expect(
      manualInventoryUpsert(baseInput(override), actor, db),
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects unauthenticated callable requests", async () => {
    await expect(
      invokeManualInventoryUpsertCallable(baseInput() as unknown as Record<string, unknown>),
    ).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects unauthorized callable roles", async () => {
    await seedUser("manual-upsert-viewer", { role: "billing" });

    await expect(
      invokeManualInventoryUpsertCallable(
        baseInput({ operationId: "manual-upsert-unauthorized" }) as unknown as Record<string, unknown>,
        { uid: "manual-upsert-viewer", role: "billing" },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects disabled otherwise-authorized callable users", async () => {
    await seedUser("manual-upsert-disabled", {
      role: "staff",
      disabled: true,
    });

    await expect(
      invokeManualInventoryUpsertCallable(
        baseInput({ operationId: "manual-upsert-disabled" }) as unknown as Record<string, unknown>,
        { uid: "manual-upsert-disabled", role: "staff" },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});
