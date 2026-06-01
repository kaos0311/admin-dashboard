// functions/src/intelligence/searchIndexBuilder.ts

import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import {
  chunkArray,
  db,
  FIRESTORE_BATCH_SIZE,
} from "../imports/utils/firestore.js";
import { writeAuditLog } from "../audit/auditLogger.js";
import {
  cleanText,
  makeSafeDocId,
  normalizeSearchText,
  uniqueCleanList,
} from "../imports/utils/normalize.js";

const MAX_SEARCH_TEXT_LENGTH = 4000;
const MAX_TOKEN_COUNT = 150;
const PAGE_SIZE = 500;

type SearchEntityType = "patient" | "order" | "hospice" | "inventory" | "rental";

type UnknownRecord = Record<string, unknown>;

type SearchIndexRecord = {
  entityType: SearchEntityType;
  entityId: string;
  displayName: string;

  searchText: string;
  searchTextLower: string;
  primarySearch: string;
  secondarySearch: string;
  metadataSearch: string;

  tokens: string[];
  exactMatches: string[];

  status: string | null;
  patientId: string | null;

  sourceCollections: string[];

  priority: number;
  urgency: "low" | "normal" | "high" | "critical";
  alertLevel: "none" | "info" | "warning" | "danger";
  complianceRisk: boolean;
  operationalTags: string[];

  isDeleted: boolean;

  metadata?: Record<string, unknown>;

  createdAt?: FieldValue | Timestamp | null;
  updatedAt: FieldValue;
};

type BuildBaseRecordParams = {
  entityType: SearchEntityType;
  entityId: string;
  displayName: string;

  primaryValues: unknown[];
  secondaryValues?: unknown[];
  metadataValues?: unknown[];

  status?: string | null;
  patientId?: string | null;

  sourceCollections: string[];

  priority?: number;
  urgency?: SearchIndexRecord["urgency"];
  alertLevel?: SearchIndexRecord["alertLevel"];
  complianceRisk?: boolean;
  operationalTags?: string[];

  metadata?: Record<string, unknown>;
};

type RebuildCollectionIndexParams = {
  collectionName: string;
  builder: (id: string, data: UnknownRecord) => SearchIndexRecord | null;
};

type UpdateSearchIndexParams = {
  collectionName: string;
  documentId: string;
  data: UnknownRecord;
};

type DeleteSearchIndexParams = {
  entityType: SearchEntityType;
  documentId: string;
  hardDelete?: boolean;
};

function asString(value: unknown): string {
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return cleanText(String(value));
  }
  return "";
}

function getString(data: UnknownRecord, keys: string[]): string {
  for (const key of keys) {
    const value = asString(data[key]);
    if (value) return value;
  }

  return "";
}

function getNullableString(data: UnknownRecord, keys: string[]): string | null {
  const value = getString(data, keys);
  return value || null;
}

function compactValues(values: unknown[]): string[] {
  return uniqueCleanList(values.map(asString)).filter(Boolean);
}

function buildSearchText(values: unknown[]): string {
  return compactValues(values)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_TEXT_LENGTH);
}

function isUsefulShortToken(token: string): boolean {
  return (
    /^[a-z]\d$/i.test(token) ||
    /^\d[a-z]$/i.test(token) ||
    ["o2", "cp", "bp", "po", "rx"].includes(token)
  );
}

function buildTokens(values: unknown[]): string[] {
  const tokenSet = new Set<string>();

  compactValues(values).forEach((value) => {
    normalizeSearchText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 || isUsefulShortToken(token))
      .forEach((token) => tokenSet.add(token));
  });

  return Array.from(tokenSet).slice(0, MAX_TOKEN_COUNT);
}

function buildExactMatches(values: unknown[]): string[] {
  return compactValues(values)
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .slice(0, 75);
}

function makeSearchDocId(entityType: SearchEntityType, entityId: string): string {
  return makeSafeDocId(`${entityType}_${entityId}`);
}

function patientDisplayName(data: UnknownRecord): string {
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

function readMetadata(data: UnknownRecord): Record<string, unknown> {
  return {
    fingerprint: data.fingerprint ?? null,
    sourceFile: data.sourceFile ?? data.fileName ?? null,
    importBatchId: data.importBatchId ?? data.jobId ?? null,
    reportType: data.reportType ?? null,
    importedAt: data.importedAt ?? null,
  };
}

function buildBaseRecord(params: BuildBaseRecordParams): SearchIndexRecord {
  const {
    entityType,
    entityId,
    displayName,
    primaryValues,
    secondaryValues = [],
    metadataValues = [],
    status,
    patientId,
    sourceCollections,
    priority = 0,
    urgency = "normal",
    alertLevel = "none",
    complianceRisk = false,
    operationalTags = [],
    metadata,
  } = params;

  const allValues = [
    displayName,
    ...primaryValues,
    ...secondaryValues,
    ...metadataValues,
  ];

  const primarySearch = buildSearchText([displayName, ...primaryValues]);
  const secondarySearch = buildSearchText(secondaryValues);
  const metadataSearch = buildSearchText(metadataValues);
  const searchText = buildSearchText(allValues);

  return {
    entityType,
    entityId,
    displayName,

    searchText,
    searchTextLower: searchText.toLowerCase(),
    primarySearch,
    secondarySearch,
    metadataSearch,

    tokens: buildTokens(allValues),
    exactMatches: buildExactMatches(allValues),

    status: status ?? null,
    patientId: patientId ?? null,

    sourceCollections,

    priority,
    urgency,
    alertLevel,
    complianceRisk,
    operationalTags: uniqueCleanList(operationalTags),

    isDeleted: false,

    metadata,

    updatedAt: FieldValue.serverTimestamp(),
  };
}

function buildPatientIndexRecord(id: string, data: UnknownRecord): SearchIndexRecord {
  const displayName = patientDisplayName(data);

  return buildBaseRecord({
    entityType: "patient",
    entityId: id,
    displayName,

    primaryValues: [
      data.firstName,
      data.lastName,
      data.fullName,
      data.patientName,
      data.customerId,
      data.accountNumber,
      data.patientId,
      data.mrn,
    ],

    secondaryValues: [
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
    ],

    metadataValues: [
      data.hospiceName,
      data.insuranceName,
      data.policyNumber,
      data.status,
      data.patientStatus,
    ],

    status: getNullableString(data, ["status", "patientStatus"]),
    patientId: id,

    sourceCollections: ["patients", "patients_index"],

    operationalTags: ["patient"],

    metadata: {
      ...readMetadata(data),
      dob: data.dateOfBirth ?? data.dob ?? null,
    },
  });
}

function buildOrderIndexRecord(id: string, data: UnknownRecord): SearchIndexRecord {
  const displayName =
    getString(data, ["orderNumber", "invoiceNumber", "displayName"]) || `Order ${id}`;

  const status = getNullableString(data, ["status", "orderStatus"]);

  return buildBaseRecord({
    entityType: "order",
    entityId: id,
    displayName,

    primaryValues: [
      data.orderNumber,
      data.invoiceNumber,
      data.patientId,
      data.patientName,
      data.serialNumber,
      data.sku,
      data.barcode,
      data.hcpcs,
      data.hcpcsCode,
      data.procedureCode,
      data.billingCode,
    ],

    secondaryValues: [
      data.status,
      data.orderStatus,
      data.orderType,
      data.productName,
      data.itemName,
      data.manufacturer,
      data.brand,
      data.model,
    ],

    metadataValues: [data.createdBy, data.assignedTo, data.location],

    status,
    patientId: getNullableString(data, ["patientId"]),

    sourceCollections: ["orders"],

    urgency: status?.toLowerCase().includes("hold") ? "high" : "normal",
    alertLevel: status?.toLowerCase().includes("hold") ? "warning" : "none",
    priority: status?.toLowerCase().includes("hold") ? 50 : 0,

    operationalTags: ["order"],

    metadata: readMetadata(data),
  });
}

function buildHospiceIndexRecord(id: string, data: UnknownRecord): SearchIndexRecord | null {
  const hospiceName = getString(data, ["hospiceName", "hospice"]);
  const patientName = getString(data, ["patientName", "fullName", "displayName"]);
  const patientId = getNullableString(data, ["patientId"]);

  const isValidHospice = Boolean(hospiceName) && Boolean(patientName || patientId);

  if (!isValidHospice) return null;

  const displayName = patientName || hospiceName || `Hospice ${id}`;

  return buildBaseRecord({
    entityType: "hospice",
    entityId: id,
    displayName,

    primaryValues: [patientName, patientId, hospiceName],

    secondaryValues: [
      data.status,
      data.phone,
      data.address,
      data.city,
      data.state,
      data.zip,
    ],

    metadataValues: [
      data.startDate,
      data.endDate,
      data.caseManager,
      data.team,
      data.branch,
    ],

    status: getNullableString(data, ["status"]),
    patientId,

    sourceCollections: ["hospicePatients"],

    complianceRisk: true,
    urgency: "high",
    alertLevel: "warning",
    priority: 75,

    operationalTags: ["hospice", "patient", "compliance"],

    metadata: readMetadata(data),
  });
}

function buildInventoryIndexRecord(id: string, data: UnknownRecord): SearchIndexRecord {
  const displayName =
    getString(data, ["itemName", "productName", "name", "displayName"]) ||
    `Inventory ${id}`;

  const status = getNullableString(data, ["status"]);

  const lowStock =
    typeof data.quantityOnHand === "number" &&
    typeof data.reorderPoint === "number" &&
    data.quantityOnHand <= data.reorderPoint;

  return buildBaseRecord({
    entityType: "inventory",
    entityId: id,
    displayName,

    primaryValues: [
      data.itemName,
      data.productName,
      data.name,
      data.sku,
      data.barcode,
      data.serialNumber,
      data.hcpcs,
      data.hcpcsCode,
      data.procedureCode,
      data.billingCode,
    ],

    secondaryValues: [
      data.category,
      data.status,
      data.manufacturer,
      data.brand,
      data.model,
      data.vendor,
      data.lotNumber,
      data.location,
    ],

    metadataValues: [
      data.quantityOnHand,
      data.availableQuantity,
      data.reorderPoint,
      data.recallStatus,
    ],

    status,
    patientId: getNullableString(data, ["patientId"]),

    sourceCollections: ["products", "inventoryIntelligence"],

    urgency: lowStock ? "high" : "normal",
    alertLevel: lowStock ? "warning" : "none",
    priority: lowStock ? 60 : 0,
    complianceRisk: Boolean(data.recallStatus),

    operationalTags: uniqueCleanList([
      "inventory",
      lowStock ? "low-stock" : "",
      data.recallStatus ? "recall" : "",
    ]),

    metadata: {
      ...readMetadata(data),
      quantityOnHand: data.quantityOnHand ?? null,
      reorderPoint: data.reorderPoint ?? null,
      recallStatus: data.recallStatus ?? null,
    },
  });
}

function buildRentalIndexRecord(id: string, data: UnknownRecord): SearchIndexRecord {
  const displayName =
    getString(data, ["itemName", "productName", "rentalName", "displayName"]) ||
    `Rental ${id}`;

  const status = getNullableString(data, ["status", "rentalStatus"]);

  return buildBaseRecord({
    entityType: "rental",
    entityId: id,
    displayName,

    primaryValues: [
      data.itemName,
      data.productName,
      data.rentalName,
      data.patientName,
      data.patientId,
      data.serialNumber,
      data.sku,
      data.barcode,
      data.hcpcs,
      data.hcpcsCode,
      data.procedureCode,
      data.billingCode,
    ],

    secondaryValues: [
      data.status,
      data.rentalStatus,
      data.manufacturer,
      data.brand,
      data.model,
      data.location,
    ],

    metadataValues: [
      data.setupDate,
      data.pickupDate,
      data.lastBilledDate,
      data.nextBillingDate,
    ],

    status,
    patientId: getNullableString(data, ["patientId"]),

    sourceCollections: ["rentals", "rentalIntelligence"],

    urgency: status?.toLowerCase().includes("overdue") ? "high" : "normal",
    alertLevel: status?.toLowerCase().includes("overdue") ? "warning" : "none",
    priority: status?.toLowerCase().includes("overdue") ? 65 : 0,

    operationalTags: ["rental"],

    metadata: readMetadata(data),
  });
}

async function upsertSearchRecords(records: SearchIndexRecord[]): Promise<void> {
  const validRecords = records.filter(Boolean);

  for (const chunk of chunkArray(validRecords, FIRESTORE_BATCH_SIZE)) {
    const batch = db.batch();

    for (const record of chunk) {
      const docId = makeSearchDocId(record.entityType, record.entityId);
      const ref = db.collection("searchIndex").doc(docId);
      const existing = await ref.get();

      batch.set(
        ref,
        {
          ...record,
          createdAt: existing.exists
            ? existing.data()?.createdAt ?? FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    await batch.commit();
  }
}

async function rebuildCollectionIndex(
  params: RebuildCollectionIndexParams,
): Promise<number> {
  let lastDoc:
    | FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
    | null = null;

  let total = 0;

  while (true) {
    let query = db
      .collection(params.collectionName)
      .orderBy("__name__")
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) break;

    const records = snapshot.docs
      .map((doc) => params.builder(doc.id, doc.data() as UnknownRecord))
      .filter((record): record is SearchIndexRecord => Boolean(record));

    await upsertSearchRecords(records);

    total += records.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.size < PAGE_SIZE) break;
  }

  return total;
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
  const [patients, orders, hospice, inventory, rentals] = await Promise.all([
    rebuildPatientSearchIndex(),
    rebuildOrderSearchIndex(),
    rebuildHospiceSearchIndex(),
    rebuildInventorySearchIndex(),
    rebuildRentalSearchIndex(),
  ]);

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

export async function updateSearchIndexForDocument(
  params: UpdateSearchIndexParams,
): Promise<void> {
  const { collectionName, documentId, data } = params;

  let record: SearchIndexRecord | null = null;

  switch (collectionName) {
    case "patients":
    case "patients_index":
      record = buildPatientIndexRecord(documentId, data);
      break;

    case "orders":
      record = buildOrderIndexRecord(documentId, data);
      break;

    case "hospicePatients":
      record = buildHospiceIndexRecord(documentId, data);
      break;

    case "products":
      record = buildInventoryIndexRecord(documentId, data);
      break;

    case "rentals":
      record = buildRentalIndexRecord(documentId, data);
      break;

    default:
      return;
  }

  if (!record) return;

  await upsertSearchRecords([record]);
}

export async function deleteSearchIndexForDocument(
  params: DeleteSearchIndexParams,
): Promise<void> {
  const docId = makeSearchDocId(params.entityType, params.documentId);
  const ref = db.collection("searchIndex").doc(docId);

  if (params.hardDelete) {
    await ref.delete();
    return;
  }

  await ref.set(
    {
      isDeleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
