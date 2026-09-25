import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import {
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "./emulator-setup";
import { createInventoryMovement, type MovementActor } from "../inventory/movementService";
import { manualInventoryUpsert } from "../inventory/manualInventoryUpsert";
import { resolveInventoryScan } from "../inventory/inventoryScanResolver";
import type { ManualInventoryUpsertResult } from "../inventory/types";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const adminActor: MovementActor = {
  uid: "identity-lifecycle-admin-001",
  email: "identity-lifecycle.admin@example.test",
  role: "admin",
};

const staffActor: MovementActor = {
  uid: "identity-lifecycle-staff-001",
  email: "identity-lifecycle.staff@example.test",
  role: "staff",
};

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

async function createInventoryWithLocks(
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const id = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await manualInventoryUpsert(
    {
      operationId: `create-${id}`,
      productId: "product-1",
      name: overrides.name ?? `Inventory ${id}`,
      category: overrides.category ?? "Supplies",
      manufacturer: overrides.manufacturer ?? "Test MFG",
      manufacturerItemId: overrides.manufacturerItemId ?? `MFG-${id}`,
      sku: overrides.sku ?? `SKU-${id}`,
      hcpc: overrides.hcpc ?? "A7030",
      barcode: overrides.barcode ?? `BAR-${id}`,
      serial: overrides.serial ?? `SER-${id}`,
      lotNumber: overrides.lotNumber ?? `LOT-${id}`,
      locationName: overrides.locationName ?? "Main Location",
      binLocation: overrides.binLocation ?? "A1",
      reorderLevel: overrides.reorderLevel ?? 2,
      unitCost: overrides.unitCost ?? 12.5,
      notes: "Identity lifecycle seed.",
      source: "inventory",
      sourceId: "identity_lifecycle_test",
      ...overrides,
    } as any,
    staffActor,
    db
  );

  const status = result.status;
  if (status !== "created" && status !== "merged") {
    throw new Error(`Failed to create seed inventory: ${JSON.stringify(result)}`);
  }

  return (result as { inventoryItemId: string }).inventoryItemId;
}

beforeEach(async () => {
  await Promise.all([
    db.recursiveDelete(db.collection("inventory")),
    db.recursiveDelete(db.collection("inventoryIdentityLocks")),
    db.recursiveDelete(db.collection("inventoryOperations")),
    db.recursiveDelete(db.collection("inventoryTransactions")),
    db.recursiveDelete(db.collection("auditLogs")),
    db.recursiveDelete(db.collection("products")),
    db.recursiveDelete(db.collection("users")),
  ]);
  await seedUser(adminActor.uid, { role: "admin", email: adminActor.email });
  await seedUser(staffActor.uid, { role: "staff", email: staffActor.email });
});

describe("inventory identity-lock lifecycle: hard delete", () => {
  it("hard delete removes the inventory document and leaves identity reclaimable", async () => {
    const barcode = "lifecycle-hard-barcode-001";
    const sku = "lifecycle-hard-sku-001";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      sku,
      name: "Hard Delete Target",
    });

    const barcodeLockKey = encodeURIComponent(`barcode:${barcode.toLowerCase()}`);
    const skuLockKey = encodeURIComponent(`sku_location:${sku.toLowerCase()}:main location:a1`);

    const barcodeLockBefore = await db.collection("inventoryIdentityLocks").doc(barcodeLockKey).get();
    const skuLockBefore = await db.collection("inventoryIdentityLocks").doc(skuLockKey).get();
    expect(barcodeLockBefore.exists).toBe(true);
    expect(skuLockBefore.exists).toBe(true);

    const hardDeleteOperationId = "lifecycle-hard-delete-op-001";
    const hardDeleteResult = await createInventoryMovement(
      {
        operationId: hardDeleteOperationId,
        movementType: "hard_delete",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Identity lifecycle hard delete test",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    expect(hardDeleteResult.status).toBe("success");

    const inventorySnap = await db.collection("inventory").doc(inventoryId).get();
    expect(inventorySnap.exists).toBe(false);

    const movementSnap = await db
      .collection("inventoryTransactions")
      .where("operationId", "==", hardDeleteOperationId)
      .get();
    expect(movementSnap.size).toBe(1);
    expect(movementSnap.docs[0].data().movementType).toBe("hard_delete");

    const operationSnap = await db
      .collection("inventoryOperations")
      .doc(`${adminActor.uid}_${hardDeleteOperationId}`)
      .get();
    expect(operationSnap.exists).toBe(true);
    expect(operationSnap.data()?.status).toBe("completed");

    const auditSnap = await db
      .collection("auditLogs")
      .where("targetId", "==", inventoryId)
      .get();
    expect(auditSnap.docs.some((doc) => doc.data().action === "inventory.hard_delete")).toBe(true);

    const barcodeLockAfter = await db.collection("inventoryIdentityLocks").doc(barcodeLockKey).get();
    expect(barcodeLockAfter.exists).toBe(true);

    const newItemResult = await manualInventoryUpsert(
      {
        operationId: "lifecycle-hard-reclaim-001",
        productId: "product-1",
        name: "Reclaimed Item",
        category: "Supplies",
        barcode,
        sku,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    expect(newItemResult.status).toBe("created");

    const newItemId = (newItemResult as { inventoryItemId: string }).inventoryItemId;
    const newItemSnap = await db.collection("inventory").doc(newItemId).get();
    expect(newItemSnap.exists).toBe(true);
    expect(newItemSnap.data()?.barcode).toBe(barcode);
    expect(newItemSnap.data()?.sku).toBe(sku);

    const newBarcodeLockSnap = await db.collection("inventoryIdentityLocks").doc(barcodeLockKey).get();
    expect(newBarcodeLockSnap.exists).toBe(true);
    expect(newBarcodeLockSnap.data()?.inventoryItemId).toBe(newItemId);

    const oldItemSnap = await db.collection("inventory").doc(inventoryId).get();
    expect(oldItemSnap.exists).toBe(false);
  });

  it("retries the same hard-delete operation deterministically after deletion", async () => {
    const barcode = "lifecycle-hard-barcode-002";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      name: "Hard Delete Retry Target",
    });

    const operationId = "lifecycle-hard-delete-op-002";
    const request = {
      operationId,
      movementType: "hard_delete" as const,
      inventoryItemId: inventoryId,
      quantity: 1,
      reason: "Hard delete retry",
      source: "inventory_page" as const,
    };

    const first = await createInventoryMovement(request, adminActor, db);

    expect(first.status).toBe("success");
    expect((await db.collection("inventory").doc(inventoryId).get()).exists).toBe(false);

    const retry = await createInventoryMovement(request, adminActor, db);

    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementId).toBe(first.movementId);

    const movements = await db
      .collection("inventoryTransactions")
      .where("operationId", "==", operationId)
      .get();
    expect(movements.size).toBe(1);
  });
});

describe("inventory identity-lock lifecycle: archive and recreate", () => {
  it("archive marks inventory as deleted and allows identity reclamation", async () => {
    const barcode = "lifecycle-archive-barcode-001";
    const sku = "lifecycle-archive-sku-001";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      sku,
      name: "Archive Target",
    });

    const archiveOperationId = "lifecycle-archive-op-001";
    const archiveResult = await createInventoryMovement(
      {
        operationId: archiveOperationId,
        movementType: "archived",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Identity lifecycle archive test",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    expect(archiveResult.status).toBe("success");

    const archivedSnap = await db.collection("inventory").doc(inventoryId).get();
    expect(archivedSnap.exists).toBe(true);
    expect(archivedSnap.data()?.isDeleted).toBe(true);
    expect(archivedSnap.data()?.deletedAt).toBeDefined();

    const resolved = await resolveInventoryScan(db, barcode, {
      fields: ["barcode"],
      includeUppercaseVariant: false,
    });
    expect(resolved.kind).toBe("not_found");

    const replacementResult = await manualInventoryUpsert(
      {
        operationId: "lifecycle-archive-reclaim-001",
        productId: "product-1",
        name: "Replacement Item",
        category: "Supplies",
        barcode,
        sku,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    expect(replacementResult.status).toBe("created");

    const replacementId = (replacementResult as { inventoryItemId: string }).inventoryItemId;
    const replacementSnap = await db.collection("inventory").doc(replacementId).get();
    expect(replacementSnap.exists).toBe(true);
    expect(replacementSnap.data()?.barcode).toBe(barcode);
    expect(replacementSnap.data()?.sku).toBe(sku);
    expect(replacementSnap.data()?.isDeleted).toBe(false);

    const archivedAfterSnap = await db.collection("inventory").doc(inventoryId).get();
    expect(archivedAfterSnap.exists).toBe(true);
    expect(archivedAfterSnap.data()?.isDeleted).toBe(true);

    const activeWithBarcode = await db
      .collection("inventory")
      .where("barcode", "==", barcode)
      .get();
    const activeDocs = activeWithBarcode.docs.filter(
      (doc) => doc.data().isDeleted !== true && doc.data().deleted !== true
    );
    expect(activeDocs).toHaveLength(1);
    expect(activeDocs[0].id).toBe(replacementId);
  });

  it("archived inventory does not block a legitimate replacement via manual upsert", async () => {
    const barcode = "lifecycle-archive-barcode-002";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      name: "Archive Block Test",
    });

    await createInventoryMovement(
      {
        operationId: "lifecycle-archive-op-002",
        movementType: "archived",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Archive for replacement test",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    const replacementResult = await manualInventoryUpsert(
      {
        operationId: "lifecycle-archive-reclaim-002",
        productId: "product-1",
        name: "Replacement After Archive",
        category: "Supplies",
        barcode,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    expect(["created", "merged"]).toContain(replacementResult.status);

    if (replacementResult.status === "created") {
      const replacementId = (replacementResult as { inventoryItemId: string }).inventoryItemId;
      const snap = await db.collection("inventory").doc(replacementId).get();
      expect(snap.data()?.barcode).toBe(barcode);
      expect(snap.data()?.isDeleted).toBe(false);
    }
  });
});

describe("inventory identity-lock lifecycle: discontinue semantics", () => {
  it("discontinue retires inventory but preserves identity reservation", async () => {
    const barcode = "lifecycle-disc-barcode-001";
    const sku = "lifecycle-disc-sku-001";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      sku,
      name: "Discontinue Target",
    });

    const discontinueOperationId = "lifecycle-disc-op-001";
    const discontinueResult = await createInventoryMovement(
      {
        operationId: discontinueOperationId,
        movementType: "discontinued",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Identity lifecycle discontinue test",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    expect(discontinueResult.status).toBe("success");

    const discSnap = await db.collection("inventory").doc(inventoryId).get();
    expect(discSnap.exists).toBe(true);
    expect(discSnap.data()?.status).toBe("discontinued");
    expect(discSnap.data()?.lifecycleStatus).toBe("retired");
    expect(discSnap.data()?.isDeleted).toBe(false);

    const resolved = await resolveInventoryScan(db, barcode, {
      fields: ["barcode"],
      includeUppercaseVariant: false,
    });
    expect(resolved.kind).toBe("resolved");
    expect((resolved as { kind: "resolved"; inventoryItemId: string }).inventoryItemId).toBe(inventoryId);

    const upsertResult = await manualInventoryUpsert(
      {
        operationId: "lifecycle-disc-reclaim-001",
        productId: "product-1",
        name: "Should Not Create Duplicate",
        category: "Supplies",
        barcode,
        sku,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    expect(upsertResult.status).toBe("merged");
    expect((upsertResult as { status: "merged"; inventoryItemId: string }).inventoryItemId).toBe(inventoryId);

    const finalSnap = await db.collection("inventory").doc(inventoryId).get();
    expect(finalSnap.data()?.status).toBe("discontinued");
    expect(finalSnap.data()?.lifecycleStatus).toBe("retired");

    const allWithBarcode = await db
      .collection("inventory")
      .where("barcode", "==", barcode)
      .get();
    expect(allWithBarcode.size).toBe(1);
  });

  it("discontinued inventory blocks issuance movements deterministically", async () => {
    const barcode = "lifecycle-disc-barcode-002";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      name: "Discontinue Movement Block Test",
    });

    await createInventoryMovement(
      {
        operationId: "lifecycle-disc-op-002",
        movementType: "discontinued",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Discontinue for movement block test",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    await expect(
      createInventoryMovement(
        {
          operationId: "lifecycle-disc-receive-002",
          movementType: "receive",
          inventoryItemId: inventoryId,
          quantity: 1,
          reason: "Should fail on discontinued",
          source: "inventory_page",
        },
        staffActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Discontinued products may be returned but not newly issued.",
    });

    await expect(
      createInventoryMovement(
        {
          operationId: "lifecycle-disc-issue-002",
          movementType: "patient_assignment",
          inventoryItemId: inventoryId,
          quantity: 1,
          reason: "Should fail on discontinued",
          source: "inventory_page",
        },
        staffActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});

describe("inventory identity-lock lifecycle: concurrency", () => {
  it("concurrent reclaims of a released identity produce one active winner", async () => {
    const barcode = "lifecycle-concurrent-barcode-001";
    const inventoryId = await createInventoryWithLocks({
      barcode,
      name: "Concurrent Reclaim Target",
    });

    await createInventoryMovement(
      {
        operationId: "lifecycle-concurrent-hard-delete-001",
        movementType: "hard_delete",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Release identity for concurrent reclaim",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    const first = manualInventoryUpsert(
      {
        operationId: "lifecycle-concurrent-reclaim-a",
        productId: "product-1",
        name: "Concurrent Reclaim A",
        category: "Supplies",
        barcode,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    const second = manualInventoryUpsert(
      {
        operationId: "lifecycle-concurrent-reclaim-b",
        productId: "product-1",
        name: "Concurrent Reclaim B",
        category: "Supplies",
        barcode,
        locationName: "Main Location",
        binLocation: "A1",
      },
      staffActor,
      db
    );

    const settled = await Promise.allSettled([first, second]);
    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const results = settled.map((result) => {
      if (result.status !== "fulfilled") throw result.reason;
      return result.value as ManualInventoryUpsertResult;
    });

    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual(["created", "merged"]);

    const uniqueIds = new Set(results.map((result) => (result as { inventoryItemId: string }).inventoryItemId));
    expect(uniqueIds.size).toBe(1);

    const activeDocs = await db
      .collection("inventory")
      .where("barcode", "==", barcode)
      .get();
    const active = activeDocs.docs.filter((docSnap) => {
      const data = docSnap.data();
      return data.isDeleted !== true && data.deleted !== true;
    });
    expect(active).toHaveLength(1);
  });
});
