// functions/src/intelligence/searchIndexBuilder.ts

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../imports/utils/firestore.js";

import { writeAuditLog } from "../audit/auditLogger.js";

import {
  cleanText,
  normalizeSearchText,
  makeSafeDocId,
  uniqueCleanList,
} from "../imports/utils/normalize.js";

export type SearchEntityType =
  | "patient"
  | "order"
  | "hospice"
  | "rental"
  | "inventory";

export interface SearchIndexRecord {
  entityType: SearchEntityType;
  entityId: string;

  displayName: string;

  searchText: string;
  searchTextLower: string;

  exactMatches: string[];
  tokens: string[];

  status?: string | null;
  patientId?: string | null;

  sourceCollections: string[];

  metadata?: Record<string, unknown>;

  createdAt?: FirebaseFirestore.FieldValue | Timestamp;
  updatedAt: FirebaseFirestore.FieldValue;
}

const MAX_SEARCH_TEXT_LENGTH = 4000;
const MAX_TOKEN_COUNT = 100;

function getString(
  data: FirebaseFirestore.DocumentData,
  keys: string[]
): string {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return cleanText(value);
    }
  }

  return "";
}

function getNullableString(
  data: FirebaseFirestore.DocumentData,
  keys: string[]
): string | null {
  const value = getString(data, keys);

  return value || null;
}

function buildSearchText(values: unknown[]): string {
  return uniqueCleanList(values)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_TEXT_LENGTH);
}

function buildTokens(values: unknown[]): string[] {
  const tokenSet = new Set<string>();

  values.forEach((value) => {
    const normalized = normalizeSearchText(value);

    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .forEach((token) => tokenSet.add(token));
  });

  return Array.from(tokenSet).slice(0, MAX_TOKEN_COUNT);
}

function buildExactMatches(values: unknown[]): string[] {
  return uniqueCleanList(values)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .slice(0, 50);
}

function makeSearchDocId(
  entityType: SearchEntityType,
  entityId: string
): string {
  return makeSafeDocId(`${entityType}_${entityId}`);
}

function patientDisplayName(
  data: FirebaseFirestore.DocumentData
): string {
  const fullName = getString(data, [
    "fullName",
    "patientName",
    "name",
    "displayName",
    "sourceFullName",
  ]);

  if (fullName) return fullName;

  const firstName = getString(data, [
    "firstName",
    "first_name",
  ]);

  const lastName = getString(data, [
    "lastName",
    "last_name",
  ]);

  return (
    `${lastName}, ${firstName}`
      .replace(/^,\s*/, "")
      .trim() || "Unnamed patient"
  );
}

function buildBaseRecord(params: {
  entityType: SearchEntityType;
  entityId: string;
  displayName: string;
  values: unknown[];
  status?: string | null;
  patientId?: string | null;
  sourceCollections: string[];
  metadata?: Record<string, unknown>;
}): SearchIndexRecord {
  const {
    entityType,
    entityId,
    displayName,
    values,
    status,
    patientId,
    sourceCollections,
    metadata,
  } = params;

  const searchText = buildSearchText(values);

  return {
    entityType,
    entityId,

    displayName,

    searchText,
    searchTextLower: searchText.toLowerCase(),

    tokens: buildTokens(values),
    exactMatches: buildExactMatches(values),

    status: status ?? null,
    patientId: patientId ?? null,

    sourceCollections,

    metadata,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildPatientIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName = patientDisplayName(data);

  const values = [
    displayName,

    data.firstName,
    data.lastName,
    data.fullName,
    data.patientName,

    data.phone,
    data.primaryPhone,
    data.email,

    data.dateOfBirth,
    data.birthDate,
    data.dob,

    data.address,
    data.city,
    data.state,
    data.zip,

    data.customerId,
    data.accountNumber,

    data.hospiceName,
    data.insuranceName,
    data.policyNumber,
  ];

  return buildBaseRecord({
    entityType: "patient",
    entityId: id,
    displayName,
    values,

    status: getNullableString(data, [
      "status",
      "patientStatus",
    ]),

    patientId: id,

    sourceCollections: [
      "patients",
      "patients_index",
    ],

    metadata: {
      dob: data.dateOfBirth || data.dob || null,
    },
  });
}

function buildOrderIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, [
      "orderNumber",
      "invoiceNumber",
      "displayName",
    ]) || `Order ${id}`;

  const values = [
    displayName,

    data.orderNumber,
    data.invoiceNumber,

    data.patientId,
    data.patientName,

    data.status,
    data.orderStatus,
    data.orderType,

    data.productName,
    data.itemName,

    data.serialNumber,
    data.sku,
    data.barcode,
  ];

  return buildBaseRecord({
    entityType: "order",
    entityId: id,
    displayName,
    values,

    status: getNullableString(data, [
      "status",
      "orderStatus",
    ]),

    patientId: getNullableString(data, [
      "patientId",
    ]),

    sourceCollections: ["orders"],
  });
}

function buildHospiceIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, [
      "patientName",
      "fullName",
      "displayName",
    ]) ||
    getString(data, ["hospiceName"]) ||
    `Hospice ${id}`;

  const values = [
    displayName,

    data.patientName,
    data.fullName,

    data.hospiceName,

    data.status,
    data.patientId,

    data.phone,

    data.address,
    data.city,
    data.state,
    data.zip,
  ];

  return buildBaseRecord({
    entityType: "hospice",
    entityId: id,
    displayName,
    values,

    status: getNullableString(data, ["status"]),

    patientId: getNullableString(data, [
      "patientId",
    ]),

    sourceCollections: ["hospicePatients"],
  });
}

function buildInventoryIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, [
      "itemName",
      "productName",
      "name",
      "displayName",
    ]) || `Inventory ${id}`;

  const values = [
    displayName,

    data.itemName,
    data.productName,
    data.name,

    data.sku,
    data.barcode,
    data.serialNumber,

    data.category,
    data.status,
  ];

  return buildBaseRecord({
    entityType: "inventory",
    entityId: id,
    displayName,
    values,

    status: getNullableString(data, ["status"]),

    patientId: getNullableString(data, [
      "patientId",
    ]),

    sourceCollections: [
      "products",
      "inventoryIntelligence",
    ],
  });
}

function buildRentalIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, [
      "itemName",
      "productName",
      "rentalName",
      "displayName",
    ]) || `Rental ${id}`;

  const values = [
    displayName,

    data.itemName,
    data.productName,
    data.rentalName,

    data.patientName,
    data.patientId,

    data.serialNumber,

    data.status,
    data.rentalStatus,
  ];

  return buildBaseRecord({
    entityType: "rental",
    entityId: id,
    displayName,
    values,

    status: getNullableString(data, [
      "status",
      "rentalStatus",
    ]),

    patientId: getNullableString(data, [
      "patientId",
    ]),

    sourceCollections: [
      "rentals",
      "rentalIntelligence",
    ],
  });
}

async function upsertSearchRecords(
  records: SearchIndexRecord[]
): Promise<void> {
  const chunks = chunkArray(records, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((record) => {
      const docId = makeSearchDocId(
        record.entityType,
        record.entityId
      );

      const ref = db.collection("searchIndex").doc(docId);

      batch.set(
        ref,
        {
          ...record,

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}

async function rebuildCollectionIndex(params: {
  collectionName: string;
  builder: (
    id: string,
    data: FirebaseFirestore.DocumentData
  ) => SearchIndexRecord;
}): Promise<number> {
  const snapshot = await db
    .collection(params.collectionName)
    .get();

  const records = snapshot.docs.map((doc) =>
    params.builder(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildPatientSearchIndex(): Promise<number> {
  return rebuildCollectionIndex({
    collectionName: "patients_index",
    builder: buildPatientIndexRecord,
  });
}

export async function rebuildOrderSearchIndex(): Promise<number> {
  return rebuildCollectionIndex({
    collectionName: "orders",
    builder: buildOrderIndexRecord,
  });
}

export async function rebuildHospiceSearchIndex(): Promise<number> {
  return rebuildCollectionIndex({
    collectionName: "hospicePatients",
    builder: buildHospiceIndexRecord,
  });
}

export async function rebuildInventorySearchIndex(): Promise<number> {
  return rebuildCollectionIndex({
    collectionName: "products",
    builder: buildInventoryIndexRecord,
  });
}

export async function rebuildRentalSearchIndex(): Promise<number> {
  return rebuildCollectionIndex({
    collectionName: "rentals",
    builder: buildRentalIndexRecord,
  });
}

export async function rebuildAllSearchIndexes(): Promise<{
  patients: number;
  orders: number;
  hospice: number;
  inventory: number;
  rentals: number;
  total: number;
}> {
  const [
    patients,
    orders,
    hospice,
    inventory,
    rentals,
  ] = await Promise.all([
    rebuildPatientSearchIndex(),
    rebuildOrderSearchIndex(),
    rebuildHospiceSearchIndex(),
    rebuildInventorySearchIndex(),
    rebuildRentalSearchIndex(),
  ]);

  const total =
    patients +
    orders +
    hospice +
    inventory +
    rentals;

  await writeAuditLog({
    action: "reprocess_completed",

    actorUid: "system",
    actorEmail: "system",

    targetType: "system",
    targetId: "searchIndex",

    safeSummary: `Rebuilt search index with ${total} records.`,

    metadata: {
      patients,
      orders,
      hospice,
      inventory,
      rentals,
      total,
    },
  });

  return {
    patients,
    orders,
    hospice,
    inventory,
    rentals,
    total,
  };
}

export async function updateSearchIndexForDocument(params: {
  collectionName: string;
  documentId: string;
  data: FirebaseFirestore.DocumentData;
}): Promise<void> {
  const {
    collectionName,
    documentId,
    data,
  } = params;

  let record: SearchIndexRecord | null = null;

  switch (collectionName) {
    case "patients":
    case "patients_index":
      record = buildPatientIndexRecord(
        documentId,
        data
      );
      break;

    case "orders":
      record = buildOrderIndexRecord(
        documentId,
        data
      );
      break;

    case "hospicePatients":
      record = buildHospiceIndexRecord(
        documentId,
        data
      );
      break;

    case "products":
      record = buildInventoryIndexRecord(
        documentId,
        data
      );
      break;

    case "rentals":
      record = buildRentalIndexRecord(
        documentId,
        data
      );
      break;

    default:
      return;
  }

  await upsertSearchRecords([record]);
}

export async function deleteSearchIndexForDocument(params: {
  entityType: SearchEntityType;
  documentId: string;
}): Promise<void> {
  const docId = makeSearchDocId(
    params.entityType,
    params.documentId
  );

  await db.collection("searchIndex").doc(docId).delete();
}