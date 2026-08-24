import { describe, expect, it, vi } from "vitest";

import { normalizeScanValue, prepareInventoryMovementInTransaction } from "./movementService.js";

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
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

function createFakeDbAndTransaction(seed: Store) {
  const db = {
    collection: (collectionName: string) => ({
      doc: (docId: string) => ({
        collectionName,
        id: docId,
      }),
    }),
  };

  const transaction = {
    get: async (ref: { collectionName: string; id: string }) => ({
      exists: Boolean(seed[ref.collectionName]?.[ref.id]),
      data: () => seed[ref.collectionName]?.[ref.id],
    }),
    set: (ref: { collectionName: string; id: string }, data: Record<string, unknown>) => {
      seed[ref.collectionName] ??= {};
      seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
    },
    update: (ref: { collectionName: string; id: string }, data: Record<string, unknown>) => {
      seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
    },
    delete: (ref: { collectionName: string; id: string }) => {
      delete seed[ref.collectionName][ref.id];
    },
  };

  return { db, transaction, store: seed };
}

const actor = {
  uid: "user1",
  email: "test@test.com",
  role: "admin",
};

const baseSerializedInventory = {
  isSerialized: true,
  quantityOnHand: 1,
  onRent: 0,
  onTruck: 0,
  committed: 0,
  status: "available",
  lifecycleStatus: "active",
  patientKey: "",
  assignedTo: "",
  rentalId: "",
};

async function callMovementWithInventory(inventoryOverrides: Record<string, unknown>) {
  const inventoryItemId = "inv-1";
  const operationId = `test-op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inventory = { ...baseSerializedInventory, ...inventoryOverrides };

  const store: Store = {
    inventory: { [inventoryItemId]: inventory },
    products: {},
    inventoryOperations: {},
    inventoryTransactions: {},
  };

  const { db, transaction } = createFakeDbAndTransaction(store);

  const input = {
    operationId,
    movementType: "order_allocation" as const,
    inventoryItemId,
    quantity: 1,
    source: "orders" as const,
  };

  return prepareInventoryMovementInTransaction({
    transaction: transaction as unknown as Parameters<typeof prepareInventoryMovementInTransaction>[0]["transaction"],
    database: db as unknown as Parameters<typeof prepareInventoryMovementInTransaction>[0]["database"],
    input,
    actor,
    inventorySeed: inventory,
  });
}

describe("inventory movement scan safety", () => {
  it("accepts UPC, EAN, internal barcode, serial, manufacturer ID, and product-like IDs", () => {
    expect(normalizeScanValue("0012345678905").value).toBe("0012345678905");
    expect(normalizeScanValue("ABC-128-XYZ").value).toBe("ABC-128-XYZ");
    expect(normalizeScanValue("SN123456").value).toBe("SN123456");
    expect(normalizeScanValue("MFG-9981").value).toBe("MFG-9981");
    expect(normalizeScanValue("product_123").value).toBe("product_123");
  });

  it("rejects URL QR codes before Firestore path construction", () => {
    const result = normalizeScanValue("https://example.com/products/123");

    expect(result.status).toBe("invalid");
    expect(result.error).toContain("URL QR codes");
  });

  it("rejects path-like values", () => {
    const result = normalizeScanValue("../products/abc");

    expect(result.status).toBe("invalid");
    expect(result.error).toContain("path");
  });

  it("strips scanner suffix characters without changing leading zeroes", () => {
    const result = normalizeScanValue("0012345678905\r\n");

    expect(result.status).toBe("valid");
    expect(result.value).toBe("0012345678905");
  });
});

describe("order_allocation serialized eligibility via prepareInventoryMovementInTransaction", () => {
  it("rejects serialized item with status=assigned even when numerically available (quantityOnHand=1, onRent=0, onTruck=0)", async () => {
    await expect(
      callMovementWithInventory({ status: "assigned" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized retired item even when status=available", async () => {
    await expect(
      callMovementWithInventory({ lifecycleStatus: "retired" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized inactive item via status field", async () => {
    await expect(
      callMovementWithInventory({ status: "inactive" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized item with onRent > 0", async () => {
    await expect(
      callMovementWithInventory({ onRent: 1, quantityOnHand: 2 })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized item with committed > 0", async () => {
    await expect(
      callMovementWithInventory({ committed: 1, quantityOnHand: 2 })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized item with patientKey present", async () => {
    await expect(
      callMovementWithInventory({ patientKey: "patient_abc" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized item with assignedTo present", async () => {
    await expect(
      callMovementWithInventory({ assignedTo: "user_xyz" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("rejects serialized item with rentalId present", async () => {
    await expect(
      callMovementWithInventory({ rentalId: "rental_123" })
    ).rejects.toThrow(/Serialized inventory is not available for order allocation/);
  });

  it("allows order_allocation for available serialized item with no conflicting state", async () => {
    const result = await callMovementWithInventory({});
    expect(result.result.status).toBe("success");
    expect(result.result.quantityDelta).toBe(-1);
  });

  it("does not apply serialized guard to non-serialized inventory", async () => {
    const result = await callMovementWithInventory({
      isSerialized: false,
      serial: "",
      serialNumber: "",
    });
    expect(result.result.status).toBe("success");
  });
});