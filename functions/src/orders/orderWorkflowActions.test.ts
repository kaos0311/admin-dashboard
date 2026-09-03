import { describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

import { orderWorkflow } from "./orderWorkflowService.js";

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
    increment: (n: number) => ({ __increment: n }),
    delete: () => "delete-sentinel",
  },
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
  },
  getFirestore: vi.fn(),
}));

vi.mock("firebase-admin/storage", () => ({
  getStorage: vi.fn(),
}));

type Store = Record<string, Record<string, Record<string, unknown>>>;

interface FakeRef {
  collectionName: string;
  id: string;
  path?: string;
  isQuery?: boolean;
  clauses?: Array<{ field: string; op: string; value: unknown }>;
  limitVal?: number;
  where?: (field: string, op: string, value: unknown) => FakeRef;
  limit?: (n: number) => FakeRef;
}

function makeRef(collectionName: string, id: string): FakeRef {
  return {
    collectionName,
    id,
    path: `${collectionName}/${id}`,
  };
}

function makeQueryRef(
  collectionName: string,
  clauses: Array<{ field: string; op: string; value: unknown }>,
  limitVal: number | undefined,
): FakeRef {
  return {
    collectionName,
    id: "__query__",
    isQuery: true,
    clauses,
    limitVal,
  };
}

function matchesQueryRef(ref: FakeRef, store: Store): Array<{ id: string; data: () => Record<string, unknown> }> {
  const docs = Object.entries(store[ref.collectionName] ?? {}).map(([id, data]) => ({
    id,
    data: () => data,
  }));

  const filtered = docs.filter((doc) => {
    for (const clause of ref.clauses ?? []) {
      const actual = doc.data()[clause.field];
      if (clause.op === "==" && actual !== clause.value) return false;
      if (clause.op === "!=" && actual === clause.value) return false;
    }
    return true;
  });

  return ref.limitVal ? filtered.slice(0, ref.limitVal) : filtered;
}

function createFakeDbAndTransaction(seed: Store) {
  const db = {
    collection: (collectionName: string) => {
      // `.doc()` with no arg generates a unique id in a real Firestore query.
      // Simulate by appending a counter to the collection name.
      let autoIdCounter = 0;
      const doc = (docId?: string) => {
        if (docId !== undefined) {
          return makeRef(collectionName, docId);
        }
        const generated = `${collectionName}-auto-${++autoIdCounter}`;
        return makeRef(collectionName, generated);
      };

      function withClauses(clauses: Array<{ field: string; op: string; value: unknown }>): FakeRef {
        const builder: FakeRef = {
          ...makeQueryRef(collectionName, clauses, undefined),
          where: (field: string, op: string, value: unknown) =>
            withClauses([...clauses, { field, op, value }]),
          limit: (n: number) => {
            const q = withClauses(clauses);
            q.limitVal = n;
            return q;
          },
        };
        return builder;
      }

      return {
        doc,
        where: (field: string, op: string, value: unknown) => withClauses([{ field, op, value }]),
      };
    },
  };

  const transaction = {
    get: async (ref: FakeRef) => {
      if (ref.isQuery) {
        const matches = matchesQueryRef(ref, seed);
        return {
          empty: matches.length === 0,
          docs: matches,
        };
      }
      const data = seed[ref.collectionName]?.[ref.id];
      return {
        exists: Boolean(data),
        id: ref.id,
        data: () => data,
      };
    },
    set: (ref: FakeRef, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      seed[ref.collectionName] ??= {};
      if (opts?.merge) {
        seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
      } else {
        seed[ref.collectionName][ref.id] = { ...data };
      }
    },
    update: (ref: FakeRef, data: Record<string, unknown>) => {
      seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
    },
  };

  return { db, transaction, store: seed };
}

const actor = {
  uid: "admin-001",
  email: "admin@test.com",
  role: "admin",
};

function baseOrderOverrides(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    productId: "product-001",
    quantity: 2,
    patientName: "Test Patient",
    patientAddress: "123 Test St",
    productType: "Wheelchair",
    purchaseCost: 250,
    barcode: "BC-001",
    phone: "555-0100",
    facilityName: "Facility A",
    notes: "Leave at door",
    status: "processing",
    inventoryAllocated: true,
    inventoryRestored: false,
    inventoryAllocations: [{ inventoryItemId: "inv-001", quantity: 2, movementId: "mov-001" }],
    inventoryAllocationSourceId: "",
    createdBy: "workflow@example.com",
    createdByUid: "workflow-actor",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedBy: "workflow@example.com",
    updatedByUid: "workflow-actor",
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    needsReview: false,
    reviewReasons: [],
    smartRouteTargets: ["orders", "patients", "analytics"],
    ...overrides,
  };
}

const baseInventoryItem = {
  productId: "product-001",
  quantityOnHand: 10,
  onRent: 0,
  onTruck: 0,
  committed: 0,
  status: "available",
  lifeCycleStatus: "active",
  isDeleted: false,
  isSerialized: false,
};

async function runOrderWorkflow(
  seed: Store,
  input: Parameters<typeof orderWorkflow>[0]["input"],
): Promise<ReturnType<typeof orderWorkflow>> {
  const { db, transaction } = createFakeDbAndTransaction(seed);
  return orderWorkflow({
    database: db as unknown as Parameters<typeof orderWorkflow>[0]["database"],
    transaction: transaction as unknown as Parameters<typeof orderWorkflow>[0]["transaction"],
    input,
    actor,
  });
}

function operationIdFor(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("order workflow: ready transition", () => {
  it("succeeds for a valid processing -> ready transition and writes the order state", async () => {
    const operationId = operationIdFor("ready");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      inventory: { "inv-001": { ...baseInventoryItem } },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const result = await runOrderWorkflow(store, {
      operationId,
      action: "ready",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });

    expect(result.status).toBe("success");
    expect(result.orderStatus).toBe("ready");
    expect(store.orders["order-001"].status).toBe("ready");
    expect(store.orders["order-001"].updatedByUid).toBe(actor.uid);
    expect(store.domainWorkflowOperations[`${actor.uid}_${operationId}`]).toBeDefined();
    expect(store.auditLogs).toBeDefined();
    const auditEntries = Object.values(store.auditLogs);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe("order.ready");
    expect(auditEntries[0].targetId).toBe("order-001");
  });

  it("rejects an invalid ready -> ready transition", async () => {
    const operationId = operationIdFor("ready-invalid");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({ status: "ready" }) },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    await expect(
      runOrderWorkflow(store, {
        operationId,
        action: "ready",
        orderId: "order-001",
        productId: "product-001",
        quantity: 2,
        patientName: "Test Patient",
      }),
    ).rejects.toThrow(HttpsError);
  });

  it("is replay-safe: a duplicate operationId returns duplicate_operation without a second transition", async () => {
    const operationId = operationIdFor("ready-replay");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      inventory: { "inv-001": { ...baseInventoryItem } },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const first = await runOrderWorkflow(store, {
      operationId,
      action: "ready",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(first.status).toBe("success");
    expect(store.orders["order-001"].status).toBe("ready");

    // Re-run with the same operationId AND identical semantic request.
    const second = await runOrderWorkflow(store, {
      operationId,
      action: "ready",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(second.status).toBe("duplicate_operation");
    expect(store.orders["order-001"].status).toBe("ready");
  });

  it("rejects conflict when operationId is reused with different data", async () => {
    const operationId = operationIdFor("ready-conflict");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      inventory: { "inv-001": { ...baseInventoryItem } },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    await runOrderWorkflow(store, {
      operationId,
      action: "ready",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });

    await expect(
      runOrderWorkflow(store, {
        operationId,
        action: "ready",
        orderId: "order-001",
        productId: "product-001",
        quantity: 3, // Different quantity -> different fingerprint
        patientName: "Test Patient",
      }),
    ).rejects.toThrow(/already used with different/);
  });
});

describe("order workflow: archive transition", () => {
  it("succeeds for a valid processing -> archived transition and writes server-authored metadata", async () => {
    const operationId = operationIdFor("archive");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const result = await runOrderWorkflow(store, {
      operationId,
      action: "archive",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });

    expect(result.status).toBe("success");
    expect(result.orderStatus).toBe("archived");
    expect(store.orders["order-001"].status).toBe("archived");
    expect(store.orders["order-001"].archivedByUid).toBe(actor.uid);
    expect(store.orders["order-001"].archivedBy).toBe(actor.email);
    expect(store.orders["order-001"].archivedAt).toBe("server-timestamp");
    expect(store.orders["order-001"].updatedByUid).toBe(actor.uid);
    expect(store.domainWorkflowOperations[`${actor.uid}_${operationId}`]).toBeDefined();

    const auditEntries = Object.values(store.auditLogs);
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0].action).toBe("order.archive");
    expect(auditEntries[0].targetId).toBe("order-001");
  });

  it("is idempotent-safe: repeated archive with same operationId returns duplicate_operation", async () => {
    const operationId = operationIdFor("archive-replay");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const first = await runOrderWorkflow(store, {
      operationId,
      action: "archive",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(first.status).toBe("success");

    const second = await runOrderWorkflow(store, {
      operationId,
      action: "archive",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });
    expect(second.status).toBe("duplicate_operation");
    expect(store.orders["order-001"].status).toBe("archived");
  });

  it("rejects invalid transition from delivered -> archived for an already-archived order", async () => {
    const operationId = operationIdFor("archive-invalid");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({ status: "archived" }) },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    await expect(
      runOrderWorkflow(store, {
        operationId,
        action: "archive",
        orderId: "order-001",
        productId: "product-001",
        quantity: 2,
        patientName: "Test Patient",
      }),
    ).rejects.toThrow(HttpsError);
  });

  it("rejects an order that cannot be transitioned to archive (delivered -> archived is allowed, but an unknown order is not)", async () => {
    const operationId = operationIdFor("archive-missing");
    const store: Store = {
      orders: {},
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    await expect(
      runOrderWorkflow(store, {
        operationId,
        action: "archive",
        orderId: "order-missing",
        productId: "product-001",
        quantity: 2,
        patientName: "Test Patient",
      }),
    ).rejects.toThrow(/Order not found/);
  });
});

describe("order workflow: cancel/restore remain server-authoritative", () => {
  it("cancel writes the cancelled status without a browser-side tail (test verifies server result only)", async () => {
    const operationId = operationIdFor("cancel");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({}) },
      inventory: { "inv-001": { ...baseInventoryItem } },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const result = await runOrderWorkflow(store, {
      operationId,
      action: "cancel",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });

    expect(result.status).toBe("success");
    expect(store.orders["order-001"].status).toBe("cancelled");
    expect(store.orders["order-001"].inventoryRestored).toBe(true);
  });

  it("restore changes an archived order back to processing and re-allocates inventory", async () => {
    const operationId = operationIdFor("restore");
    const store: Store = {
      orders: { "order-001": baseOrderOverrides({ status: "archived" }) },
      inventory: { "inv-001": { ...baseInventoryItem } },
      domainWorkflowOperations: {},
      auditLogs: {},
    };

    const result = await runOrderWorkflow(store, {
      operationId,
      action: "restore",
      orderId: "order-001",
      productId: "product-001",
      quantity: 2,
      patientName: "Test Patient",
    });

    expect(result.status).toBe("success");
    expect(store.orders["order-001"].status).toBe("processing");
    expect(store.orders["order-001"].inventoryAllocated).toBe(true);
    expect(store.orders["order-001"].inventoryRestored).toBe(false);
    expect(store.orders["order-001"].restoredByUid).toBe(actor.uid);
  });
});
