import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockDoc,
  mockQuery,
  mockWhere,
  mockLimit,
  mockNoop,
} = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((db, collectionName) => ({ collectionName })),
  mockDoc: vi.fn((db, collectionName, id) => ({ collectionName, id })),
  mockQuery: vi.fn((...args) => ({ collection: args[0], filters: args.slice(1) })),
  mockWhere: vi.fn((field, op, value) => ({ field, op, value })),
  mockLimit: vi.fn((limitCount) => ({ limitCount })),
  mockNoop: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: mockNoop,
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  limit: mockLimit,
  onSnapshot: mockNoop,
  orderBy: mockNoop,
  query: mockQuery,
  serverTimestamp: mockNoop,
  setDoc: mockNoop,
  updateDoc: mockNoop,
  where: mockWhere,
  writeBatch: mockNoop,
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { InventoryRepository } from "./inventory.repository";

interface MockDocument {
  id: string;
  data: Record<string, unknown>;
}

let collectionDocs: Record<string, MockDocument[]>;

function createDocumentSnapshot(id: string, data: Record<string, unknown>, exists = true) {
  return {
    id,
    data: () => data,
    exists: () => exists,
  };
}

function createQuerySnapshot(docs: Array<ReturnType<typeof createDocumentSnapshot>>) {
  return { docs };
}

beforeEach(() => {
  vi.clearAllMocks();
  collectionDocs = {};

  mockGetDoc.mockImplementation(async (docArg) => {
    const collectionName = docArg.collectionName;
    const id = docArg.id;
    const document = collectionDocs[collectionName]?.find((doc) => doc.id === id);
    if (!document) {
      return createDocumentSnapshot(id, {}, false);
    }
    return createDocumentSnapshot(document.id, document.data, true);
  });

  mockGetDocs.mockImplementation(async (queryArg) => {
    const collectionName = queryArg?.collection?.collectionName;
    const filter = queryArg?.filters?.find((constraint: Record<string, unknown>) =>
      typeof constraint?.field === "string"
    );
    const targetField = filter?.field as string | undefined;
    const targetValue = filter?.value;

    const documents = collectionDocs[collectionName] ?? [];
    const matches = targetField
      ? documents.filter((document) => document.data[targetField] === targetValue)
      : [];

    return createQuerySnapshot(matches.map((document) => createDocumentSnapshot(document.id, document.data)));
  });
});

describe("InventoryRepository", () => {
  describe("findProductByScan", () => {
    it("returns a direct product document by id when the scanned value is safe and exists", async () => {
      collectionDocs = {
        products: [{ id: "direct-product", data: { deleted: false, sku: "SKU-123" } }],
      };

      const result = await InventoryRepository.findProductByScan("direct-product");

      expect(result).toEqual({ id: "direct-product", deleted: false, sku: "SKU-123" });
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("falls back to field lookups when a direct product document is deleted", async () => {
      collectionDocs = {
        products: [
          { id: "direct-product", data: { deleted: true, sku: "DIRECT-PRODUCT" } },
          { id: "fallback-product", data: { deleted: false, sku: "direct-product" } },
        ],
      };

      const result = await InventoryRepository.findProductByScan("direct-product");

      expect(result).toEqual({ id: "fallback-product", deleted: false, sku: "direct-product" });
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe("findExistingProduct", () => {
    it("returns the direct product id when productId is safe and exists", async () => {
      collectionDocs = {
        products: [{ id: "prod-123", data: { deleted: false, sku: "SKU-123" } }],
      };

      const result = await InventoryRepository.findExistingProduct({
        productId: "prod-123",
        barcode: "12345",
      });

      expect(result).toBe("prod-123");
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it("skips direct lookup for unsafe productId and uses field fallbacks", async () => {
      collectionDocs = {
        products: [{ id: "fallback-product", data: { deleted: false, upc: "12345" } }],
      };

      const result = await InventoryRepository.findExistingProduct({
        productId: "../unsafe-id",
        barcode: "12345",
      });

      expect(result).toBe("fallback-product");
      expect(mockGetDoc).not.toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it("returns null when no matching product is found", async () => {
      collectionDocs = {
        products: [{ id: "other-product", data: { deleted: false, sku: "OTHER" } }],
      };

      const result = await InventoryRepository.findExistingProduct({
        barcode: "12345",
      });

      expect(result).toBe(null);
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });

  describe("findByScan", () => {
    it("returns the inventory item that matches the first non-empty scan field", async () => {
      collectionDocs = {
        inventory: [
          {
            id: "item-1",
            data: {
              barcode: "",
              serial: "",
              lotNumber: "",
              sku: "SKU-123",
              hcpc: "",
              name: "Matching Item",
            },
          },
        ],
      };

      const result = await InventoryRepository.findByScan("SKU-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("item-1");
      expect(result?.sku).toBe("SKU-123");
    });

    it("returns null when no inventory item matches any scan field", async () => {
      collectionDocs = {
        inventory: [{ id: "item-1", data: { barcode: "000", sku: "OTHER" } }],
      };

      const result = await InventoryRepository.findByScan("SKU-123");

      expect(result).toBeNull();
      expect(mockGetDocs).toHaveBeenCalled();
    });
  });
});
