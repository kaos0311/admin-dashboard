import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireStaffOrAdmin } from "./auth.js";
import { type MovementActor, normalizeScanValue } from "./movementService.js";
import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { assertOperationId, assertSafeDocId, text } from "../domainWorkflows/shared.js";
import type {
  ManualInventoryMetadataUpdateInput,
  ManualInventoryMetadataUpdateResult,
} from "./types.js";

const INVENTORY_COLLECTION = "inventory";
const OPERATIONS_COLLECTION = "inventoryOperations";
const IDENTITY_LOCK_COLLECTION = "inventoryIdentityLocks";
const MAX_TEXT_LENGTH = 500;

const REJECTED_FIELDS = new Set([
  "quantityOnHand",
  "available",
  "committed",
  "onRent",
  "onOrder",
  "onTruck",
  "allocated",
  "reserved",
  "totalValue",
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
  "patientId",
  "patientKey",
  "patientName",
  "rentalId",
  "locationId",
  "warehouseId",
  "locationName",
  "binLocation",
]);

type IdentityInput = {
  barcode: string;
  serial: string;
  lotNumber: string;
  sku: string;
  manufacturerItemId: string;
  locationName: string;
  binLocation: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function key(value: unknown): string {
  return clean(value).toLowerCase();
}

function optionalText(value: unknown, field: string, maxLength = MAX_TEXT_LENGTH): string {
  const result = clean(value);
  if (result.length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is too long.`);
  }
  return result;
}

function requiredText(value: unknown, field: string, maxLength = MAX_TEXT_LENGTH): string {
  const result = optionalText(value, field, maxLength);
  if (!result) {
    throw new HttpsError("invalid-argument", `${field} is required.`);
  }
  return result;
}

function optionalNumber(value: unknown, field: string): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpsError("invalid-argument", `${field} must be a non-negative finite number.`);
  }
  return value;
}

function optionalBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    throw new HttpsError("invalid-argument", `${field} must be a boolean.`);
  }
  return value;
}

function normalizeBarcodeInput(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const parsed = normalizeScanValue(raw);
  if (parsed.status === "invalid") {
    throw new HttpsError("invalid-argument", parsed.error ?? "Invalid barcode.");
  }
  return parsed.value;
}

function rejectProtectedRequestFields(rawInput: Record<string, unknown>): void {
  const rejected = Object.keys(rawInput).filter((field) => REJECTED_FIELDS.has(field)).sort();
  if (rejected.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `Manual metadata update cannot change protected inventory fields: ${rejected.join(", ")}.`,
    );
  }
}

function assertMetadataOnlyInventoryWrite(data: Record<string, unknown>, context: string): void {
  const rejected = Object.keys(data).filter((field) => REJECTED_FIELDS.has(field)).sort();
  if (rejected.length > 0) {
    throw new HttpsError(
      "internal",
      `${context} attempted to write protected inventory fields: ${rejected.join(", ")}.`,
    );
  }
}

function normalizeInput(rawInput: ManualInventoryMetadataUpdateInput): ManualInventoryMetadataUpdateInput {
  rejectProtectedRequestFields(rawInput as unknown as Record<string, unknown>);

  return {
    operationId: requiredText(rawInput.operationId, "operationId", 160),
    inventoryItemId: requiredText(rawInput.inventoryItemId, "inventoryItemId", 160),
    productId: optionalText(rawInput.productId, "productId", 160),
    name: requiredText(rawInput.name, "name"),
    category: requiredText(rawInput.category, "category"),
    manufacturer: optionalText(rawInput.manufacturer, "manufacturer"),
    manufacturerItemId: optionalText(rawInput.manufacturerItemId, "manufacturerItemId", 160),
    sku: optionalText(rawInput.sku, "sku", 160),
    hcpc: optionalText(rawInput.hcpc, "hcpc", 80).toUpperCase(),
    barcode: normalizeBarcodeInput(rawInput.barcode),
    serial: optionalText(rawInput.serial, "serial", 160),
    lotNumber: optionalText(rawInput.lotNumber, "lotNumber", 160),
    reorderLevel: optionalNumber(rawInput.reorderLevel, "reorderLevel"),
    unitCost: optionalNumber(rawInput.unitCost, "unitCost"),
    modelNumber: optionalText(rawInput.modelNumber, "modelNumber", 160),
    warrantyProvider: optionalText(rawInput.warrantyProvider, "warrantyProvider", 160),
    warrantyStartDate: optionalText(rawInput.warrantyStartDate, "warrantyStartDate", 80),
    warrantyEndDate: optionalText(rawInput.warrantyEndDate, "warrantyEndDate", 80),
    warrantyNotes: optionalText(rawInput.warrantyNotes, "warrantyNotes", 1000),
    purchaseDate: optionalText(rawInput.purchaseDate, "purchaseDate", 80),
    usefulLifeMonths: optionalNumber(rawInput.usefulLifeMonths, "usefulLifeMonths"),
    nextServiceDate: optionalText(rawInput.nextServiceDate, "nextServiceDate", 80),
    lifecycleNotes: optionalText(rawInput.lifecycleNotes, "lifecycleNotes", 1000),
    notes: optionalText(rawInput.notes, "notes", 4000),
    searchText: optionalText(rawInput.searchText, "searchText", 4000),
    pendingScanReview: optionalBoolean(rawInput.pendingScanReview, "pendingScanReview"),
    scanSource: optionalText(rawInput.scanSource, "scanSource", 120),
    lowStock: optionalBoolean(rawInput.lowStock, "lowStock"),
  };
}

function isDeletedInventory(data: Record<string, unknown>): boolean {
  return data.isDeleted === true || data.deleted === true;
}

function identityFrom(data: Record<string, unknown>): IdentityInput {
  return {
    barcode: text(data.barcode),
    serial: text(data.serial) || text(data.serialNumber),
    lotNumber: text(data.lotNumber),
    sku: text(data.sku),
    manufacturerItemId: text(data.manufacturerItemId),
    locationName: text(data.locationName) || "Main Location",
    binLocation: text(data.binLocation),
  };
}

function identityFromInput(input: ManualInventoryMetadataUpdateInput, existing: Record<string, unknown>): IdentityInput {
  return {
    barcode: input.barcode ?? "",
    serial: input.serial ?? "",
    lotNumber: input.lotNumber ?? "",
    sku: input.sku ?? "",
    manufacturerItemId: input.manufacturerItemId ?? "",
    locationName: text(existing.locationName) || "Main Location",
    binLocation: text(existing.binLocation),
  };
}

function identityLockDocId(lockKey: string): string {
  const id = encodeURIComponent(lockKey);
  if (!id || id.length > 1200 || id.includes("/")) {
    throw new HttpsError("invalid-argument", "Inventory identity is too long.");
  }
  return id;
}

function identityLockKeys(identity: IdentityInput): string[] {
  const location = key(identity.locationName || "Main Location");
  const bin = key(identity.binLocation);
  const keys: string[] = [];

  if (identity.serial) {
    const serialKey = key(identity.serial);
    keys.push(`serial:${serialKey}`, `serialNumber:${serialKey}`);
  }
  if (identity.barcode) keys.push(`barcode:${key(identity.barcode)}`);
  if (identity.barcode && identity.lotNumber) {
    keys.push(`barcode_lot:${key(identity.barcode)}:${key(identity.lotNumber)}`);
  }
  if (identity.lotNumber) keys.push(`lotNumber:${key(identity.lotNumber)}`);
  if (identity.sku) keys.push(`sku_location:${key(identity.sku)}:${location}:${bin}`);
  if (identity.manufacturerItemId) {
    keys.push(`manufacturerItemId_location:${key(identity.manufacturerItemId)}:${location}:${bin}`);
  }

  return Array.from(new Set(keys.filter(Boolean))).sort();
}

function requestFingerprint(input: ManualInventoryMetadataUpdateInput, actor: MovementActor): string {
  return JSON.stringify({
    actorUid: actor.uid,
    operationId: input.operationId,
    inventoryItemId: input.inventoryItemId,
    productId: input.productId ?? "",
    name: input.name,
    category: input.category,
    manufacturer: input.manufacturer ?? "",
    manufacturerItemId: input.manufacturerItemId ?? "",
    sku: input.sku ?? "",
    hcpc: input.hcpc ?? "",
    barcode: input.barcode ?? "",
    serial: input.serial ?? "",
    lotNumber: input.lotNumber ?? "",
    reorderLevel: input.reorderLevel ?? 0,
    unitCost: input.unitCost ?? 0,
    modelNumber: input.modelNumber ?? "",
    warrantyProvider: input.warrantyProvider ?? "",
    warrantyStartDate: input.warrantyStartDate ?? "",
    warrantyEndDate: input.warrantyEndDate ?? "",
    warrantyNotes: input.warrantyNotes ?? "",
    purchaseDate: input.purchaseDate ?? "",
    usefulLifeMonths: input.usefulLifeMonths ?? 0,
    nextServiceDate: input.nextServiceDate ?? "",
    lifecycleNotes: input.lifecycleNotes ?? "",
    notes: input.notes ?? "",
    searchText: input.searchText ?? "",
    pendingScanReview: input.pendingScanReview ?? false,
    scanSource: input.scanSource ?? "",
    lowStock: input.lowStock ?? false,
  });
}

function storedResultFromOperation(data: Record<string, unknown>): ManualInventoryMetadataUpdateResult | null {
  const stored = data.manualInventoryMetadataUpdateResult;
  if (!stored || typeof stored !== "object") return null;
  const result = stored as Record<string, unknown>;
  const status = text(result.status);
  const inventoryItemId = text(result.inventoryItemId);
  if (status === "success" && inventoryItemId) {
    return {
      status: "duplicate_operation",
      inventoryItemId,
    };
  }
  return null;
}

function buildMetadataUpdate(input: ManualInventoryMetadataUpdateInput): Record<string, unknown> {
  return {
    productId: input.productId ?? "",
    name: input.name,
    category: input.category,
    manufacturer: input.manufacturer ?? "",
    manufacturerItemId: input.manufacturerItemId ?? "",
    sku: input.sku ?? "",
    hcpc: input.hcpc ?? "",
    barcode: input.barcode ?? "",
    serial: input.serial ?? "",
    lotNumber: input.lotNumber ?? "",
    reorderLevel: input.reorderLevel ?? 0,
    unitCost: input.unitCost ?? 0,
    modelNumber: input.modelNumber ?? "",
    warrantyProvider: input.warrantyProvider ?? "",
    warrantyStartDate: input.warrantyStartDate ?? "",
    warrantyEndDate: input.warrantyEndDate ?? "",
    warrantyNotes: input.warrantyNotes ?? "",
    purchaseDate: input.purchaseDate ?? "",
    usefulLifeMonths: input.usefulLifeMonths ?? 0,
    nextServiceDate: input.nextServiceDate ?? "",
    lifecycleNotes: input.lifecycleNotes ?? "",
    notes: input.notes ?? "",
    searchText: input.searchText ?? "",
    pendingScanReview: input.pendingScanReview ?? false,
    scanSource: input.scanSource ?? "",
    lowStock: input.lowStock ?? false,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

async function activeIdentityMatches(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  identity: IdentityInput;
  inventoryItemId: string;
}): Promise<string[]> {
  const candidateIds = new Set<string>();
  const addMatches = async (
    field: string,
    value: string,
    filter: (data: Record<string, unknown>) => boolean = () => true,
  ) => {
    if (!value) return;
    const snap = await params.transaction.get(
      params.database.collection(INVENTORY_COLLECTION).where(field, "==", value).limit(10),
    );
    for (const docSnap of snap.docs) {
      if (docSnap.id === params.inventoryItemId) continue;
      const data = docSnap.data() as Record<string, unknown>;
      if (isDeletedInventory(data) || !filter(data)) continue;
      candidateIds.add(docSnap.id);
    }
  };

  await addMatches("serial", params.identity.serial);
  await addMatches("serialNumber", params.identity.serial);
  await addMatches("barcode", params.identity.barcode);
  if (params.identity.barcode && params.identity.lotNumber) {
    await addMatches(
      "barcode",
      params.identity.barcode,
      (data) => key(data.lotNumber) === key(params.identity.lotNumber),
    );
  } else {
    await addMatches("lotNumber", params.identity.lotNumber);
  }
  await addMatches(
    "sku",
    params.identity.sku,
    (data) =>
      key(data.locationName || "Main Location") === key(params.identity.locationName || "Main Location") &&
      key(data.binLocation) === key(params.identity.binLocation),
  );
  await addMatches(
    "manufacturerItemId",
    params.identity.manufacturerItemId,
    (data) =>
      key(data.locationName || "Main Location") === key(params.identity.locationName || "Main Location") &&
      key(data.binLocation) === key(params.identity.binLocation),
  );

  return Array.from(candidateIds).sort();
}

async function lockConflicts(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  newLockKeys: string[];
  inventoryItemId: string;
  lockOwners: Map<string, string>;
}): Promise<string[]> {
  const conflicts = new Set<string>();
  for (const lockKey of params.newLockKeys) {
    const lockedInventoryItemId = params.lockOwners.get(lockKey) ?? "";
    if (!lockedInventoryItemId || lockedInventoryItemId === params.inventoryItemId) continue;
    assertSafeDocId(lockedInventoryItemId, "inventoryItemId");
    const lockedItemSnap = await params.transaction.get(
      params.database.collection(INVENTORY_COLLECTION).doc(lockedInventoryItemId),
    );
    if (!lockedItemSnap.exists || isDeletedInventory(lockedItemSnap.data() as Record<string, unknown>)) continue;
    conflicts.add(lockedInventoryItemId);
  }
  return Array.from(conflicts).sort();
}

async function readLockOwners(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  lockKeys: string[];
}): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  for (const lockKey of params.lockKeys) {
    const lockRef = params.database.collection(IDENTITY_LOCK_COLLECTION).doc(identityLockDocId(lockKey));
    const lockSnap = await params.transaction.get(lockRef);
    owners.set(lockKey, text(lockSnap.data()?.inventoryItemId));
  }
  return owners;
}

function writeIdentityLocks(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  oldLockKeys: string[];
  newLockKeys: string[];
  inventoryItemId: string;
  actor: MovementActor;
  lockOwners: Map<string, string>;
}): void {
  const oldKeys = new Set(params.oldLockKeys);
  const newKeys = new Set(params.newLockKeys);

  for (const lockKey of oldKeys) {
    if (newKeys.has(lockKey)) continue;
    if (params.lockOwners.get(lockKey) !== params.inventoryItemId) continue;
    const ref = params.database.collection(IDENTITY_LOCK_COLLECTION).doc(identityLockDocId(lockKey));
    params.transaction.delete(ref);
  }

  for (const lockKey of newKeys) {
    const ref = params.database.collection(IDENTITY_LOCK_COLLECTION).doc(identityLockDocId(lockKey));
    params.transaction.set(
      ref,
      {
        inventoryItemId: params.inventoryItemId,
        identityKey: lockKey,
        lockType: "manual_inventory_metadata_update",
        actorUid: params.actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function manualInventoryMetadataUpdate(
  rawInput: ManualInventoryMetadataUpdateInput,
  actor: MovementActor,
  database: Firestore = getFirestore(),
): Promise<ManualInventoryMetadataUpdateResult> {
  if (!rawInput || typeof rawInput !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }

  const input = normalizeInput(rawInput);
  assertOperationId(input.operationId);
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  if (input.productId) assertSafeDocId(input.productId, "productId");

  return database.runTransaction(async (transaction) => {
    const operationRef = database.collection(OPERATIONS_COLLECTION).doc(`${actor.uid}_${input.operationId}`);
    const operationSnap = await transaction.get(operationRef);
    const fingerprint = requestFingerprint(input, actor);

    if (operationSnap.exists) {
      const operation = operationSnap.data() as Record<string, unknown>;
      if (text(operation.manualInventoryMetadataUpdateFingerprint) && operation.manualInventoryMetadataUpdateFingerprint !== fingerprint) {
        throw new HttpsError(
          "failed-precondition",
          "This operationId was already used with different request data.",
        );
      }

      const stored = storedResultFromOperation(operation);
      if (stored) return stored;
      throw new HttpsError("failed-precondition", "This operationId has already been processed.");
    }

    const itemRef = database.collection(INVENTORY_COLLECTION).doc(input.inventoryItemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists || isDeletedInventory(itemSnap.data() as Record<string, unknown>)) {
      throw new HttpsError("not-found", "Inventory item was not found.");
    }

    const existing = itemSnap.data() as Record<string, unknown>;
    const oldLockKeys = identityLockKeys(identityFrom(existing));
    const newIdentity = identityFromInput(input, existing);
    const newLockKeys = identityLockKeys(newIdentity);
    const lockOwners = await readLockOwners({
      transaction,
      database,
      lockKeys: Array.from(new Set([...oldLockKeys, ...newLockKeys])).sort(),
    });

    const conflicts = [
      ...(await activeIdentityMatches({
        transaction,
        database,
        identity: newIdentity,
        inventoryItemId: input.inventoryItemId,
      })),
      ...(await lockConflicts({
        transaction,
        database,
        newLockKeys,
        inventoryItemId: input.inventoryItemId,
        lockOwners,
      })),
    ];

    if (conflicts.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        `Inventory identity matches existing active inventory records: ${Array.from(new Set(conflicts)).join(", ")}.`,
      );
    }

    const result: ManualInventoryMetadataUpdateResult = {
      status: "success",
      inventoryItemId: input.inventoryItemId,
    };

    const metadataUpdate = buildMetadataUpdate(input);
    assertMetadataOnlyInventoryWrite(metadataUpdate, "manualInventoryMetadataUpdate");
    transaction.set(itemRef, metadataUpdate, { merge: true });
    writeIdentityLocks({
      transaction,
      database,
      oldLockKeys,
      newLockKeys,
      inventoryItemId: input.inventoryItemId,
      actor,
      lockOwners,
    });

    transaction.set(
      operationRef,
      {
        operationId: input.operationId,
        operationType: "manual_inventory_metadata_update",
        status: "completed",
        actorUid: actor.uid,
        actorEmail: actor.email,
        manualInventoryMetadataUpdateFingerprint: fingerprint,
        manualInventoryMetadataUpdateResult: result,
        targetId: input.inventoryItemId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return result;
  });
}

export const manualInventoryMetadataUpdateCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);
    return manualInventoryMetadataUpdate(
      request.data as ManualInventoryMetadataUpdateInput,
      actor,
      getFirestore(),
    );
  },
);
