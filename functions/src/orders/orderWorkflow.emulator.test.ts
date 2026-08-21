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

async function invokeOrderWorkflow(data: Record<string, unknown>): Promise<any> {
  const callable = orderWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<any>;
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

  it("edit updates non-inventory fields on a non-allocated order", async () => {
    const orderId = "edit-order-non-allocated";
    await db.collection("orders").doc(orderId).set({
      productId: "product-edit-test",
      quantity: 1,
      patientName: "Edit Patient",
      patientAddress: "123 Edit St",
      productType: "Edit Product",
      purchaseCost: 50,
      barcode: "EDIT-001",
      phone: "555-0100",
      facilityName: "Edit Facility",
      notes: "original notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-edit-test",
      patientKey: "edit patient",
      orderKey: "edit patient edit product",
      searchText: "edit patient 123 edit st edit product 555-0100 edit facility original notes edit-001 edit patient edit patient edit product",
      normalizedName: "edit patient",
      normalizedDob: "",
      normalizedPhone: "5550100",
      normalizedAddress: "123 edit st",
      needsReview: true,
      reviewReasons: ["missingPhone"],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    const result = await invokeOrderWorkflow({
      operationId: "edit-non-alloc-001",
      action: "edit",
      orderId,
      productId: "product-edit-test",
      quantity: 1,
      patientName: "Edit Patient Updated",
      patientAddress: "456 Updated Ave",
      productType: "Updated Product",
      purchaseCost: 75,
      barcode: "EDIT-002",
      phone: "555-0200",
      facilityName: "Updated Facility",
      notes: "updated notes",
    });

    expect(result.status).toBe("success");
    expect(result.orderId).toBe(orderId);
    expect(result.orderStatus).toBe("processing");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.patientName).toBe("Edit Patient Updated");
    expect(data.patientAddress).toBe("456 Updated Ave");
    expect(data.productType).toBe("Updated Product");
    expect(data.purchaseCost).toBe(75);
    expect(data.barcode).toBe("EDIT-002");
    expect(data.phone).toBe("555-0200");
    expect(data.facilityName).toBe("Updated Facility");
    expect(data.notes).toBe("updated notes");
    expect(data.inventoryAllocated).toBe(false);
    expect(data.inventoryRestored).toBe(false);
    expect(data.searchText).toContain("updated notes");
  });

  it("edit preserves inventory fields and rejects product/quantity changes on allocated order", async () => {
    const orderId = "edit-order-allocated";
    await db.collection("orders").doc(orderId).set({
      productId: "product-alloc-edit",
      quantity: 2,
      patientName: "Alloc Edit Patient",
      patientAddress: "789 Alloc St",
      productType: "Alloc Product",
      purchaseCost: 100,
      barcode: "ALLOC-EDIT-001",
      phone: "555-0300",
      facilityName: "Alloc Facility",
      notes: "allocated notes",
      status: "processing",
      inventoryAllocated: true,
      inventoryRestored: false,
      inventoryAllocations: [
        { inventoryItemId: "inv-alloc-edit-1", quantity: 2, movementId: "mov-alloc-edit-1" },
      ],
      inventoryAllocationSourceId: "source-edit-1",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-alloc-edit",
      patientKey: "alloc edit patient",
      orderKey: "alloc edit patient alloc product",
      searchText: "alloc edit patient 789 alloc st alloc product 555-0300 alloc facility allocated notes alloc-edit-001 alloc edit patient alloc edit patient alloc product",
      normalizedName: "alloc edit patient",
      normalizedDob: "",
      normalizedPhone: "5550300",
      normalizedAddress: "789 alloc st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    // Attempt to change product — must fail
    await expect(
      invokeOrderWorkflow({
        operationId: "edit-alloc-product-001",
        action: "edit",
        orderId,
        productId: "different-product",
        quantity: 2,
        patientName: "Alloc Edit Patient",
        patientAddress: "789 Alloc St",
        productType: "Alloc Product",
        purchaseCost: 100,
        barcode: "ALLOC-EDIT-001",
        phone: "555-0300",
        facilityName: "Alloc Facility",
        notes: "allocated notes",
      })
    ).rejects.toThrow(/Cannot change product on an allocated order/i);

    // Attempt to change quantity — must fail
    await expect(
      invokeOrderWorkflow({
        operationId: "edit-alloc-qty-001",
        action: "edit",
        orderId,
        productId: "product-alloc-edit",
        quantity: 5,
        patientName: "Alloc Edit Patient",
        patientAddress: "789 Alloc St",
        productType: "Alloc Product",
        purchaseCost: 100,
        barcode: "ALLOC-EDIT-001",
        phone: "555-0300",
        facilityName: "Alloc Facility",
        notes: "allocated notes",
      })
    ).rejects.toThrow(/Cannot change quantity on an allocated order/i);

    // Valid edit (no product/quantity change) must succeed and preserve inventory fields
    const result = await invokeOrderWorkflow({
      operationId: "edit-alloc-valid-001",
      action: "edit",
      orderId,
      productId: "product-alloc-edit",
      quantity: 2,
      patientName: "Alloc Edit Patient",
      patientAddress: "789 Alloc St",
      productType: "Alloc Product",
      purchaseCost: 100,
      barcode: "ALLOC-EDIT-001",
      phone: "555-0300",
      facilityName: "Alloc Facility",
      notes: "updated allocated notes",
    });

    expect(result.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.inventoryAllocated).toBe(true);
    expect(data.inventoryRestored).toBe(false);
    expect(data.inventoryAllocations).toEqual([
      { inventoryItemId: "inv-alloc-edit-1", quantity: 2, movementId: "mov-alloc-edit-1" },
    ]);
    expect(data.inventoryAllocationSourceId).toBe("source-edit-1");
    expect(data.notes).toBe("updated allocated notes");
  });

  it("edit is idempotent — duplicate operation returns success without modifying order", async () => {
    const orderId = "edit-idempotent-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-idempotent-edit",
      quantity: 1,
      patientName: "Idempotent Patient",
      patientAddress: "111 Idempotent St",
      productType: "Idempotent Product",
      purchaseCost: 50,
      barcode: "IDEM-001",
      phone: "555-0400",
      facilityName: "Idempotent Facility",
      notes: "idempotent notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-idempotent-edit",
      patientKey: "idempotent patient",
      orderKey: "idempotent patient idempotent product",
      searchText: "idempotent patient 111 idempotent st idempotent product 555-0400 idempotent facility idempotent notes idem-001 idempotent patient idempotent patient idempotent product",
      normalizedName: "idempotent patient",
      normalizedDob: "",
      normalizedPhone: "5550400",
      normalizedAddress: "111 idempotent st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    const first = await invokeOrderWorkflow({
      operationId: "edit-idempotent-001",
      action: "edit",
      orderId,
      productId: "product-idempotent-edit",
      quantity: 1,
      patientName: "Idempotent Patient",
      patientAddress: "111 Idempotent St",
      productType: "Idempotent Product",
      purchaseCost: 50,
      barcode: "IDEM-001",
      phone: "555-0400",
      facilityName: "Idempotent Facility",
      notes: "idempotent notes",
    });

    expect(first.status).toBe("success");

    const second = await invokeOrderWorkflow({
      operationId: "edit-idempotent-001",
      action: "edit",
      orderId,
      productId: "product-idempotent-edit",
      quantity: 1,
      patientName: "Idempotent Patient",
      patientAddress: "111 Idempotent St",
      productType: "Idempotent Product",
      purchaseCost: 50,
      barcode: "IDEM-001",
      phone: "555-0400",
      facilityName: "Idempotent Facility",
      notes: "idempotent notes",
    });

    expect(second.status).toBe("duplicate_operation");

    // Order must remain unchanged
    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.data()?.notes).toBe("idempotent notes");
  });

  it("edit on restored order permits product change", async () => {
    await seedInventory("inv-edit-restored-prod", { quantityOnHand: 5, available: 5 });
    await seedProduct("product-edit-restored-2");
    await seedInventory("inv-edit-restored-prod-2", { quantityOnHand: 5, available: 5 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-edit-restored-prod-create",
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Restored Patient",
      patientAddress: "777 Restored St",
    });
    const orderId = createResult.orderId as string;
    expect(createResult.status).toBe("success");

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-edit-restored-prod-cancel",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 2,
      patientName: "Restored Patient",
    });
    expect(cancelResult.status).toBe("success");

    const editResult = await invokeOrderWorkflow({
      operationId: "edit-restored-prod-001",
      action: "edit",
      orderId,
      productId: "product-edit-restored-2",
      quantity: 2,
      patientName: "Restored Patient",
      patientAddress: "777 Restored St",
    });

    expect(editResult.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.productId).toBe("product-edit-restored-2");
    expect(data.linkedInventoryId).toBe("product-edit-restored-2");
    expect(data.inventoryRestored).toBe(true);
  });

  it("edit on restored order permits quantity change", async () => {
    await seedInventory("inv-edit-restored-qty", { quantityOnHand: 5, available: 5 });

    const createResult = await invokeOrderWorkflow({
      operationId: "order-edit-restored-qty-create",
      action: "create",
      productId: "product-order-test",
      quantity: 2,
      patientName: "Restored Qty Patient",
      patientAddress: "888 Restored St",
    });
    const orderId = createResult.orderId as string;
    expect(createResult.status).toBe("success");

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-edit-restored-qty-cancel",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 2,
      patientName: "Restored Qty Patient",
    });
    expect(cancelResult.status).toBe("success");

    const editResult = await invokeOrderWorkflow({
      operationId: "edit-restored-qty-001",
      action: "edit",
      orderId,
      productId: "product-order-test",
      quantity: 3,
      patientName: "Restored Qty Patient",
      patientAddress: "888 Restored St",
    });

    expect(editResult.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.quantity).toBe(3);
    expect(data.inventoryRestored).toBe(true);
  });

  it("edit preserves isHospice", async () => {
    const orderId = "edit-hospice-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-hospice-edit",
      quantity: 1,
      patientName: "Hospice Patient",
      patientAddress: "999 Hospice Rd",
      productType: "Hospice Product",
      purchaseCost: 200,
      barcode: "HOSP-001",
      phone: "555-0500",
      facilityName: "Hospice Facility",
      notes: "hospice notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: true,
      linkedPatientId: "patient-hospice-001",
      linkedInventoryId: "product-hospice-edit",
      patientKey: "hospice patient",
      orderKey: "hospice patient hospice product",
      searchText: "hospice patient 999 hospice rd hospice product 555-0500 hospice facility hospice notes hosp-001 hospice patient hospice patient hospice product",
      normalizedName: "hospice patient",
      normalizedDob: "",
      normalizedPhone: "5550500",
      normalizedAddress: "999 hospice rd",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    const result = await invokeOrderWorkflow({
      operationId: "edit-hospice-001",
      action: "edit",
      orderId,
      productId: "product-hospice-edit",
      quantity: 1,
      patientName: "Hospice Patient Updated",
      notes: "updated hospice notes",
    });

    expect(result.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.data()?.isHospice).toBe(true);
    expect(orderSnap.data()?.linkedPatientId).toBe("patient-hospice-001");
  });

  it("edit preserves linkedPatientId", async () => {
    const orderId = "edit-linked-patient-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-linked-patient",
      quantity: 1,
      patientName: "Linked Patient",
      patientAddress: "111 Linked St",
      productType: "Linked Product",
      purchaseCost: 100,
      barcode: "LINK-001",
      phone: "555-0600",
      facilityName: "Linked Facility",
      notes: "linked notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "patient-linked-123",
      linkedInventoryId: "product-linked-patient",
      patientKey: "linked patient",
      orderKey: "linked patient linked product",
      searchText: "linked patient 111 linked st linked product 555-0600 linked facility linked notes link-001 linked patient linked patient linked product",
      normalizedName: "linked patient",
      normalizedDob: "",
      normalizedPhone: "5550600",
      normalizedAddress: "111 linked st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    const result = await invokeOrderWorkflow({
      operationId: "edit-linked-patient-001",
      action: "edit",
      orderId,
      productId: "product-linked-patient",
      quantity: 1,
      patientName: "Linked Patient",
      notes: "updated linked notes",
    });

    expect(result.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.data()?.linkedPatientId).toBe("patient-linked-123");
  });

  it("linkedInventoryId is server-derived after allowed product change on restored order", async () => {
    await seedInventory("inv-edit-linked", { quantityOnHand: 5, available: 5 });
    await seedProduct("product-linked-derive");

    const createResult = await invokeOrderWorkflow({
      operationId: "order-edit-linked-create",
      action: "create",
      productId: "product-order-test",
      quantity: 1,
      patientName: "Linked Derive Patient",
      patientAddress: "222 Derive St",
    });
    const orderId = createResult.orderId as string;

    const cancelResult = await invokeOrderWorkflow({
      operationId: "order-edit-linked-cancel",
      action: "cancel",
      orderId,
      productId: "product-order-test",
      quantity: 1,
      patientName: "Linked Derive Patient",
    });
    expect(cancelResult.status).toBe("success");

    await invokeOrderWorkflow({
      operationId: "edit-linked-derive-001",
      action: "edit",
      orderId,
      productId: "product-linked-derive",
      quantity: 1,
      patientName: "Linked Derive Patient",
      patientAddress: "222 Derive St",
    });

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.data()?.linkedInventoryId).toBe("product-linked-derive");
  });

  it("generic edit cannot alter order status", async () => {
    const orderId = "edit-status-locked-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-status-lock",
      quantity: 1,
      patientName: "Status Lock Patient",
      patientAddress: "333 Lock St",
      productType: "Status Product",
      purchaseCost: 100,
      barcode: "LOCK-001",
      phone: "555-0700",
      facilityName: "Lock Facility",
      notes: "lock notes",
      status: "ready",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-status-lock",
      patientKey: "status lock patient",
      orderKey: "status lock patient status product",
      searchText: "status lock patient 333 lock st status product 555-0700 lock facility lock notes lock-001 status lock patient status lock patient status product",
      normalizedName: "status lock patient",
      normalizedDob: "",
      normalizedPhone: "5550700",
      normalizedAddress: "333 lock st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    await invokeOrderWorkflow({
      operationId: "edit-status-lock-001",
      action: "edit",
      orderId,
      productId: "product-status-lock",
      quantity: 1,
      patientName: "Status Lock Patient",
      notes: "updated lock notes",
      status: "cancelled",
    });

    const orderSnap = await db.collection("orders").doc(orderId).get();
    expect(orderSnap.data()?.status).toBe("ready");
  });

  it("same operationId + materially different edit request conflicts", async () => {
    const orderId = "edit-conflict-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-edit-conflict",
      quantity: 1,
      patientName: "Conflict Patient",
      patientAddress: "444 Conflict St",
      productType: "Conflict Product",
      purchaseCost: 100,
      barcode: "CONF-001",
      phone: "555-0800",
      facilityName: "Conflict Facility",
      notes: "conflict notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-edit-conflict",
      patientKey: "conflict patient",
      orderKey: "conflict patient conflict product",
      searchText: "conflict patient 444 conflict st conflict product 555-0800 conflict facility conflict notes conf-001 conflict patient conflict patient conflict product",
      normalizedName: "conflict patient",
      normalizedDob: "",
      normalizedPhone: "5550800",
      normalizedAddress: "444 conflict st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    await invokeOrderWorkflow({
      operationId: "edit-conflict-001",
      action: "edit",
      orderId,
      productId: "product-edit-conflict",
      quantity: 1,
      patientName: "Conflict Patient",
      patientAddress: "444 Conflict St",
      productType: "Conflict Product",
      purchaseCost: 100,
      barcode: "CONF-001",
      phone: "555-0800",
      facilityName: "Conflict Facility",
      notes: "conflict notes",
    });

    await expect(
      invokeOrderWorkflow({
        operationId: "edit-conflict-001",
        action: "edit",
        orderId,
        productId: "product-edit-conflict",
        quantity: 1,
        patientName: "Conflict Patient UPDATED",
        patientAddress: "444 Conflict St",
        productType: "Conflict Product",
        purchaseCost: 100,
        barcode: "CONF-001",
        phone: "555-0800",
        facilityName: "Conflict Facility",
        notes: "conflict notes",
      })
    ).rejects.toThrow(/already used with different/i);
  });

  it("edit preserves protected inventory bookkeeping fields", async () => {
    const orderId = "edit-bookkeeping-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-bookkeeping",
      quantity: 2,
      patientName: "Bookkeeping Patient",
      patientAddress: "555 Bookkeeping St",
      productType: "Bookkeeping Product",
      purchaseCost: 100,
      barcode: "BOOK-001",
      phone: "555-0900",
      facilityName: "Bookkeeping Facility",
      notes: "bookkeeping notes",
      status: "processing",
      inventoryAllocated: true,
      inventoryRestored: false,
      inventoryAllocations: [
        { inventoryItemId: "inv-bookkeeping-1", quantity: 2, movementId: "mov-bookkeeping-1" },
      ],
      inventoryAllocationSourceId: "source-bookkeeping-1",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: true,
      linkedPatientId: "patient-bookkeeping-001",
      linkedInventoryId: "product-bookkeeping",
      patientKey: "bookkeeping patient",
      orderKey: "bookkeeping patient bookkeeping product",
      searchText: "bookkeeping patient 555 bookkeeping st bookkeeping product 555-0900 bookkeeping facility bookkeeping notes book-001 bookkeeping patient bookkeeping patient bookkeeping product",
      normalizedName: "bookkeeping patient",
      normalizedDob: "",
      normalizedPhone: "5550900",
      normalizedAddress: "555 bookkeeping st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    await invokeOrderWorkflow({
      operationId: "edit-bookkeeping-001",
      action: "edit",
      orderId,
      productId: "product-bookkeeping",
      quantity: 2,
      patientName: "Bookkeeping Patient",
      notes: "updated bookkeeping notes",
    });

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.inventoryAllocated).toBe(true);
    expect(data.inventoryRestored).toBe(false);
    expect(data.inventoryAllocations).toEqual([
      { inventoryItemId: "inv-bookkeeping-1", quantity: 2, movementId: "mov-bookkeeping-1" },
    ]);
    expect(data.inventoryAllocationSourceId).toBe("source-bookkeeping-1");
    expect(data.isHospice).toBe(true);
    expect(data.linkedPatientId).toBe("patient-bookkeeping-001");
    expect(data.status).toBe("processing");
    expect(data.createdBy).toBe(actor.email);
    expect(data.createdByUid).toBe(actor.uid);
  });

  it("edit derives normalizedDob from persisted raw dob via normalizeSearchText", async () => {
    const orderId = "edit-dob-derive-order";
    await db.collection("orders").doc(orderId).set({
      productId: "product-dob-edit",
      quantity: 1,
      patientName: "DOB Patient",
      patientAddress: "666 DOB St",
      productType: "DOB Product",
      purchaseCost: 100,
      barcode: "DOB-001",
      phone: "555-1100",
      facilityName: "DOB Facility",
      notes: "dob notes",
      status: "processing",
      inventoryAllocated: false,
      inventoryRestored: false,
      inventoryAllocations: [],
      inventoryAllocationSourceId: "",
      createdBy: actor.email,
      createdByUid: actor.uid,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isHospice: false,
      linkedPatientId: "",
      linkedInventoryId: "product-dob-edit",
      patientKey: "dob patient",
      orderKey: "dob patient dob product",
      searchText: "dob patient 666 dob st dob product 555-1100 dob facility dob notes dob-001 dob patient dob patient dob product",
      normalizedName: "dob patient",
      dob: "03/29/1981",
      normalizedDob: "",
      normalizedPhone: "5551100",
      normalizedAddress: "666 dob st",
      needsReview: false,
      reviewReasons: [],
      smartRouteTargets: ["orders", "patients", "analytics"],
    });

    const result = await invokeOrderWorkflow({
      operationId: "edit-dob-derive-001",
      action: "edit",
      orderId,
      productId: "product-dob-edit",
      quantity: 1,
      patientName: "DOB Patient",
      notes: "updated dob notes",
    });

    expect(result.status).toBe("success");

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const data = orderSnap.data()!;
    expect(data.dob).toBe("03/29/1981");
    expect(data.normalizedDob).toBe("03 29 1981");
  });
});
