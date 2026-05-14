import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db, FIRESTORE_BATCH_SIZE, chunkArray } from "../imports/utils/firestore";
import { writeAuditLog } from "../audit/auditLogger";

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
  tokens: string[];

  status?: string | null;
  patientId?: string | null;

  sourceCollections: string[];

  createdAt?: FirebaseFirestore.FieldValue | Timestamp;
  updatedAt: FirebaseFirestore.FieldValue;
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getString(data: FirebaseFirestore.DocumentData, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
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

function buildTokens(values: unknown[]): string[] {
  const tokenSet = new Set<string>();

  values.forEach((value) => {
    const cleaned = cleanText(value);

    cleaned
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
      .forEach((token) => tokenSet.add(token));
  });

  return Array.from(tokenSet).slice(0, 50);
}

function buildSearchText(values: unknown[]): string {
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function makeSearchDocId(entityType: SearchEntityType, entityId: string): string {
  return `${entityType}_${entityId}`;
}

function patientDisplayName(data: FirebaseFirestore.DocumentData): string {
  const fullName = getString(data, [
    "fullName",
    "patientName",
    "name",
    "displayName",
    "sourceFullName",
  ]);

  if (fullName) return fullName;

  const firstName = getString(data, ["firstName", "first_name"]);
  const lastName = getString(data, ["lastName", "last_name"]);

  return `${lastName}, ${firstName}`.replace(/^,\s*/, "").trim() || "Unnamed patient";
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
    data.normalizedFullName,
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
    data.hospiceName,
    data.insuranceName,
    data.policyNumber,
  ];

  return {
    entityType: "patient",
    entityId: id,
    displayName,
    searchText: buildSearchText(values),
    tokens: buildTokens(values),
    status: getNullableString(data, ["status", "patientStatus"]),
    patientId: id,
    sourceCollections: ["patients", "patients_index"],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildOrderIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, ["orderNumber", "invoiceNumber", "displayName"]) ||
    `Order ${id}`;

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

  return {
    entityType: "order",
    entityId: id,
    displayName,
    searchText: buildSearchText(values),
    tokens: buildTokens(values),
    status: getNullableString(data, ["status", "orderStatus"]),
    patientId: getNullableString(data, ["patientId"]),
    sourceCollections: ["orders"],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildHospiceIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, ["patientName", "fullName", "displayName"]) ||
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

  return {
    entityType: "hospice",
    entityId: id,
    displayName,
    searchText: buildSearchText(values),
    tokens: buildTokens(values),
    status: getNullableString(data, ["status"]),
    patientId: getNullableString(data, ["patientId"]),
    sourceCollections: ["hospicePatients"],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildInventoryIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, ["itemName", "productName", "name", "displayName"]) ||
    `Inventory ${id}`;

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

  return {
    entityType: "inventory",
    entityId: id,
    displayName,
    searchText: buildSearchText(values),
    tokens: buildTokens(values),
    status: getNullableString(data, ["status"]),
    patientId: getNullableString(data, ["patientId"]),
    sourceCollections: ["products", "inventoryIntelligence"],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildRentalIndexRecord(
  id: string,
  data: FirebaseFirestore.DocumentData
): SearchIndexRecord {
  const displayName =
    getString(data, ["itemName", "productName", "rentalName", "displayName"]) ||
    `Rental ${id}`;

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

  return {
    entityType: "rental",
    entityId: id,
    displayName,
    searchText: buildSearchText(values),
    tokens: buildTokens(values),
    status: getNullableString(data, ["status", "rentalStatus"]),
    patientId: getNullableString(data, ["patientId"]),
    sourceCollections: ["rentals", "rentalIntelligence"],
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function upsertSearchRecords(records: SearchIndexRecord[]): Promise<void> {
  const chunks = chunkArray(records, FIRESTORE_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((record) => {
      const docId = makeSearchDocId(record.entityType, record.entityId);
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

async function clearSearchIndexForSources(
  sourceCollections: string[]
): Promise<number> {
  const snapshot = await db
    .collection("searchIndex")
    .where("sourceCollections", "array-contains-any", sourceCollections)
    .get();

  const docs = snapshot.docs;
  const chunks = chunkArray(docs, FIRESTORE_BATCH_SIZE);

  let deleted = 0;

  for (const chunk of chunks) {
    const batch = db.batch();

    chunk.forEach((doc) => {
      batch.delete(doc.ref);
      deleted += 1;
    });

    await batch.commit();
  }

  return deleted;
}

export async function rebuildPatientSearchIndex(): Promise<number> {
  const snapshot = await db.collection("patients_index").get();

  const records = snapshot.docs.map((doc) =>
    buildPatientIndexRecord(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildOrderSearchIndex(): Promise<number> {
  const snapshot = await db.collection("orders").get();

  const records = snapshot.docs.map((doc) =>
    buildOrderIndexRecord(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildHospiceSearchIndex(): Promise<number> {
  const snapshot = await db.collection("hospicePatients").get();

  const records = snapshot.docs.map((doc) =>
    buildHospiceIndexRecord(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildInventorySearchIndex(): Promise<number> {
  const snapshot = await db.collection("products").get();

  const records = snapshot.docs.map((doc) =>
    buildInventoryIndexRecord(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildRentalSearchIndex(): Promise<number> {
  const snapshot = await db.collection("rentals").get();

  const records = snapshot.docs.map((doc) =>
    buildRentalIndexRecord(doc.id, doc.data())
  );

  await upsertSearchRecords(records);

  return records.length;
}

export async function rebuildAllSearchIndexes(): Promise<{
  patients: number;
  orders: number;
  hospice: number;
  inventory: number;
  rentals: number;
  total: number;
}> {
  await clearSearchIndexForSources([
    "patients",
    "patients_index",
    "orders",
    "hospicePatients",
    "products",
    "rentals",
    "inventoryIntelligence",
    "rentalIntelligence",
  ]);

  const patients = await rebuildPatientSearchIndex();
  const orders = await rebuildOrderSearchIndex();
  const hospice = await rebuildHospiceSearchIndex();
  const inventory = await rebuildInventorySearchIndex();
  const rentals = await rebuildRentalSearchIndex();

  const total = patients + orders + hospice + inventory + rentals;

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
  const { collectionName, documentId, data } = params;

  let record: SearchIndexRecord | null = null;

  if (collectionName === "patients" || collectionName === "patients_index") {
    record = buildPatientIndexRecord(documentId, data);
  }

  if (collectionName === "orders") {
    record = buildOrderIndexRecord(documentId, data);
  }

  if (collectionName === "hospicePatients") {
    record = buildHospiceIndexRecord(documentId, data);
  }

  if (collectionName === "products") {
    record = buildInventoryIndexRecord(documentId, data);
  }

  if (collectionName === "rentals") {
    record = buildRentalIndexRecord(documentId, data);
  }

  if (!record) return;

  await upsertSearchRecords([record]);
}

export async function deleteSearchIndexForDocument(params: {
  entityType: SearchEntityType;
  documentId: string;
}): Promise<void> {
  const docId = makeSearchDocId(params.entityType, params.documentId);

  await db.collection("searchIndex").doc(docId).delete();
}