import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { resolveInventoryScan } from "./inventoryScanResolver.js";
import { type MovementActor, normalizeScanValue } from "./movementService.js";
import { requireStaffOrAdmin } from "./auth.js";
import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { assertOperationId, assertSafeDocId, text } from "../domainWorkflows/shared.js";
import type {
  ManualInventoryUpsertInput,
  ManualInventoryUpsertMatch,
  ManualInventoryUpsertResult,
} from "./types.js";

const INVENTORY_COLLECTION = "inventory";
const OPERATIONS_COLLECTION = "inventoryOperations";
const IDENTITY_LOCK_COLLECTION = "inventoryIdentityLocks";
const MAX_TEXT_LENGTH = 500;

type Candidate = {
  id: string;
  data: Record<string, unknown>;
  matchedBy: Set<string>;
};

type IdentityLock = {
  key: string;
  ref: FirebaseFirestore.DocumentReference;
  inventoryItemId: string;
  data: Record<string, unknown>;
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

function normalizeBarcodeInput(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const parsed = normalizeScanValue(raw);
  if (parsed.status === "invalid") {
    throw new HttpsError("invalid-argument", parsed.error ?? "Invalid barcode.");
  }
  return parsed.value;
}

function normalizeInput(input: ManualInventoryUpsertInput): ManualInventoryUpsertInput {
  return {
    operationId: requiredText(input.operationId, "operationId", 160),
    inventoryItemId: optionalText(input.inventoryItemId, "inventoryItemId", 160),
    productId: optionalText(input.productId, "productId", 160),
    name: requiredText(input.name, "name"),
    category: requiredText(input.category, "category"),
    manufacturer: optionalText(input.manufacturer, "manufacturer"),
    manufacturerItemId: optionalText(input.manufacturerItemId, "manufacturerItemId", 160),
    sku: optionalText(input.sku, "sku", 160),
    hcpc: optionalText(input.hcpc, "hcpc", 80).toUpperCase(),
    barcode: normalizeBarcodeInput(input.barcode),
    serial: optionalText(input.serial, "serial", 160),
    lotNumber: optionalText(input.lotNumber, "lotNumber", 160),
    expirationDate: optionalText(input.expirationDate, "expirationDate", 80),
    locationName: optionalText(input.locationName, "locationName") || "Main Location",
    binLocation: optionalText(input.binLocation, "binLocation"),
    reorderLevel: optionalNumber(input.reorderLevel, "reorderLevel"),
    unitCost: optionalNumber(input.unitCost, "unitCost"),
    notes: optionalText(input.notes, "notes", 4000),
    source: optionalText(input.source, "source", 120),
    sourceId: optionalText(input.sourceId, "sourceId", 160),
  };
}

function buildSearchText(input: ManualInventoryUpsertInput): string {
  return [
    input.name,
    input.category,
    input.manufacturer,
    input.manufacturerItemId,
    input.sku,
    input.hcpc,
    input.barcode,
    input.serial,
    input.lotNumber,
    input.expirationDate,
    input.locationName,
    input.binLocation,
    input.notes,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function requestFingerprint(input: ManualInventoryUpsertInput, actor: MovementActor): string {
  return JSON.stringify({
    actorUid: actor.uid,
    operationId: input.operationId,
    inventoryItemId: input.inventoryItemId ?? "",
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
    expirationDate: input.expirationDate ?? "",
    locationName: input.locationName ?? "",
    binLocation: input.binLocation ?? "",
    reorderLevel: input.reorderLevel ?? 0,
    unitCost: input.unitCost ?? 0,
    notes: input.notes ?? "",
    source: input.source ?? "",
    sourceId: input.sourceId ?? "",
  });
}

function isDeletedInventory(data: Record<string, unknown>): boolean {
  return data.isDeleted === true || data.deleted === true;
}

function isSameLocation(candidate: Record<string, unknown>, input: ManualInventoryUpsertInput): boolean {
  return (
    key(candidate.locationName || "Main Location") === key(input.locationName || "Main Location") &&
    key(candidate.binLocation) === key(input.binLocation)
  );
}

function toMatch(candidate: Candidate): ManualInventoryUpsertMatch {
  return {
    inventoryItemId: candidate.id,
    matchedBy: Array.from(candidate.matchedBy).sort(),
    name: text(candidate.data.name),
    barcode: text(candidate.data.barcode),
    serial: text(candidate.data.serial) || text(candidate.data.serialNumber),
    lotNumber: text(candidate.data.lotNumber),
    sku: text(candidate.data.sku),
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function addCandidate(
  candidates: Map<string, Candidate>,
  id: string,
  data: Record<string, unknown>,
  matchedBy: string,
): void {
  if (isDeletedInventory(data)) return;

  const existing = candidates.get(id);
  if (existing) {
    existing.matchedBy.add(matchedBy);
    return;
  }

  candidates.set(id, {
    id,
    data,
    matchedBy: new Set([matchedBy]),
  });
}

function identityLockDocId(lockKey: string): string {
  const id = encodeURIComponent(lockKey);
  if (!id || id.length > 1200 || id.includes("/")) {
    throw new HttpsError("invalid-argument", "Inventory identity is too long.");
  }
  return id;
}

function identityLockKeys(input: ManualInventoryUpsertInput): string[] {
  const location = key(input.locationName || "Main Location");
  const bin = key(input.binLocation);
  const keys: string[] = [];

  if (input.serial) {
    const serialKey = key(input.serial);
    keys.push(`serial:${serialKey}`, `serialNumber:${serialKey}`);
  }
  if (input.barcode) keys.push(`barcode:${key(input.barcode)}`);
  if (input.barcode && input.lotNumber) {
    keys.push(`barcode_lot:${key(input.barcode)}:${key(input.lotNumber)}`);
  }
  if (input.lotNumber) keys.push(`lotNumber:${key(input.lotNumber)}`);
  if (input.sku) keys.push(`sku_location:${key(input.sku)}:${location}:${bin}`);
  if (input.manufacturerItemId) {
    keys.push(`manufacturerItemId_location:${key(input.manufacturerItemId)}:${location}:${bin}`);
  }

  return unique(keys);
}

async function addQueryCandidates(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  candidates: Map<string, Candidate>;
  field: string;
  value: string;
  matchedBy: string;
  filter?: (data: Record<string, unknown>) => boolean;
}): Promise<void> {
  if (!params.value) return;

  const snap = await params.transaction.get(
    params.database
      .collection(INVENTORY_COLLECTION)
      .where(params.field, "==", params.value)
      .limit(10),
  );

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    if (params.filter && !params.filter(data)) continue;
    addCandidate(params.candidates, docSnap.id, data, params.matchedBy);
  }
}

async function resolveManualInventoryTarget(
  transaction: FirebaseFirestore.Transaction,
  database: Firestore,
  input: ManualInventoryUpsertInput,
): Promise<{ status: "none" } | { status: "found"; candidate: Candidate } | { status: "ambiguous"; matches: ManualInventoryUpsertMatch[] }> {
  const candidates = new Map<string, Candidate>();

  if (input.inventoryItemId) {
    assertSafeDocId(input.inventoryItemId, "inventoryItemId");
    const snap = await transaction.get(database.collection(INVENTORY_COLLECTION).doc(input.inventoryItemId));
    if (snap.exists) {
      addCandidate(candidates, snap.id, snap.data() as Record<string, unknown>, "inventoryItemId");
    }
  }

  if (input.serial) {
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "serial",
      value: input.serial,
      matchedBy: "serial",
    });
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "serialNumber",
      value: input.serial,
      matchedBy: "serialNumber",
    });
  }

  if (input.barcode) {
    const resolved = await resolveInventoryScan(database, input.barcode, {
      fields: ["barcode"],
      includeUppercaseVariant: false,
      transaction,
    });

    if (resolved.kind === "resolved") {
      addCandidate(candidates, resolved.inventoryItemId, resolved.inventory, "barcode");
    }

    if (resolved.kind === "ambiguous") {
      for (const candidate of resolved.candidates) {
        addCandidate(candidates, candidate.id, candidate.data, "barcode");
      }
    }
  }

  if (input.barcode && input.lotNumber) {
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "barcode",
      value: input.barcode,
      matchedBy: "barcode_lot",
      filter: (data) => key(data.lotNumber) === key(input.lotNumber),
    });
  } else if (input.lotNumber) {
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "lotNumber",
      value: input.lotNumber,
      matchedBy: "lotNumber",
    });
  }

  if (input.sku) {
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "sku",
      value: input.sku,
      matchedBy: "sku_location",
      filter: (data) => isSameLocation(data, input),
    });
  }

  if (input.manufacturerItemId) {
    await addQueryCandidates({
      transaction,
      database,
      candidates,
      field: "manufacturerItemId",
      value: input.manufacturerItemId,
      matchedBy: "manufacturerItemId_location",
      filter: (data) => isSameLocation(data, input),
    });
  }

  const matches = Array.from(candidates.values());
  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches: matches.map(toMatch),
    };
  }

  return { status: "found", candidate: matches[0] };
}

async function readIdentityLocks(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  input: ManualInventoryUpsertInput;
}): Promise<IdentityLock[]> {
  const locks: IdentityLock[] = [];
  for (const lockKey of identityLockKeys(params.input)) {
    const ref = params.database
      .collection(IDENTITY_LOCK_COLLECTION)
      .doc(identityLockDocId(lockKey));
    const snap = await params.transaction.get(ref);
    const inventoryItemId = text(snap.data()?.inventoryItemId);
    if (!inventoryItemId) {
      locks.push({ key: lockKey, ref, inventoryItemId: "", data: {} });
      continue;
    }

    assertSafeDocId(inventoryItemId, "inventoryItemId");
    locks.push({
      key: lockKey,
      ref,
      inventoryItemId,
      data: snap.data() as Record<string, unknown>,
    });
  }
  return locks;
}

async function resolveLockCandidates(params: {
  transaction: FirebaseFirestore.Transaction;
  database: Firestore;
  locks: IdentityLock[];
}): Promise<Candidate[]> {
  const candidates = new Map<string, Candidate>();

  for (const lock of params.locks) {
    if (!lock.inventoryItemId) continue;
    const itemRef = params.database.collection(INVENTORY_COLLECTION).doc(lock.inventoryItemId);
    const snap = await params.transaction.get(itemRef);
    if (!snap.exists) continue;
    addCandidate(
      candidates,
      snap.id,
      snap.data() as Record<string, unknown>,
      `identityLock:${lock.key}`,
    );
  }

  return Array.from(candidates.values());
}

function reconcileTargetWithLocks(params: {
  target: Awaited<ReturnType<typeof resolveManualInventoryTarget>>;
  lockCandidates: Candidate[];
}): Awaited<ReturnType<typeof resolveManualInventoryTarget>> {
  if (params.target.status === "ambiguous") return params.target;

  const candidates = new Map<string, Candidate>();
  if (params.target.status === "found") {
    candidates.set(params.target.candidate.id, params.target.candidate);
  }

  for (const candidate of params.lockCandidates) {
    const existing = candidates.get(candidate.id);
    if (existing) {
      for (const matchedBy of candidate.matchedBy) existing.matchedBy.add(matchedBy);
    } else {
      candidates.set(candidate.id, candidate);
    }
  }

  const matches = Array.from(candidates.values());
  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches: matches.map(toMatch),
    };
  }

  return { status: "found", candidate: matches[0] };
}

function buildCreateData(input: ManualInventoryUpsertInput): Record<string, unknown> {
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
    expirationDate: input.expirationDate ?? "",
    locationName: input.locationName ?? "Main Location",
    binLocation: input.binLocation ?? "",
    quantityOnHand: 0,
    committed: 0,
    onRent: 0,
    onOrder: 0,
    available: 0,
    reorderLevel: input.reorderLevel ?? 0,
    unitCost: input.unitCost ?? 0,
    totalValue: 0,
    status: "available",
    source: input.source ?? "",
    sourceId: input.sourceId ?? "",
    lifecycleStatus: "active",
    notes: input.notes ?? "",
    searchText: buildSearchText(input),
    isDeleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function preferString(newValue: unknown, existing: unknown): string {
  const next = clean(newValue);
  if (next) return next;
  return text(existing);
}

function buildMergeData(input: ManualInventoryUpsertInput, existing: Record<string, unknown>): Record<string, unknown> {
  return {
    productId: preferString(input.productId, existing.productId),
    name: input.name,
    category: input.category,
    manufacturer: preferString(input.manufacturer, existing.manufacturer),
    manufacturerItemId: preferString(input.manufacturerItemId, existing.manufacturerItemId),
    sku: preferString(input.sku, existing.sku),
    hcpc: preferString(input.hcpc, existing.hcpc).toUpperCase(),
    barcode: preferString(input.barcode, existing.barcode),
    serial: preferString(input.serial, existing.serial || existing.serialNumber),
    lotNumber: preferString(input.lotNumber, existing.lotNumber),
    expirationDate: preferString(input.expirationDate, existing.expirationDate),
    locationName: input.locationName ?? "Main Location",
    binLocation: preferString(input.binLocation, existing.binLocation),
    reorderLevel: input.reorderLevel ?? (typeof existing.reorderLevel === "number" ? existing.reorderLevel : 0),
    unitCost: input.unitCost ?? (typeof existing.unitCost === "number" ? existing.unitCost : 0),
    notes: input.notes || text(existing.notes) || "Updated by manual inventory upsert.",
    searchText: buildSearchText({
      ...input,
      productId: preferString(input.productId, existing.productId),
      manufacturer: preferString(input.manufacturer, existing.manufacturer),
      manufacturerItemId: preferString(input.manufacturerItemId, existing.manufacturerItemId),
      sku: preferString(input.sku, existing.sku),
      hcpc: preferString(input.hcpc, existing.hcpc).toUpperCase(),
      barcode: preferString(input.barcode, existing.barcode),
      serial: preferString(input.serial, existing.serial || existing.serialNumber),
      lotNumber: preferString(input.lotNumber, existing.lotNumber),
      expirationDate: preferString(input.expirationDate, existing.expirationDate),
      binLocation: preferString(input.binLocation, existing.binLocation),
      notes: input.notes || text(existing.notes) || "Updated by manual inventory upsert.",
    }),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function stableCreateDocId(input: ManualInventoryUpsertInput): string | null {
  const location = encodeURIComponent(key(input.locationName || "Main Location"));
  const bin = encodeURIComponent(key(input.binLocation));
  if (input.serial) return `manual-serial-${encodeURIComponent(input.serial)}`;
  if (input.barcode && input.lotNumber) {
    return `manual-barcode-lot-${encodeURIComponent(input.barcode)}-${encodeURIComponent(input.lotNumber)}`;
  }
  if (input.barcode) return `manual-barcode-${encodeURIComponent(input.barcode)}`;
  if (input.lotNumber) return `manual-lot-${encodeURIComponent(input.lotNumber)}`;
  if (input.sku) return `manual-sku-${encodeURIComponent(input.sku)}-${location}-${bin}`;
  if (input.manufacturerItemId) {
    return `manual-mfg-${encodeURIComponent(input.manufacturerItemId)}-${location}-${bin}`;
  }
  return null;
}

function writeIdentityLocks(params: {
  transaction: FirebaseFirestore.Transaction;
  locks: IdentityLock[];
  inventoryItemId: string;
  actor: MovementActor;
}): void {
  for (const lock of params.locks) {
    params.transaction.set(
      lock.ref,
      {
        inventoryItemId: params.inventoryItemId,
        identityKey: lock.key,
        lockType: "manual_inventory_upsert",
        actorUid: params.actor.uid,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: lock.data.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

function storedResultFromOperation(data: Record<string, unknown>): ManualInventoryUpsertResult | null {
  const stored = data.manualInventoryUpsertResult;
  if (!stored || typeof stored !== "object") return null;
  const result = stored as Record<string, unknown>;
  const status = text(result.status);
  const inventoryItemId = text(result.inventoryItemId);
  if ((status === "created" || status === "merged") && inventoryItemId) {
    return {
      status: "duplicate_operation",
      action: status,
      inventoryItemId,
    };
  }
  if (status === "ambiguous" && Array.isArray(result.matches)) {
    return {
      status: "ambiguous",
      matches: result.matches as ManualInventoryUpsertMatch[],
    };
  }
  return null;
}

export async function manualInventoryUpsert(
  rawInput: ManualInventoryUpsertInput,
  actor: MovementActor,
  database: Firestore = getFirestore(),
): Promise<ManualInventoryUpsertResult> {
  if (!rawInput || typeof rawInput !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }

  const input = normalizeInput(rawInput);
  assertOperationId(input.operationId);
  if (input.inventoryItemId) assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  if (input.productId) assertSafeDocId(input.productId, "productId");

  return database.runTransaction(async (transaction) => {
    const operationRef = database.collection(OPERATIONS_COLLECTION).doc(`${actor.uid}_${input.operationId}`);
    const operationSnap = await transaction.get(operationRef);
    const fingerprint = requestFingerprint(input, actor);

    if (operationSnap.exists) {
      const operation = operationSnap.data() as Record<string, unknown>;
      if (text(operation.manualInventoryUpsertFingerprint) && operation.manualInventoryUpsertFingerprint !== fingerprint) {
        throw new HttpsError(
          "failed-precondition",
          "This operationId was already used with different request data.",
        );
      }

      const stored = storedResultFromOperation(operation);
      if (stored) return stored;

      throw new HttpsError("failed-precondition", "This operationId has already been processed.");
    }

    const targetFromQueries = await resolveManualInventoryTarget(transaction, database, input);
    const identityLocks = await readIdentityLocks({ transaction, database, input });
    const lockCandidates = await resolveLockCandidates({
      transaction,
      database,
      locks: identityLocks,
    });
    const target = reconcileTargetWithLocks({
      target: targetFromQueries,
      lockCandidates,
    });

    if (target.status === "ambiguous") {
      const result: ManualInventoryUpsertResult = {
        status: "ambiguous",
        matches: target.matches,
      };
      transaction.set(
        operationRef,
        {
          operationId: input.operationId,
          operationType: "manual_inventory_upsert",
          status: "completed",
          actorUid: actor.uid,
          actorEmail: actor.email,
          manualInventoryUpsertFingerprint: fingerprint,
          manualInventoryUpsertResult: result,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return result;
    }

    let result: Extract<ManualInventoryUpsertResult, { status: "created" | "merged" }>;

    if (target.status === "found") {
      const itemRef = database.collection(INVENTORY_COLLECTION).doc(target.candidate.id);
      transaction.set(itemRef, buildMergeData(input, target.candidate.data), { merge: true });
      result = {
        status: "merged",
        inventoryItemId: target.candidate.id,
      };
    } else {
      const stableId = stableCreateDocId(input);
      const itemRef = stableId
        ? database.collection(INVENTORY_COLLECTION).doc(stableId)
        : database.collection(INVENTORY_COLLECTION).doc();
      const stableSnap = stableId ? await transaction.get(itemRef) : null;

      if (stableSnap?.exists && !isDeletedInventory(stableSnap.data() as Record<string, unknown>)) {
        transaction.set(
          itemRef,
          buildMergeData(input, stableSnap.data() as Record<string, unknown>),
          { merge: true },
        );
        result = {
          status: "merged",
          inventoryItemId: itemRef.id,
        };
      } else {
        transaction.set(itemRef, buildCreateData(input));
        result = {
          status: "created",
          inventoryItemId: itemRef.id,
        };
      }
    }

    writeIdentityLocks({
      transaction,
      locks: identityLocks,
      inventoryItemId: result.inventoryItemId,
      actor,
    });

    transaction.set(
      operationRef,
      {
        operationId: input.operationId,
        operationType: "manual_inventory_upsert",
        status: "completed",
        actorUid: actor.uid,
        actorEmail: actor.email,
        manualInventoryUpsertFingerprint: fingerprint,
        manualInventoryUpsertResult: result,
        targetId: result.inventoryItemId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return result;
  });
}

export const manualInventoryUpsertCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);
    return manualInventoryUpsert(request.data as ManualInventoryUpsertInput, actor, getFirestore());
  },
);
