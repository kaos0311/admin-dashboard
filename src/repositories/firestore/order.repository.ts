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
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { getImportRetentionCutoff } from "@/lib/importRetention";

import { normalizeImportJob, normalizeOrder } from "@/app/(admin)/orders/lib/orderNormalize";
import type { FilterTab, ImportJob, OrderRow } from "@/app/(admin)/orders/lib/orderTypes";

import type {
  ErrorCallback,
  FacilityAutofillOption,
  PatientAutofillOption,
  ProductAutofillOption,
} from "./order.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION_ORDERS = "orders" as const;
const COLLECTION_IMPORT_JOBS = "importJobs" as const;
const COLLECTION_PATIENTS_INDEX = "patients_index" as const;
const COLLECTION_PRODUCTS = "products" as const;
const COLLECTION_ROLODEX_CONTACTS = "rolodexContacts" as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function moneyText(...values: unknown[]): string {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return String(parsed);
  }
  return "0";
}

function compactAddress(data: Record<string, unknown>): string {
  const direct = text(data.address || data.fullAddress || data.patientAddress);
  if (direct) return direct;

  return [
    text(data.address1 || data.streetAddress),
    text(data.city),
    text(data.state),
    text(data.zip || data.postalCode),
  ]
    .filter(Boolean)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Order Repository
// ---------------------------------------------------------------------------

export const OrderRepository = {
  // ---- READ: Paginated orders ---------------------------------------------

  /**
   * Fetch a page of orders filtered by tab and ordered by createdAt desc.
   * Handles isHospice filtering, import retention cutoff, cursor pagination.
   */
  async getOrdersPage(params: {
    tab: FilterTab;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
    pageSize?: number;
  }): Promise<{
    orders: OrderRow[];
    nextCursor: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    const { tab, cursor, pageSize = 75 } = params;
    const baseCollection = collection(db, COLLECTION_ORDERS);
    const importCutoff = getImportRetentionCutoff();

    const baseConstraints = [
      where("isHospice", "==", false),
      where("createdAt", ">=", importCutoff),
      orderBy("createdAt", "desc"),
    ] as const;

    const ordersQuery =
      tab === "all"
        ? cursor
          ? query(baseCollection, ...baseConstraints, startAfter(cursor), limit(pageSize))
          : query(baseCollection, ...baseConstraints, limit(pageSize))
        : cursor
          ? query(
              baseCollection,
              where("status", "==", tab),
              ...baseConstraints,
              startAfter(cursor),
              limit(pageSize),
            )
          : query(
              baseCollection,
              where("status", "==", tab),
              ...baseConstraints,
              limit(pageSize),
            );

    const snapshot = await getDocs(ordersQuery);

    const orders = snapshot.docs.map((docSnap) =>
      normalizeOrder(docSnap.id, docSnap.data() as Record<string, unknown>),
    );

    const nextCursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
    const hasMore = snapshot.docs.length === pageSize;

    return { orders, nextCursor, hasMore };
  },

  // ---- WRITE: Order documents ---------------------------------------------

  /**
   * Create a new order document. Returns the generated document ID.
   */
  async create(data: Record<string, unknown>): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTION_ORDERS), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  /**
   * Update an existing order document (merge semantics with updatedAt).
   */
  async update(id: string, data: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_ORDERS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Update an order after initial creation (adds serverTimestamp).
   */
  async updateAfterCreate(id: string, data: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(db, COLLECTION_ORDERS, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  // ---- WRITE: Import jobs -------------------------------------------------

  /**
   * Create a new import job document with a generated ID. Returns the ID.
   */
  async createImportJob(data: Record<string, unknown>): Promise<{ id: string }> {
    const importJobRef = doc(collection(db, COLLECTION_IMPORT_JOBS));
    await setDoc(importJobRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { id: importJobRef.id };
  },

  // ---- READ: Duplicate import detection -----------------------------------

  /**
   * Find a recent import job with a matching duplicateKey.
   */
  async findDuplicateImport(duplicateKey: string): Promise<ImportJob | null> {
    const importsRef = collection(db, COLLECTION_IMPORT_JOBS);
    const duplicateQuery = query(
      importsRef,
      where("duplicateKey", "==", duplicateKey),
      orderBy("createdAt", "desc"),
      limit(1),
    );

    const snapshot = await getDocs(duplicateQuery);

    if (snapshot.empty) return null;

    const doc_ = snapshot.docs[0];
    return normalizeImportJob(doc_.id, doc_.data() as ImportJob);
  },

  // ---- SUBSCRIPTIONS: Autofill data ---------------------------------------

  /**
   * Subscribe to patients_index for autofill suggestions.
   */
  subscribeToPatientsForAutofill(
    onData: (patients: PatientAutofillOption[]) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    const patientsQuery = query(collection(db, COLLECTION_PATIENTS_INDEX), limit(250));

    return onSnapshot(
      patientsQuery,
      (snapshot) => {
        const patients = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            const name = text(
              data.patientName ||
                data.fullName ||
                [data.firstName, data.lastName].map(text).filter(Boolean).join(" "),
            );

            return {
              id: docSnapshot.id,
              name,
              address: compactAddress(data),
              phone: text(data.phone || data.mobilePhone || data.homePhone),
              facilityName: text(data.facility || data.facilityName),
            };
          })
          .filter((option) => option.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        onData(patients);
      },
      (error) => {
        console.error("PATIENTS AUTO FILL SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to products for autofill suggestions.
   */
  subscribeToProductsForAutofill(
    onData: (products: ProductAutofillOption[]) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    const productsQuery = query(collection(db, COLLECTION_PRODUCTS), limit(250));

    return onSnapshot(
      productsQuery,
      (snapshot) => {
        const products = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;
            const name = text(data.name || data.itemName || data.description);

            return {
              id: docSnapshot.id,
              name,
              sku: text(data.sku || data.itemId),
              barcode: text(data.upc || data.barcode),
              price: moneyText(
                data.basePrice,
                data.defaultPurchasePrice,
                data.price,
                data.unitCost,
              ),
            };
          })
          .filter((option) => option.name || option.sku || option.barcode)
          .sort((a, b) => a.name.localeCompare(b.name));

        onData(products);
      },
      (error) => {
        console.error("PRODUCTS AUTO FILL SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },

  /**
   * Subscribe to rolodexContacts (filtered to facilities) for autofill suggestions.
   */
  subscribeToFacilitiesForAutofill(
    onData: (facilities: FacilityAutofillOption[]) => void,
    onError?: ErrorCallback,
  ): Unsubscribe {
    const rolodexQuery = query(collection(db, COLLECTION_ROLODEX_CONTACTS), limit(500));

    return onSnapshot(
      rolodexQuery,
      (snapshot) => {
        const facilities = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data() as Record<string, unknown>;

            return {
              id: docSnapshot.id,
              name: text(data.organization || data.name),
              address: text(data.address),
              phone: text(data.phone),
              fax: text(data.alternatePhone),
              group: text(data.roleTitle),
              contactType: text(data.contactType),
            };
          })
          .filter((facility) => facility.contactType === "facility" && facility.name)
          .map(({ contactType: _contactType, ...facility }) => facility)
          .sort((a, b) => a.name.localeCompare(b.name));

        onData(facilities);
      },
      (error) => {
        console.error("FACILITIES AUTO FILL SUBSCRIPTION ERROR:", error);
        onError?.(error);
      },
    );
  },
};