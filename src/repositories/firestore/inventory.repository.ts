import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";

import { normalizeBarcode } from "@/lib/barcode";
import { db } from "@/lib/firebase";

import { normalizeInventoryItem } from "@/app/(admin)/inventory/lib/inventoryNormalize";
import type { InventoryItem } from "@/app/(admin)/inventory/lib/inventoryTypes";

import type {
  ProductDocument,
  SettingsInventoryThresholds,
  InventorySubscriptionCallback,
  InventoryItemSubscriptionCallback,
  SettingsSubscriptionCallback,
  PatientSubscriptionCallback,
  ErrorCallback,
} from "./inventory.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLLECTIONS = {
  INVENTORY: "inventory" as const,
  PRODUCTS: "products" as const,
  STOCK_MOVEMENTS: "stockMovements" as const,
  SETTINGS: "settings" as const,
  PATIENTS: "patients" as const,
  RENTALS: "rentals" as const,
  HCPCS_CODES: "hcpcsCodes" as const,
} as const;

const PROTECTED_INVENTORY_FIELDS = new Set([
  "quantityOnHand",
  "available",
  "onRent",
  "onTruck",
  "committed",
  "allocated",
  "reserved",
  "patientId",
  "patientKey",
  "patientName",
  "rentalId",
  "locationId",
  "warehouseId",
  "status",
  "inventoryStatus",
  "rentalStatus",
  "assignmentStatus",
  "lifecycleStatus",
  "isDeleted",
  "deleted",
  "deletedAt",
  "archived",
  "discontinued",
]);

function assertMetadataOnlyInventoryWrite(data: Record<string, unknown>): void {
  const blocked = Object.keys(data).filter((field) =>
    PROTECTED_INVENTORY_FIELDS.has(field)
  );

  if (blocked.length > 0) {
    throw new Error(
      `InventoryRepository metadata writes cannot change protected stock fields: ${blocked.join(
        ", "
      )}. Use createInventoryMovement instead.`
    );
  }
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// Inventory Repository
// ---------------------------------------------------------------------------

export const InventoryRepository = {
  // ---- READ: Collection queries ------------------------------------------

  /**
   * Fetch all inventory items (non-deleted, up to limit).
   */
  async getAll(limitCount = 3000): Promise<InventoryItem[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.INVENTORY),
        orderBy("name", "asc"),
        limit(limitCount),
      ),
    );

    return snap.docs
      .map((d) => normalizeInventoryItem(d.id, d.data() as Record<string, unknown>))
      .filter((item) => !item.isDeleted);
  },

  /**
   * Fetch a single inventory item by document ID.
   */
  async getById(id: string): Promise<InventoryItem | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.INVENTORY, id));
    if (!snap.exists()) return null;
    return normalizeInventoryItem(snap.id, snap.data() as Record<string, unknown>);
  },

  /**
   * Find inventory items by scanning a code across multiple fields.
   */
  async findByScan(rawCode: string): Promise<InventoryItem | null> {
    const clean = normalizeBarcode(rawCode);
    const upper = clean.toUpperCase();

    const fields: Array<[keyof InventoryItem, string]> = [
      ["barcode", clean],
      ["serial", clean],
      ["lotNumber", clean],
      ["sku", clean],
      ["hcpc", upper],
    ];

    for (const [field, value] of fields) {
      if (!value) continue;

      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.INVENTORY),
          where(field as string, "==", value),
          limit(25),
        ),
      );

      const matches = snap.docs
        .filter((document) => document.data().isDeleted !== true)
        .map((document) =>
          normalizeInventoryItem(
            document.id,
            document.data() as Record<string, unknown>,
          ),
        );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        console.error("AMBIGUOUS INVENTORY SCAN", {
          rawCode,
          normalizedCode: clean,
          field,
          matches: matches.map((item) => ({
            id: item.id,
            name: item.name,
            barcode: item.barcode,
            sku: item.sku,
            serial: item.serial,
            lotNumber: item.lotNumber,
            locationName: item.locationName,
            quantityOnHand: item.quantityOnHand,
            available: item.available,
          })),
        });

        throw new Error(
          `Scan code ${clean} matches ${matches.length} inventory records by ${String(field)}.`,
        );
      }
    }

    return null;
  },

  // ---- READ: Product queries ---------------------------------------------

  /**
   * Fetch a product document directly by its document ID.
   */
  async getProductById(id: string): Promise<ProductDocument | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.PRODUCTS, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ProductDocument;
  },

  /**
   * Find a product by scanning a code across multiple fields.
   */
  async findProductByScan(rawCode: string): Promise<ProductDocument | null> {
    const clean = normalizeBarcode(rawCode);
    const upper = clean.toUpperCase();

    // Direct document-ID lookup is only safe when the scanned value does not
// contain Firestore path separators. QR codes may contain full website URLs.
const directDocumentId = clean.toLowerCase();
const isSafeDocumentId =
  directDocumentId.length > 0 &&
  !directDocumentId.includes("/") &&
  directDocumentId !== "." &&
  directDocumentId !== "..";

if (isSafeDocumentId) {
  const directSnap = await getDoc(
    doc(db, COLLECTIONS.PRODUCTS, directDocumentId)
  );

  if (directSnap.exists() && directSnap.data().deleted !== true) {
    return {
      id: directSnap.id,
      ...directSnap.data(),
    } as ProductDocument;
  }
}

    // Field-based lookups
    const checks: Array<[string, string]> = [
      ["upc", clean],
      ["sku", clean],
      ["hcpcs", upper],
      ["manufacturerItemId", clean],
    ];

    for (const [field, value] of checks) {
      if (!value) continue;

      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.PRODUCTS),
          where(field, "==", value),
          limit(1),
        ),
      );
      const match = snap.docs.find((d) => d.data().deleted !== true);
      if (match) {
        return { id: match.id, ...match.data() } as ProductDocument;
      }
    }

    return null;
  },

  /**
   * Find an existing product by matching fields from an inventory item.
   */
  async findExistingProduct(params: {
    productId?: string;
    barcode?: string;
    sku?: string;
    hcpc?: string;
    manufacturerItemId?: string;
  }): Promise<string | null> {
    const directProductId = clean(params.productId);
const isSafeProductId =
  directProductId.length > 0 &&
  !directProductId.includes("/") &&
  directProductId !== "." &&
  directProductId !== "..";

if (isSafeProductId) {
  const directSnap = await getDoc(
    doc(db, COLLECTIONS.PRODUCTS, directProductId)
  );

  if (directSnap.exists()) {
    return directProductId;
  }
}

    const barcode = params.barcode ? normalizeBarcode(params.barcode) : "";
    const checks: Array<[string, string]> = [
      ["upc", barcode],
      ["sku", clean(params.sku)],
      ["hcpcs", clean(params.hcpc).toUpperCase()],
      ["manufacturerItemId", clean(params.manufacturerItemId)],
    ];

    for (const [field, value] of checks) {
      if (!value) continue;

      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.PRODUCTS),
          where(field, "==", value),
          limit(1),
        ),
      );
      const match = snap.docs.find((d) => d.data().deleted !== true);
      if (match) return match.id;
    }

    return null;
  },

  // ---- READ: Settings ----------------------------------------------------

  /**
   * Read inventory threshold settings from the app settings document.
   */
  async getSettings(): Promise<SettingsInventoryThresholds> {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "app"));
    const data = snap.data();
    const inventory =
      data?.inventory && typeof data.inventory === "object"
        ? (data.inventory as Record<string, unknown>)
        : {};

    return {
      defaultReorderLevel: readNumber(inventory.defaultReorderLevel, 5),
      cpapSupplyReorderLevel: readNumber(inventory.cpapSupplyReorderLevel, 10),
      oxygenReorderLevel: readNumber(inventory.oxygenReorderLevel, 3),
      rentalEquipmentReorderLevel: readNumber(inventory.rentalEquipmentReorderLevel, 2),
      highDemandReorderLevel: readNumber(inventory.highDemandReorderLevel, 15),
      lowStockWarningEnabled:
        typeof inventory.lowStockWarningEnabled === "boolean"
          ? inventory.lowStockWarningEnabled
          : true,
    };
  },

  // ---- READ: Patient data for pickup review ------------------------------

  /**
   * Fetch all patients (up to limit) for deceased-pickup review.
   */
  async getAllPatients(limitCount = 2500): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.PATIENTS), limit(limitCount)),
    );
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  },

  // ---- READ: Rental history for asset page -------------------------------

  /**
   * Fetch rental records matching an inventory item's serial, asset tag, or
   * sales order detail ID.
   */
  async getRentalRecordsForAsset(item: InventoryItem): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
    const queries: Array<ReturnType<typeof query>> = [];
    const serial = item.serial.trim();
    const assetTag = (item.assetTag || item.assetNumber || "").trim();

    if (serial) {
      queries.push(
        query(
          collection(db, COLLECTIONS.RENTALS),
          where("serialNumber", "==", serial),
          limit(100),
        ),
      );
    }

    if (assetTag && assetTag !== serial) {
      queries.push(
        query(
          collection(db, COLLECTIONS.RENTALS),
          where("assetTag", "==", assetTag),
          limit(100),
        ),
      );
    }

    if (item.salesOrderDetailId) {
      queries.push(
        query(
          collection(db, COLLECTIONS.RENTALS),
          where("salesOrderDetailId", "==", item.salesOrderDetailId),
          limit(100),
        ),
      );
    }

    if (queries.length === 0) return [];

    const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
    const seen = new Set<string>();
    const results: Array<{ id: string; data: Record<string, unknown> }> = [];

    snapshots.forEach((snap) => {
      snap.docs.forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          results.push({ id: d.id, data: d.data() as Record<string, unknown> });
        }
      });
    });

    return results;
  },

  // ---- SUBSCRIPTIONS -----------------------------------------------------

  /**
   * Subscribe to the inventory collection, ordered by name.
   */
  subscribeToInventory(
    limitCount: number,
    onData: InventorySubscriptionCallback,
    onError?: ErrorCallback,
  ): Unsubscribe {
    const inventoryQuery = query(
      collection(db, COLLECTIONS.INVENTORY),
      orderBy("name", "asc"),
      limit(limitCount),
    );

    return onSnapshot(
      inventoryQuery,
      (snapshot) => {
        const rows = snapshot.docs
          .map((d) => normalizeInventoryItem(d.id, d.data() as Record<string, unknown>))
          .filter((item) => !item.isDeleted);
        onData(rows);
      },
      (error) => {
        console.error("INVENTORY SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to a single inventory document by ID.
   */
  subscribeToInventoryItem(
    id: string,
    onData: InventoryItemSubscriptionCallback,
    onError?: ErrorCallback,
  ): Unsubscribe {
    return onSnapshot(
      doc(db, COLLECTIONS.INVENTORY, id),
      (snapshot) => {
        if (!snapshot.exists()) {
          onData(null);
          return;
        }
        onData(normalizeInventoryItem(snapshot.id, snapshot.data() as Record<string, unknown>));
      },
      (error) => {
        console.error("INVENTORY ITEM SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to inventory threshold settings.
   */
  subscribeToSettings(
    onData: SettingsSubscriptionCallback,
  ): Unsubscribe {
    return onSnapshot(doc(db, COLLECTIONS.SETTINGS, "app"), (snapshot) => {
      const data = snapshot.data();
      const inventory =
        data?.inventory && typeof data.inventory === "object"
          ? (data.inventory as Record<string, unknown>)
          : {};

      onData({
        defaultReorderLevel: readNumber(inventory.defaultReorderLevel, 5),
        cpapSupplyReorderLevel: readNumber(inventory.cpapSupplyReorderLevel, 10),
        oxygenReorderLevel: readNumber(inventory.oxygenReorderLevel, 3),
        rentalEquipmentReorderLevel: readNumber(inventory.rentalEquipmentReorderLevel, 2),
        highDemandReorderLevel: readNumber(inventory.highDemandReorderLevel, 15),
        lowStockWarningEnabled:
          typeof inventory.lowStockWarningEnabled === "boolean"
            ? inventory.lowStockWarningEnabled
            : true,
      });
    });
  },

  /**
   * Subscribe to patients collection (for deceased pickup review).
   */
  subscribeToPatients(
    limitCount: number,
    onData: PatientSubscriptionCallback,
    onError?: ErrorCallback,
  ): Unsubscribe {
    const patientsQuery = query(
      collection(db, COLLECTIONS.PATIENTS),
      limit(limitCount),
    );

    return onSnapshot(
      patientsQuery,
      (snapshot) => {
        onData(
          snapshot.docs.map((d) => ({
            id: d.id,
            data: d.data() as Record<string, unknown>,
          })),
        );
      },
      (error) => {
        console.error("PATIENTS SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },

  // ---- WRITE: Inventory documents ----------------------------------------

  /**
   * Create a new inventory document.
   */
  async create(data: Record<string, unknown>): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTIONS.INVENTORY), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * Update an existing inventory document (merge semantics).
   */
  async update(id: string, data: Record<string, unknown>): Promise<void> {
    assertMetadataOnlyInventoryWrite(data);
    await updateDoc(doc(db, COLLECTIONS.INVENTORY, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Soft-delete (archive) an inventory item.
   */
  async softDelete(id: string): Promise<void> {
    void id;
    throw new Error(
      "InventoryRepository.softDelete is disabled. Use createInventoryMovement with movementType archived."
    );
  },

  /**
   * Permanently delete an inventory document.
   */
  async hardDelete(id: string): Promise<void> {
    void id;
    throw new Error(
      "InventoryRepository.hardDelete is disabled. Use createInventoryMovement with movementType hard_delete."
    );
  },

  /**
   * Batch-update multiple inventory documents within a write batch.
   * Respects the Firestore batch limit of 500 writes.
   */
  async batchUpdate(updates: Array<{ id: string; data: Record<string, unknown> }>): Promise<void> {
    updates.forEach(({ data }) => assertMetadataOnlyInventoryWrite(data));
    const FIRESTORE_BATCH_LIMIT = 450;
    const chunks: Array<typeof updates> = [];

    for (let i = 0; i < updates.length; i += FIRESTORE_BATCH_LIMIT) {
      chunks.push(updates.slice(i, i + FIRESTORE_BATCH_LIMIT));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(({ id, data }) => {
        batch.update(doc(db, COLLECTIONS.INVENTORY, id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  },

  // ---- WRITE: Stock movements --------------------------------------------

  /**
   * Record a stock movement in the stockMovements collection.
   */
  async recordMovement(payload: {
    productId: string;
    productName: string;
    barcode: string;
    serial: string;
    lotNumber: string;
    type: string;
    quantity: number;
    sourceId: string;
    notes: string;
    affectedIds?: string[];
    patientKey?: string;
    patientName?: string;
    dateOfDeath?: string;
    pickupDate?: string;
    lastDeliveryDate?: string;
    createdBy?: string;
    createdByEmail?: string;
  }): Promise<void> {
    const movement: Record<string, unknown> = {
      productId: payload.productId,
      productName: payload.productName,
      barcode: payload.barcode,
      serial: payload.serial,
      lotNumber: payload.lotNumber,
      type: payload.type,
      quantity: payload.quantity,
      sourceId: payload.sourceId,
      notes: payload.notes,
      source: "inventory",
      createdAt: serverTimestamp(),
    };

    if (payload.affectedIds && payload.affectedIds.length > 0) {
      movement.affectedIds = payload.affectedIds;
    }

    if (payload.patientKey !== undefined) {
      movement.patientKey = payload.patientKey;
    }

    if (payload.patientName !== undefined) {
      movement.patientName = payload.patientName;
    }

    if (payload.dateOfDeath !== undefined) {
      movement.dateOfDeath = payload.dateOfDeath;
    }

    if (payload.pickupDate !== undefined) {
      movement.pickupDate = payload.pickupDate;
    }

    if (payload.lastDeliveryDate !== undefined) {
      movement.lastDeliveryDate = payload.lastDeliveryDate;
    }

    if (payload.createdBy !== undefined) {
      movement.createdBy = payload.createdBy;
    }

    if (payload.createdByEmail !== undefined) {
      movement.createdByEmail = payload.createdByEmail;
    }

    await addDoc(
      collection(db, COLLECTIONS.STOCK_MOVEMENTS),
      movement
    );
  },

  // ---- WRITE: Product documents ------------------------------------------

  /**
   * Upsert a product document (merge behavior).
   */
  async upsertProduct(id: string, data: Record<string, unknown>): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PRODUCTS, id), data, { merge: true });
  },

  /**
   * Upsert an HCPCS code document (merge behavior).
   */
  async upsertHcpcsCode(code: string, data: Record<string, unknown>): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.HCPCS_CODES, code), data, { merge: true });
  },

  // ---- WRITE: Patient equipment archive (used by return service) ---------

  /**
   * Update a patient document field.
   */
  async updatePatient(patientKey: string, data: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.PATIENTS, patientKey), data);
  },

  /**
   * Create or update a subcollection document under a patient.
   */
  async setPatientSubdoc(
    patientKey: string,
    subcollection: string,
    docId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await setDoc(doc(db, COLLECTIONS.PATIENTS, patientKey, subcollection, docId), data, {
      merge: true,
    });
  },

  /**
   * Add a document to a patient subcollection.
   */
  async addToPatientSubcollection(
    patientKey: string,
    subcollection: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const ref = await addDoc(
      collection(db, COLLECTIONS.PATIENTS, patientKey, subcollection),
      data,
    );
    return ref.id;
  },

  // ---- UTILITY: Raw document references ----------------------------------

  /**
   * Get a Firestore document reference for direct access.
   */
  docRef(collectionName: string, docId: string) {
    return doc(db, collectionName, docId);
  },

  /**
   * Get a Firestore collection reference.
   */
  collectionRef(collectionName: string) {
    return collection(db, collectionName);
  },
};

