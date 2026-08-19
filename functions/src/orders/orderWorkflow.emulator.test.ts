import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  clearEmulatorData,
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "../test-utils/emulator-setup";
import { orderWorkflowCallable } from "../orders/orderWorkflowFunctions";
import { recordDeliveryScanWorkflowCallable } from "../domainWorkflows/domainWorkflowFunctions";
import type { MovementActor } from "../inventory/movementService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const actor: MovementActor = {
  uid: "order-workflow-actor-001",
  email: "order-workflow@test.example.com",
  role: "staff",
};

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

async function invokeOrderWorkflow(data: Record<string, unknown>) {
  const callable = orderWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  return callable.run(callableRequest(data, { uid: actor.uid, role: actor.role, email: actor.email }));
}

async function invokeDeliveryScan(data: Record<string, unknown>) {
  const callable = recordDeliveryScanWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  return callable.run(callableRequest(data, { uid: actor.uid, role: actor.role, email: actor.email }));
}

async function seedInventory(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("inventory").doc(id).set({
    name: `Order Test Item ${id}`,
    productId: `product-order-test`,
    barcode: `ORD-${id}`,
    sku: `SKU-ORDER-${id}`,
    quantityOnHand: 10,
    committed: 0,
    onRent: 0,
    onTruck: 0,
    available: 10,
    status: "available",
    lifecycleStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedProduct(id: string) {
  await db.collection("products").doc(id).set({
    name: `Order Test Product ${id}`,
    category: "Test",
    sku: `SKU-${id}`,
    barcode: `PROD-${id}`,
    price: 100,
    quantityOnHand: 10,
    reorderLevel: 1,
    status: "active",
  });
}

beforeEach(async () => {
  await clearEmulatorData();
  await seedProduct("product-order-test");
});

describe("order workflow emulator", () => {
  it("create order + allocation succeeds atomically", async () => {
    await seedInventory("inv-create-001", { quantityOnHand: 5, available: 5 });
    const operationId = "order-create-001";

    const result = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });

    expect(result.status).toBe("success");
    const createResult = result as {
      orderId?: string;
      inventoryAllocated?: boolean;
      inventoryRestored?: boolean;
      allocations?: Array<{ inventoryItemId: string; quantity: number }>;
      movementIds?: string[];
    };
    expect(createResult.orderId).toBeDefined();
    expect(createResult.inventoryAllocated).toBe(true);
    expect(createResult.inventoryRestored).toBe(false);
    expect((createResult.allocations ?? []).length).toBeGreaterThanOrEqual(1);
    expect((createResult.movementIds ?? []).length).toBeGreaterThanOrEqual(1);

    const orderId = result.orderId as string;
    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.exists).toBe(true);
    expect((orderSnap.data()?.inventoryAllocated as boolean)).toBe(true);
    expect((orderSnap.data()?.inventoryRestored as boolean)).toBe(false);
    expect((orderSnap.data()?.inventoryAllocations as Array<{ inventoryItemId: string; quantity: number }>)?.[0]?.quantity).toBe(3);

    expect(orderSnap.data()?.patientKey).toBe("test patient|addr:123testst");
    expect(orderSnap.data()?.orderKey).toBe("test patient product order test");
    expect(orderSnap.data()?.searchText).toBeTruthy();
    expect(orderSnap.data()?.normalizedName).toBe("test patient");
    expect(orderSnap.data()?.normalizedPhone).toBe("");
    expect(orderSnap.data()?.normalizedAddress).toBe("123 test st");
    expect(orderSnap.data()?.isHospice).toBe(false);
    expect(orderSnap.data()?.linkedPatientId).toBe("");
    expect(orderSnap.data()?.linkedInventoryId).toBe("product-order-test");
    expect(orderSnap.data()?.inventoryAllocationSourceId).toBe("");
    expect(orderSnap.data()?.createdBy).toBe(actor.email ?? actor.uid);
    expect(orderSnap.data()?.createdByUid).toBe(actor.uid);

    const invSnap = await db.collection("inventory").doc("inv-create-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(2);
  });

  it("insufficient inventory creates no order and changes no stock", async () => {
    await seedInventory("inv-insufficient-001", { quantityOnHand: 2, available: 2 });

    await expect(
      invokeOrderWorkflow({
        operationId: "order-insufficient-001",
        action: "create",
        productId: "product-order-test",
        quantity: 5,
        patientName: "Test Patient",
        patientAddress: "123 Test St",
      })
    ).rejects.toThrow();

    const ordersSnap = await db.collection("orders").get();
    expect(ordersSnap.empty).toBe(true);

    const invSnap = await db.collection("inventory").doc("inv-insufficient-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(2);
  });

  it("duplicate create with same operationId returns deterministic result", async () => {
    await seedInventory("inv-dup-001", { quantityOnHand: 5, available: 5 });
    const operationId = "order-dup-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    expect(first.status).toBe("success");
    const firstOrderId = first.orderId as string;

    const second = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    expect(second.status).toBe("duplicate_operation");
    expect(second.orderId).toBe(firstOrderId);

    const invSnap = await db.collection("inventory").doc("inv-dup-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(3);
  });

  it("same operationId + different request fails conflict", async () => {
    await seedInventory("inv-conflict-001", { quantityOnHand: 5, available: 5 });
    const operationId = "order-conflict-001";

    await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test",
        quantity: 3,
        patientName: "Different Patient",
        patientAddress: "456 Other St",
      })
    ).rejects.toThrow();
  });

  it("cancel restores exact allocation and sets inventoryRestored", async () => {
    await seedInventory("inv-cancel-001", { quantityOnHand: 5, available: 5 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-cancel-001",
      action: "create",
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    const orderId = createResult.orderId as string;
    expect(createResult.status).toBe("success");

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-cancel-action",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
    });
    expect(cancelResult.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect((orderSnap.data()?.status as string)).toBe("cancelled");
    expect((orderSnap.data()?.inventoryRestored as boolean)).toBe(true);

    const invSnap = await db.collection("inventory").doc("inv-cancel-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(5);
  });

  it("duplicate cancel does not double restore", async () => {
    await seedInventory("inv-dup-cancel-001", { quantityOnHand: 5, available: 5 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-dup-cancel-001",
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    const orderId = createResult.orderId as string;

    const firstCancel = await invokeOrderWorkflow({
      operationId: "order-dup-cancel-action-1",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(firstCancel.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId: "order-dup-cancel-action-2",
        action: "cancel",
        orderId,
        productId: "product-order-test",
        quantity: 2,
        patientName: "Test Patient",
      })
    ).rejects.toThrow();

    const invSnap = await db.collection("inventory").doc("inv-dup-cancel-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(5);
  });

  it("restore allocates current inventory and records new snapshot", async () => {
    await seedInventory("inv-restore-001", { quantityOnHand: 5, available: 5 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-restore-001",
      action: "create",
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    const orderId = createResult.orderId as string;

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-restore-cancel",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
    });
    expect(cancelResult.status).toBe("success");

    const restoreResult = await invokeOrderWorkflow({
      operationId: "order-restore-action",
      action: "restore",
      orderId,
      productId: "product-order-test",
      quantity: 3,
      patientName: "Test Patient",
    });
    expect(restoreResult.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect((orderSnap.data()?.status as string)).toBe("processing");
    expect((orderSnap.data()?.inventoryAllocated as boolean)).toBe(true);
    expect((orderSnap.data()?.inventoryRestored as boolean)).toBe(false);
    expect((orderSnap.data()?.inventoryAllocations as Array<{ inventoryItemId: string; quantity: number }>)?.[0]?.quantity).toBe(3);

    const invSnap = await db.collection("inventory").doc("inv-restore-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(2);
  });

  it("restore with insufficient stock changes nothing", async () => {
    await seedInventory("inv-restore-fail-001", { quantityOnHand: 2, available: 2 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-restore-fail-001",
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    const orderId = createResult.orderId as string;

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-restore-fail-cancel",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(cancelResult.status).toBe("success");

    await db.collection("inventory").doc("inv-restore-fail-001").update({
      quantityOnHand: 1,
      available: 1,
    });

    await expect(
      invokeOrderWorkflow({
        operationId: "order-restore-fail-action",
        action: "restore",
        orderId,
        productId: "product-order-test",
        quantity: 3,
        patientName: "Test Patient",
      })
    ).rejects.toThrow();

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect((orderSnap.data()?.status as string)).toBe("cancelled");
    expect((orderSnap.data()?.inventoryRestored as boolean)).toBe(true);

    const invSnap = await db.collection("inventory").doc("inv-restore-fail-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(1);
  });

  it("concurrent final-stock orders do not oversell", async () => {
    await seedInventory("inv-concurrent-001", { quantityOnHand: 2, available: 2 });

    const [result1, result2] = await Promise.allSettled([
      invokeOrderWorkflow({
        operationId: "order-concurrent-001",
        action: "create",
        productId: "product-order-test",
        quantity: 2,
        patientName: "Patient A",
        patientAddress: "123 A St",
      }),
      invokeOrderWorkflow({
        operationId: "order-concurrent-002",
        action: "create",
        productId: "product-order-test",
        quantity: 2,
        patientName: "Patient B",
        patientAddress: "456 B St",
      }),
    ]);

    const successes = [result1, result2].filter((r) => r.status === "fulfilled" && (r.value as { status: string }).status === "success");
    expect(successes.length).toBeLessThanOrEqual(1);

    const invSnap = await db.collection("inventory").doc("inv-concurrent-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBeGreaterThanOrEqual(0);
  });



  it("serialized inventory caps allocation at one unit per item", async () => {
    await seedInventory("inv-serialized-001", {
      quantityOnHand: 1,
      available: 1,
      isSerialized: true,
      serial: "SER-SERIALIZED-001",
    });

    const result = await invokeOrderWorkflow({
      operationId: "order-serialized-001",
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });

    expect(result.status).toBe("success");
    expect(result.orderId).toBeDefined();
    expect((result.allocations as Array<{ inventoryItemId: string; quantity: number }> | undefined)?.[0]?.quantity).toBe(1);
  });

  it("order creation never leaves partial document on failure", async () => {
    await seedInventory("inv-partial-001", { quantityOnHand: 0, available: 0 });

    await expect(
      invokeOrderWorkflow({
        operationId: "order-partial-001",
        action: "create",
        productId: "product-order-test",
        quantity: 1,
        patientName: "Test Patient",
        patientAddress: "123 Test St",
      })
    ).rejects.toThrow();

    const ordersSnap = await db.collection("orders").get();
    expect(ordersSnap.empty).toBe(true);
  });

  it("simulated client retry with retained operationId produces no second order or allocation", async () => {
    await seedInventory("inv-retry-001", { quantityOnHand: 5, available: 5 });
    const operationId = "order-retry-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    expect(first.status).toBe("success");
    const firstOrderId = first.orderId as string;

    const second = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });
    expect(second.status).toBe("duplicate_operation");
    expect(second.orderId).toBe(firstOrderId);

    const ordersSnap = await db.collection("orders").get();
    expect(ordersSnap.size).toBe(1);

    const invSnap = await db.collection("inventory").doc("inv-retry-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(3);

    const movementsSnap = await db.collection("inventoryTransactions").get();
    const allocationMovements = movementsSnap.docs.filter(
      (doc) => (doc.data()?.movementType as string) === "order_allocation"
    );
    expect(allocationMovements.length).toBe(1);
  });

  it("create result exposes authoritative order state for client", async () => {
    await seedInventory("inv-result-001", { quantityOnHand: 5, available: 5 });
    const operationId = "order-result-001";

    const result = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Test Patient",
      patientAddress: "123 Test St",
    });

    expect(result.status).toBe("success");
    expect(result.orderId).toBeDefined();
    expect(result.inventoryAllocated).toBe(true);
    expect(result.inventoryRestored).toBe(false);
    expect(result.workflowType).toBe("order.create");
    expect(result.operationId).toBe(operationId);
  });

  // ── CREATE Fingerprint-focused tests ─────────────────────────────────────

  it("same operationId + identical CREATE request => same orderId, no second inventory effect", async () => {
    await seedInventory("inv-fp-identical-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-identical-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 3,
      patientName: "Alice Smith",
      patientAddress: "100 Main St",
      productType: "Wheelchair",
      purchaseCost: 250,
      barcode: "BC-001",
      phone: "555-0100",
      facilityName: "Facility A",
      notes: "Leave at door",
    });
    expect(first.status).toBe("success");
    const firstOrderId = first.orderId as string;

    const second = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 3,
      patientName: "Alice Smith",
      patientAddress: "100 Main St",
      productType: "Wheelchair",
      purchaseCost: 250,
      barcode: "BC-001",
      phone: "555-0100",
      facilityName: "Facility A",
      notes: "Leave at door",
    });
    expect(second.status).toBe("duplicate_operation");
    expect(second.orderId).toBe(firstOrderId);

    // Only 1 order created
    const ordersSnap = await db.collection("orders").get();
    expect(ordersSnap.size).toBe(1);

    // Inventory decremented only once (10 - 3 = 7)
    const invSnap = await db.collection("inventory").doc("inv-fp-identical-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(7);

    // Only 1 allocation movement recorded
    const movementsSnap = await db.collection("inventoryTransactions").get();
    const allocMovements = movementsSnap.docs.filter(
      (doc) => (doc.data()?.movementType as string) === "order_allocation"
    );
    expect(allocMovements.length).toBe(1);
  });

  it("same operationId + changed quantity => conflict", async () => {
    await seedInventory("inv-fp-qty-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-qty-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Bob Jones",
      patientAddress: "200 Oak Ave",
    });
    expect(first.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test",
        quantity: 5,
        patientName: "Bob Jones",
        patientAddress: "200 Oak Ave",
      })
    ).rejects.toThrow();

    // Original order preserved, inventory affected only once
    const invSnap = await db.collection("inventory").doc("inv-fp-qty-001").get();
    expect((invSnap.data()?.quantityOnHand as number)).toBe(8);
  });

  it("same operationId + changed productId => conflict", async () => {
    await seedInventory("inv-fp-prod-001", { quantityOnHand: 10, available: 10 });
    await seedProduct("product-order-test-2");
    await seedInventory("inv-fp-prod-002", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-prod-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Carol Lee",
      patientAddress: "300 Pine Rd",
    });
    expect(first.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test-2",
        quantity: 2,
        patientName: "Carol Lee",
        patientAddress: "300 Pine Rd",
      })
    ).rejects.toThrow();
  });

  it("same operationId + changed address => conflict", async () => {
    await seedInventory("inv-fp-addr-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-addr-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Dave Wilson",
      patientAddress: "400 Elm St",
      purchaseCost: 100,
      notes: "Original notes",
    });
    expect(first.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test",
        quantity: 1,
        patientName: "Dave Wilson",
        patientAddress: "999 CHANGED St",
        purchaseCost: 100,
        notes: "Original notes",
      })
    ).rejects.toThrow();
  });

  it("same operationId + changed purchaseCost => conflict", async () => {
    await seedInventory("inv-fp-cost-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-cost-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Eve Brown",
      patientAddress: "500 Cedar Ln",
      purchaseCost: 150,
    });
    expect(first.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test",
        quantity: 1,
        patientName: "Eve Brown",
        patientAddress: "500 Cedar Ln",
        purchaseCost: 999,
      })
    ).rejects.toThrow();
  });

  it("same operationId + changed notes => conflict", async () => {
    await seedInventory("inv-fp-notes-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-notes-001";

    const first = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Frank Miller",
      patientAddress: "600 Birch Dr",
      notes: "Original note text",
    });
    expect(first.status).toBe("success");

    await expect(
      invokeOrderWorkflow({
        operationId,
        action: "create",
        productId: "product-order-test",
        quantity: 1,
        patientName: "Frank Miller",
        patientAddress: "600 Birch Dr",
        notes: "CHANGED note text",
      })
    ).rejects.toThrow();
  });

  it("stored operation fingerprint does NOT contain raw patientName, patientAddress, phone, or notes", async () => {
    await seedInventory("inv-fp-nophi-001", { quantityOnHand: 10, available: 10 });
    const operationId = "fp-nophi-001";

    const result = await invokeOrderWorkflow({
      operationId,
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Grace Hopper",
      patientAddress: "700 Secure Blvd",
      phone: "555-0700",
      notes: "Confidential delivery note",
    });
    expect(result.status).toBe("success");

    // Read the stored domainWorkflowOperations document
    const opRef = db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`);
    const opSnap = await opRef.get();
    expect(opSnap.exists).toBe(true);

    const opData = opSnap.data()!;
    const storedFingerprint = String(opData.requestFingerprint ?? "");

    // The fingerprint should be a SHA-256 hex string (64 hex chars)
    expect(storedFingerprint).toMatch(/^[a-f0-9]{64}$/);

    // Verify NO raw PHI/PII is present in the stored fingerprint
    expect(storedFingerprint).not.toContain("Grace Hopper");
    expect(storedFingerprint).not.toContain("700 Secure Blvd");
    expect(storedFingerprint).not.toContain("555-0700");
    expect(storedFingerprint).not.toContain("Confidential delivery note");

    // Also verify no raw PHI in the entire operation document's requestFingerprint field
    const fullDoc = JSON.stringify(opData);
    expect(fullDoc).not.toContain("Grace Hopper");
    expect(fullDoc).not.toContain("Confidential delivery note");
  });

  // ── Legacy cancel fail-closed: missing allocation snapshot ───────────────

  it("cancel fails closed when inventoryAllocated=true but inventoryAllocations is missing", async () => {
    // Seed a legacy order directly — simulates data written before allocation snapshots existed
    const orderId = "legacy-order-missing-allocations";
    await db.collection("orders").doc(orderId).set({
      productId: "product-order-test",
      quantity: 2,
      patientName: "Legacy Patient",
      patientAddress: "999 Legacy Rd",
      status: "processing",
      inventoryAllocated: true,
      inventoryRestored: false,
      // inventoryAllocations field is intentionally ABSENT
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Attempt cancellation — must reject with failed-precondition
    await expect(
      invokeOrderWorkflow({
        operationId: "cancel-legacy-missing-001",
        action: "cancel",
        orderId,
        productId: "product-order-test",
        quantity: 2,
        patientName: "Legacy Patient",
      })
    ).rejects.toThrow(/failed-precondition|allocation snapshot/i);

    // Order must remain unchanged
    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.exists).toBe(true);
    expect(orderSnap.data()?.status).toBe("processing");
    expect(orderSnap.data()?.inventoryRestored).toBe(false);

    // No order_restoration movement must exist
    const movementsSnap = await db.collection("inventoryTransactions").get();
    const restorationMovements = movementsSnap.docs.filter(
      (doc) => (doc.data()?.movementType as string) === "order_restoration"
    );
    expect(restorationMovements.length).toBe(0);
  });

  it("cancel fails closed when inventoryAllocated=true but inventoryAllocations is empty array", async () => {
    // Seed an order with an empty allocations array — corrupt/legacy state
    const orderId = "legacy-order-empty-allocations";
    await db.collection("orders").doc(orderId).set({
      productId: "product-order-test",
      quantity: 3,
      patientName: "Empty Alloc Patient",
      patientAddress: "888 Empty St",
      status: "processing",
      inventoryAllocated: true,
      inventoryRestored: false,
      inventoryAllocations: [], // present but empty
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Attempt cancellation — must reject with failed-precondition
    await expect(
      invokeOrderWorkflow({
        operationId: "cancel-legacy-empty-001",
        action: "cancel",
        orderId,
        productId: "product-order-test",
        quantity: 3,
        patientName: "Empty Alloc Patient",
      })
    ).rejects.toThrow(/failed-precondition|allocation snapshot/i);

    // Order must remain unchanged
    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.exists).toBe(true);
    expect(orderSnap.data()?.status).toBe("processing");
    expect(orderSnap.data()?.inventoryRestored).toBe(false);

    // No order_restoration movement must exist
    const movementsSnap = await db.collection("inventoryTransactions").get();
    const restorationMovements = movementsSnap.docs.filter(
      (doc) => (doc.data()?.movementType as string) === "order_restoration"
    );
    expect(restorationMovements.length).toBe(0);
  });
});
