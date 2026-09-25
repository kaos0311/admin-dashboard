import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "./emulator-setup";
import {
  manualInventoryMetadataUpdate,
  manualInventoryMetadataUpdateCallable,
} from "../inventory/manualInventoryMetadataUpdate";
import type {
  ManualInventoryMetadataUpdateInput,
  ManualInventoryMetadataUpdateResult,
} from "../inventory/types";
import type { MovementActor } from "../inventory/movementService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const actor: MovementActor = {
  uid: "metadata-update-staff-001",
  email: "metadata-update-staff@example.test",
  role: "staff",
};

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function baseInput(overrides: Partial<ManualInventoryMetadataUpdateInput> = {}): ManualInventoryMetadataUpdateInput {
  return {
    operationId: "metadata-update-op-001",
    inventoryItemId: "metadata-target",
    productId: "product-1",
    name: "Updated Manual Item",
    category: "Supplies",
    manufacturer: "Acme",
    manufacturerItemId: "MFG-UPDATED",
    sku: "SKU-UPDATED",
    hcpc: "A7030",
    barcode: "BAR-UPDATED",
    serial: "SER-UPDATED",
    lotNumber: "LOT-UPDATED",
    reorderLevel: 2,
    unitCost: 12.5,
    modelNumber: "Model 1",
    warrantyProvider: "Warranty Co",
    warrantyStartDate: "2026-01-01",
    warrantyEndDate: "2027-01-01",
    warrantyNotes: "Covered",
    purchaseDate: "2026-01-02",
    usefulLifeMonths: 24,
    nextServiceDate: "2026-07-01",
    lifecycleNotes: "Service note",
    notes: "Updated notes",
    searchText: "updated manual item",
    pendingScanReview: false,
    scanSource: "inventory_review_completed",
    lowStock: false,
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

async function invokeManualInventoryMetadataUpdateCallable(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
) {
  const callable = manualInventoryMetadataUpdateCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<ManualInventoryMetadataUpdateResult>;
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
    db.recursiveDelete(db.collection("rateLimitBuckets")),
    db.recursiveDelete(db.collection("users")),
  ]);
  await seedUser(actor.uid, { role: actor.role, email: actor.email });
  await seedInventory("metadata-target", {
    barcode: "BAR-OLD",
    serial: "SER-OLD",
    lotNumber: "LOT-OLD",
    sku: "SKU-OLD",
    manufacturerItemId: "MFG-OLD",
    quantityOnHand: 7,
    available: 6,
    committed: 1,
    onRent: 0,
    onOrder: 3,
    status: "available",
    lifecycleStatus: "active",
  });
});

describe("manualInventoryMetadataUpdate", () => {
  it("updates approved metadata and preserves protected stock state", async () => {
    const result = await manualInventoryMetadataUpdate(baseInput(), actor, db);

    expect(result).toEqual({
      status: "success",
      inventoryItemId: "metadata-target",
    });
    const inventory = (await db.collection("inventory").doc("metadata-target").get()).data();
    expect(inventory).toMatchObject({
      productId: "product-1",
      name: "Updated Manual Item",
      category: "Supplies",
      barcode: "BAR-UPDATED",
      serial: "SER-UPDATED",
      lotNumber: "LOT-UPDATED",
      sku: "SKU-UPDATED",
      manufacturerItemId: "MFG-UPDATED",
      quantityOnHand: 7,
      available: 6,
      committed: 1,
      onRent: 0,
      onOrder: 3,
      status: "available",
      lifecycleStatus: "active",
    });
  });

  it("rejects unauthorized callable roles", async () => {
    await seedUser("metadata-viewer", { role: "billing" });

    await expect(
      invokeManualInventoryMetadataUpdateCallable(
        baseInput({ operationId: "metadata-unauthorized" }) as unknown as Record<string, unknown>,
        { uid: "metadata-viewer", role: "billing" },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects disabled otherwise-authorized callable users", async () => {
    await seedUser("metadata-disabled", { role: "staff", disabled: true });

    await expect(
      invokeManualInventoryMetadataUpdateCallable(
        baseInput({ operationId: "metadata-disabled" }) as unknown as Record<string, unknown>,
        { uid: "metadata-disabled", role: "staff" },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("rejects protected stock fields", async () => {
    await expect(
      manualInventoryMetadataUpdate(
        {
          ...baseInput({ operationId: "metadata-protected-stock" }),
          quantityOnHand: 99,
          available: 99,
        } as unknown as ManualInventoryMetadataUpdateInput,
        actor,
        db,
      ),
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects status and lifecycle fields", async () => {
    await expect(
      manualInventoryMetadataUpdate(
        {
          ...baseInput({ operationId: "metadata-protected-status" }),
          status: "damaged",
          lifecycleStatus: "retired",
        } as unknown as ManualInventoryMetadataUpdateInput,
        actor,
        db,
      ),
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("validates identity fields before update", async () => {
    await expect(
      manualInventoryMetadataUpdate(
        baseInput({
          operationId: "metadata-invalid-barcode",
          barcode: "https://example.invalid/qr",
        }),
        actor,
        db,
      ),
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("fails closed when identity would match another active inventory record", async () => {
    await seedInventory("identity-conflict", { barcode: "BAR-CONFLICT" });

    await expect(
      manualInventoryMetadataUpdate(
        baseInput({
          operationId: "metadata-identity-conflict",
          barcode: "BAR-CONFLICT",
        }),
        actor,
        db,
      ),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  it("does not treat productId as inventory identity", async () => {
    await seedInventory("same-product", {
      productId: "product-shared",
      barcode: "BAR-OTHER",
      serial: "SER-OTHER",
      lotNumber: "LOT-OTHER",
      sku: "SKU-OTHER",
      manufacturerItemId: "MFG-OTHER",
    });

    const result = await manualInventoryMetadataUpdate(
      baseInput({
        operationId: "metadata-product-id",
        productId: "product-shared",
        barcode: "BAR-UNIQUE-PRODUCT",
        serial: "SER-UNIQUE-PRODUCT",
        lotNumber: "LOT-UNIQUE-PRODUCT",
        sku: "SKU-UNIQUE-PRODUCT",
        manufacturerItemId: "MFG-UNIQUE-PRODUCT",
      }),
      actor,
      db,
    );

    expect(result.status).toBe("success");
    const inventory = (await db.collection("inventory").doc("metadata-target").get()).data();
    expect(inventory?.productId).toBe("product-shared");
  });

  it("rejects location and bin changes so metadata edits cannot bypass transfer semantics", async () => {
    await expect(
      manualInventoryMetadataUpdate(
        {
          ...baseInput({ operationId: "metadata-location-rejected" }),
          locationName: "Other Warehouse",
          binLocation: "B2",
        } as unknown as ManualInventoryMetadataUpdateInput,
        actor,
        db,
      ),
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("serializes concurrent identity edits through identity locks", async () => {
    await seedInventory("second-target", {
      barcode: "BAR-SECOND",
      serial: "SER-SECOND",
      lotNumber: "LOT-SECOND",
      sku: "SKU-SECOND",
      manufacturerItemId: "MFG-SECOND",
    });

    const first = manualInventoryMetadataUpdate(
      baseInput({
        operationId: "metadata-concurrent-a",
        inventoryItemId: "metadata-target",
        barcode: "BAR-CONCURRENT-METADATA",
        serial: "SER-CONCURRENT-METADATA",
        lotNumber: "LOT-CONCURRENT-METADATA",
        sku: "SKU-CONCURRENT-METADATA-A",
        manufacturerItemId: "MFG-CONCURRENT-METADATA-A",
      }),
      actor,
      db,
    );
    const second = manualInventoryMetadataUpdate(
      baseInput({
        operationId: "metadata-concurrent-b",
        inventoryItemId: "second-target",
        barcode: "BAR-CONCURRENT-METADATA",
        serial: "SER-CONCURRENT-METADATA-B",
        lotNumber: "LOT-CONCURRENT-METADATA-B",
        sku: "SKU-CONCURRENT-METADATA-B",
        manufacturerItemId: "MFG-CONCURRENT-METADATA-B",
      }),
      actor,
      db,
    );

    const settled = await Promise.allSettled([first, second]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((result) => result.status === "rejected")).toHaveLength(1);

    const snap = await db.collection("inventory").where("barcode", "==", "BAR-CONCURRENT-METADATA").get();
    expect(snap.size).toBe(1);
  });

  it("replays exact retry idempotently", async () => {
    const input = baseInput({
      operationId: "metadata-replay",
      barcode: "BAR-REPLAY",
    });

    const first = await manualInventoryMetadataUpdate(input, actor, db);
    const second = await manualInventoryMetadataUpdate(input, actor, db);

    expect(first).toEqual({
      status: "success",
      inventoryItemId: "metadata-target",
    });
    expect(second).toEqual({
      status: "duplicate_operation",
      inventoryItemId: "metadata-target",
    });
  });

  it("rejects same operationId with different request data", async () => {
    const input = baseInput({
      operationId: "metadata-conflict",
      barcode: "BAR-METADATA-CONFLICT",
    });
    await manualInventoryMetadataUpdate(input, actor, db);

    await expect(
      manualInventoryMetadataUpdate({ ...input, name: "Different Name" }, actor, db),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });
});
