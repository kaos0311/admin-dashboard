import { HttpsError } from "firebase-functions/v2/https";
import { describe, expect, it } from "vitest";

import {
  applyInventoryCleanup,
  type InventoryCleanupRequest,
  previewInventoryCleanup,
} from "./cleanupWorkflow.js";

type Store = Record<string, Record<string, Record<string, unknown>>>;

function createFakeDatabase(seed: Store) {
  return {
    collection: (collectionName: string) => ({
      doc: (docId?: string) => {
        const id = docId ?? `auto-${Object.keys(seed[collectionName] ?? {}).length}`;
        return {
          collectionName,
          id,
          get: async () => ({
            exists: Boolean(seed[collectionName]?.[id]),
            data: () => seed[collectionName]?.[id],
          }),
        };
      },
      where: (field: string, op: string, value: unknown) => ({
        limit: () => ({
          get: async () => ({
            docs: Object.entries(seed[collectionName] ?? {})
              .filter(([, data]) => op === "==" && data[field] === value)
              .map(([id, data]) => ({ id, data: () => data })),
          }),
        }),
      }),
    }),
    runTransaction: async (callback: (transaction: unknown) => unknown) => callback({
      get: async (ref: { collectionName: string; id: string }) => ({
        exists: Boolean(seed[ref.collectionName]?.[ref.id]),
        data: () => seed[ref.collectionName]?.[ref.id],
      }),
      update: (ref: { collectionName: string; id: string }, data: Record<string, unknown>) => {
        seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
      },
      set: (ref: { collectionName: string; id: string }, data: Record<string, unknown>) => {
        seed[ref.collectionName] ??= {};
        seed[ref.collectionName][ref.id] = { ...seed[ref.collectionName][ref.id], ...data };
      },
    }),
  };
}

function seedStore(): Store {
  return {
    inventory: {
      "inv-1": {
        name: "Legacy Concentrator",
        productId: "old-product",
        category: "Uncategorized",
        manufacturer: "Invacare",
        modelNumber: "Old Model",
        sku: "OLD",
        hcpc: "E1390",
        serial: "SN-1",
        quantityOnHand: 1,
        available: 1,
        onRent: 0,
        status: "available",
        isDeleted: false,
      },
      "inv-duplicate": {
        name: "Duplicate",
        serial: "SN-2",
        status: "available",
        isDeleted: false,
      },
    },
    products: {
      "product-2": {
        name: "Canonical Concentrator",
        category: "Oxygen Equipment",
        manufacturer: "Invacare",
        model: "Perfecto",
        sku: "PERF",
        hcpcs: "E1390",
        status: "active",
        deleted: false,
      },
    },
    domainWorkflowOperations: {},
    auditLogs: {},
    inventoryGroupingRiskReviews: {},
  };
}

const actor = {
  uid: "admin-1",
  email: "admin@example.test",
  role: "admin",
};

function request(overrides: Partial<InventoryCleanupRequest>): InventoryCleanupRequest {
  return {
    mode: "preview",
    operationId: "cleanup-test-001",
    action: "ASSIGN_CATEGORY",
    inventoryItemId: "inv-1",
    newValue: "Oxygen Equipment",
    ...overrides,
  };
}

describe("inventory cleanup workflow", () => {
  it("generates category correction preview diffs", async () => {
    const preview = await previewInventoryCleanup(request({}), createFakeDatabase(seedStore()) as never);

    expect(preview.riskLevel).toBe("LOW");
    expect(preview.diff).toContainEqual({
      field: "category",
      before: "Uncategorized",
      after: "Oxygen Equipment",
    });
    expect(preview.sideEffects).toContain("No stock quantity change.");
  });

  it("rejects unsupported category values", async () => {
    await expect(
      previewInventoryCleanup(request({ newValue: "Random Catalog" }), createFakeDatabase(seedStore()) as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("adds product relink compatibility warnings", async () => {
    const preview = await previewInventoryCleanup(
      request({
        action: "RELINK_PRODUCT_ID",
        targetProductId: "product-2",
        newValue: "",
      }),
      createFakeDatabase(seedStore()) as never,
    );

    expect(preview.diff.map((change) => change.field)).toContain("productId");
    expect(preview.warnings).toContain("modelNumber differs between inventory and target product.");
  });

  it("blocks duplicate serial correction", async () => {
    await expect(
      previewInventoryCleanup(
        request({
          action: "CORRECT_SERIAL",
          newValue: "SN-2",
        }),
        createFakeDatabase(seedStore()) as never,
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("requires reason and acknowledgement for high risk identifier corrections", async () => {
    const store = seedStore();
    const preview = await previewInventoryCleanup(
      request({
        action: "CORRECT_SERIAL",
        newValue: "SN-3",
      }),
      createFakeDatabase(store) as never,
    );

    await expect(
      applyInventoryCleanup(
        request({
          mode: "apply",
          action: "CORRECT_SERIAL",
          newValue: "SN-3",
          previewToken: preview.previewToken,
        }),
        actor,
        createFakeDatabase(store) as never,
      ),
    ).rejects.toBeInstanceOf(HttpsError);
  });

  it("applies category correction without touching quantity fields", async () => {
    const store = seedStore();
    const db = createFakeDatabase(store);
    const preview = await previewInventoryCleanup(request({}), db as never);
    const result = await applyInventoryCleanup(
      request({
        mode: "apply",
        previewToken: preview.previewToken,
      }),
      actor,
      db as never,
    );

    expect(result.status).toBe("success");
    expect(store.inventory["inv-1"]).toMatchObject({
      category: "Oxygen Equipment",
      quantityOnHand: 1,
      available: 1,
      onRent: 0,
    });
    expect(Object.values(store.auditLogs)).toHaveLength(1);
  });

  it("rejects stale preview tokens", async () => {
    const store = seedStore();
    const db = createFakeDatabase(store);
    const preview = await previewInventoryCleanup(request({}), db as never);
    store.inventory["inv-1"].category = "Respiratory";

    await expect(
      applyInventoryCleanup(
        request({
          mode: "apply",
          previewToken: preview.previewToken,
        }),
        actor,
        db as never,
      ),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});
