import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { normalizeProduct } from "@/app/(admin)/products/utils/productNormalize";
import type { Product } from "@/app/(admin)/products/utils/productTypes";

import type {
  EquipmentRecallItem,
  ErrorCallbackType,
  RecallMatchItem,
  RecallSettingsCallback,
  RecallMatchesCallback,
  EquipmentRecallsCallback,
} from "./product.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_PRODUCTS = "products" as const;
const COLLECTION_SETTINGS = "settings" as const;
const COLLECTION_RECALL_MATCHES = "recallMatches" as const;
const COLLECTION_EQUIPMENT_RECALLS = "equipmentRecalls" as const;
const COLLECTION_AUDIT_LOGS = "auditLogs" as const;
const COLLECTION_HCPCS_CODES = "hcpcsCodes" as const;

const DOC_SETTINGS_APP = "app";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROTECTED_PRODUCT_STOCK_FIELDS = new Set([
  "quantityOnHand",
  "available",
  "onRent",
  "committed",
  "reserved",
  "allocated",
]);

function assertProductMetadataOnlyWrite(data: Record<string, unknown>): void {
  const blocked = Object.keys(data).filter((field) =>
    PROTECTED_PRODUCT_STOCK_FIELDS.has(field)
  );

  if (blocked.length > 0) {
    throw new Error(
      `ProductRepository metadata writes cannot change protected stock fields: ${blocked.join(
        ", "
      )}. Use inventory movements instead.`
    );
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecallMatch(
  id: string,
  data: Record<string, unknown>,
): RecallMatchItem {
  return {
    id,
    productId: readString(data.productId) || readString(data.itemId),
    productName:
      readString(data.productName) ||
      readString(data.itemName) ||
      readString(data.name),
    recallTitle:
      readString(data.recallTitle) ||
      readString(data.title) ||
      readString(data.recallName),
    manufacturer: readString(data.manufacturer),
    model: readString(data.model),
    severity: readString(data.severity),
    status: readString(data.status),
    actionRequired:
      readString(data.actionRequired) ||
      readString(data.recommendedAction) ||
      readString(data.nextSteps) ||
      readString(data.instructions),
    sourceUrl: readString(data.sourceUrl) || readString(data.url),
  };
}

function normalizeEquipmentRecall(
  id: string,
  data: Record<string, unknown>,
): EquipmentRecallItem {
  return {
    id,
    recallTitle:
      readString(data.recallTitle) ||
      readString(data.title) ||
      readString(data.recallName),
    manufacturer: readString(data.manufacturer),
    model: readString(data.model),
    severity: readString(data.severity),
    actionRequired:
      readString(data.actionRequired) ||
      readString(data.recommendedAction) ||
      readString(data.nextSteps) ||
      readString(data.instructions),
    sourceUrl: readString(data.sourceUrl) || readString(data.url),
  };
}

// ---------------------------------------------------------------------------
// Product Repository
// ---------------------------------------------------------------------------

export const ProductRepository = {
  // ---- READ: Paginated products -------------------------------------------

  /**
   * Fetch a page of products ordered ascending by name.
   * Returns the products, the last document snapshot (cursor), and hasMore flag.
   */
  async getPage(
    pageSize: number,
    lastCursor?: QueryDocumentSnapshot<DocumentData> | null,
  ): Promise<{
    products: Product[];
    nextCursor: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    const productsQuery = lastCursor
      ? query(
          collection(db, COLLECTION_PRODUCTS),
          orderBy("name", "asc"),
          startAfter(lastCursor),
          limit(pageSize),
        )
      : query(
          collection(db, COLLECTION_PRODUCTS),
          orderBy("name", "asc"),
          limit(pageSize),
        );

    const snapshot = await getDocs(productsQuery);

    const products = snapshot.docs
      .map((docSnap) =>
        normalizeProduct(docSnap.id, docSnap.data() as Record<string, unknown>),
      )
      .filter((product) => !product.deleted);

    const nextCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === pageSize;

    return { products, nextCursor, hasMore };
  },

  // ---- WRITE: Create / Update / Delete ------------------------------------

  /**
   * Create a new product document. Returns the generated document ID.
   */
  async create(data: Record<string, unknown>): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTION_PRODUCTS), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * Update an existing product document (merge semantics with updatedAt).
   */
  async update(id: string, data: Record<string, unknown>): Promise<void> {
    assertProductMetadataOnlyWrite(data);
    await updateDoc(doc(db, COLLECTION_PRODUCTS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Soft-delete (archive) a product document.
   */
  async softDelete(
    id: string,
    meta: {
      deletedBy: string | null;
      deletedByEmail: string | null;
    },
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTION_PRODUCTS, id), {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: meta.deletedBy,
      deletedByEmail: meta.deletedByEmail,
      status: "discontinued",
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Batch soft-delete multiple product documents using Firestore batches.
   */
  async batchSoftDelete(
    ids: string[],
    batchSize: number,
    meta: {
      deletedBy: string | null;
      deletedByEmail: string | null;
    },
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + batchSize);

      chunk.forEach((id) => {
        batch.update(doc(db, COLLECTION_PRODUCTS, id), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: meta.deletedBy,
          deletedByEmail: meta.deletedByEmail,
          status: "discontinued",
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    }
  },

  // ---- WRITE: HCPCS code (upsert) ----------------------------------------

  /**
   * Upsert an HCPCS code document (merge behavior).
   */
  async upsertHcpcsCode(
    code: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await setDoc(doc(db, COLLECTION_HCPCS_CODES, code), data, { merge: true });
  },

  // ---- WRITE: Audit log ---------------------------------------------------

  /**
   * Write a product audit log entry to the auditLogs collection.
   */
  async writeAuditLog(data: Record<string, unknown>): Promise<void> {
    await addDoc(collection(db, COLLECTION_AUDIT_LOGS), {
      ...data,
      createdAt: serverTimestamp(),
    });
  },

  // ---- WRITE: Recall settings (shared settings doc) -----------------------

  /**
   * Update a recall-related setting in the shared settings/app document.
   */
  async updateRecallSetting(
    key: string,
    value: boolean,
    updatedBy: string,
  ): Promise<void> {
    await setDoc(
      doc(db, COLLECTION_SETTINGS, DOC_SETTINGS_APP),
      {
        inventory: {
          [key]: value,
        },
        updatedAt: serverTimestamp(),
        updatedBy,
      },
      { merge: true },
    );
  },

  // ---- SUBSCRIPTIONS ------------------------------------------------------

  /**
   * Subscribe to recall-related settings from the settings/app document.
   */
  subscribeToRecallSettings(
    onData: RecallSettingsCallback,
    onError?: ErrorCallbackType,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, COLLECTION_SETTINGS, DOC_SETTINGS_APP),
      (snapshot) => {
        const inventory =
          snapshot.data()?.inventory &&
          typeof snapshot.data()?.inventory === "object"
            ? (snapshot.data()?.inventory as Record<string, unknown>)
            : {};

        onData({
          internetScanEnabled:
            typeof inventory.jarvisRecallInternetScanEnabled === "boolean"
              ? inventory.jarvisRecallInternetScanEnabled
              : false,
          scanNewProductsEnabled:
            typeof inventory.jarvisRecallScanNewProductsEnabled === "boolean"
              ? inventory.jarvisRecallScanNewProductsEnabled
              : false,
          discontinuedScanEnabled:
            typeof inventory.jarvisDiscontinuedInternetScanEnabled === "boolean"
              ? inventory.jarvisDiscontinuedInternetScanEnabled
              : false,
          scanNewDiscontinuedProductsEnabled:
            typeof inventory.jarvisDiscontinuedScanNewProductsEnabled === "boolean"
              ? inventory.jarvisDiscontinuedScanNewProductsEnabled
              : false,
        });
      },
      (error) => {
        console.error("RECALL SETTINGS SNAPSHOT ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to the recallMatches collection.
   */
  subscribeToRecallMatches(
    onData: RecallMatchesCallback,
    onError?: ErrorCallbackType,
  ): Unsubscribe {
    const recallMatchesQuery = query(
      collection(db, COLLECTION_RECALL_MATCHES),
      limit(75),
    );

    return onSnapshot(
      recallMatchesQuery,
      (snapshot) => {
        onData(
          snapshot.docs.map((matchDoc) =>
            normalizeRecallMatch(
              matchDoc.id,
              matchDoc.data() as Record<string, unknown>,
            ),
          ),
        );
      },
      (error) => {
        console.error("RECALL MATCHES SNAPSHOT ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to active equipmentRecalls.
   */
  subscribeToEquipmentRecalls(
    onData: EquipmentRecallsCallback,
    onError?: ErrorCallbackType,
  ): Unsubscribe {
    const recallsQuery = query(
      collection(db, COLLECTION_EQUIPMENT_RECALLS),
      where("active", "==", true),
      limit(75),
    );

    return onSnapshot(
      recallsQuery,
      (snapshot) => {
        onData(
          snapshot.docs.map((recallDoc) =>
            normalizeEquipmentRecall(
              recallDoc.id,
              recallDoc.data() as Record<string, unknown>,
            ),
          ),
        );
      },
      (error) => {
        console.error("EQUIPMENT RECALLS SNAPSHOT ERROR:", error);
        onError?.(error);
      },
    );
  },
};
