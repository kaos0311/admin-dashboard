import {
  FieldValue,
  type Firestore,
  getFirestore,
  Timestamp,
  type Transaction,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";

export type InventoryMovementType =
  | "receive"
  | "manual_adjustment"
  | "patient_assignment"
  | "patient_transfer"
  | "rental_checkout"
  | "rental_return"
  | "warehouse_transfer"
  | "delivery_load"
  | "delivery_delivered"
  | "delivery_returned"
  | "damaged"
  | "lost"
  | "found"
  | "discontinued"
  | "archived"
  | "restored"
  | "deceased_patient_equipment_return"
  | "hard_delete"
  | "reversal";

export type MovementSource =
  | "inventory_page"
  | "scanner"
  | "rental"
  | "patient"
  | "delivery_fulfillment"
  | "deceased_pickup"
  | "reconciliation"
  | "system";

export type MovementActor = {
  uid: string;
  email: string;
  role: string;
};

export type CreateMovementInput = {
  operationId: string;
  movementType: InventoryMovementType;
  inventoryItemId?: string;
  productId?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  quantityDelta?: number;
  fromLocation?: string;
  toLocation?: string;
  patientId?: string;
  patientName?: string;
  rentalId?: string;
  reason?: string;
  source?: MovementSource;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type MovementResultStatus =
  | "success"
  | "duplicate_operation"
  | "not_found"
  | "ambiguous"
  | "invalid"
  | "permission_denied";

export type MovementResult = {
  status: MovementResultStatus;
  movementId?: string;
  operationId: string;
  inventoryItemId?: string;
  productId?: string;
  quantityBefore?: number;
  quantityDelta?: number;
  quantityAfter?: number;
  message?: string;
  matches?: Array<{
    inventoryItemId: string;
    productId: string;
    name: string;
    barcode: string;
    serialNumber: string;
    lotNumber: string;
  }>;
};

type InventoryDoc = Record<string, unknown>;
export type InventoryMovementWritePlan = {
  result: MovementResult;
  apply: () => void;
};

const MAX_SCAN_LENGTH = 128;
const OPERATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,160}$/;
const SAFE_DOC_ID_PATTERN = /^[^/.][^/]{0,159}$/;
const URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const ADMIN_ONLY_MOVEMENTS = new Set<InventoryMovementType>([
  "hard_delete",
  "reversal",
]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(
  data: InventoryDoc,
  field: string,
  fallback = 0
): number {
  const value = data[field];
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new HttpsError(
    "failed-precondition",
    `Inventory field ${field} must be a finite number.`
  );
}

function readBoolean(data: InventoryDoc, field: string): boolean {
  return data[field] === true;
}

function assertOperationId(operationId: string): void {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new HttpsError("invalid-argument", "Invalid operationId.");
  }
}

function assertSafeDocId(value: string, label: string): void {
  if (!SAFE_DOC_ID_PATTERN.test(value) || value === "." || value === "..") {
    throw new HttpsError("invalid-argument", `${label} is not a safe document ID.`);
  }
}

function defaultFirestore(): Firestore {
  return getFirestore();
}

export function normalizeScanValue(rawValue: unknown): {
  status: "valid" | "invalid";
  value: string;
  rawValue: string;
  error?: string;
} {
  const raw = typeof rawValue === "string" ? rawValue : "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return { status: "invalid", value: "", rawValue: raw, error: "Scan is empty." };
  }

  if (URL_PATTERN.test(trimmed)) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "URL QR codes are not accepted for inventory movement.",
    };
  }

  let value = "";
  for (const char of trimmed) {
    if (char !== "\r" && char !== "\n" && char !== "\t" && char !== "\x00") {
      value += char;
    }
  }

  if (!value) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "Scan is empty after normalization.",
    };
  }

  if (value.length > MAX_SCAN_LENGTH) {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: `Scan exceeds ${MAX_SCAN_LENGTH} characters.`,
    };
  }

  if (value.includes("/") || value === "." || value === "..") {
    return {
      status: "invalid",
      value: "",
      rawValue: raw,
      error: "Scan contains path characters and cannot be used safely.",
    };
  }

  return { status: "valid", value, rawValue: raw };
}

function parsePositiveQuantity(input: CreateMovementInput): number {
  const raw = input.quantity ?? Math.abs(input.quantityDelta ?? 1);
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    throw new HttpsError("invalid-argument", "Quantity must be greater than zero.");
  }
  return raw;
}

function allowsFractionalUnits(inventory: InventoryDoc, product: InventoryDoc | null): boolean {
  return (
    readBoolean(inventory, "supportsFractionalUnits") ||
    readBoolean(inventory, "fractionalUnits") ||
    Boolean(product && (readBoolean(product, "supportsFractionalUnits") || readBoolean(product, "fractionalUnits")))
  );
}

function getMovementDeltas(
  movementType: InventoryMovementType,
  quantity: number,
  explicitDelta?: number
): { quantityDelta: number; onRentDelta: number; onTruckDelta: number } {
  if (movementType === "manual_adjustment") {
    if (typeof explicitDelta !== "number" || !Number.isFinite(explicitDelta)) {
      throw new HttpsError("invalid-argument", "Manual adjustment requires quantityDelta.");
    }
    return { quantityDelta: explicitDelta, onRentDelta: 0, onTruckDelta: 0 };
  }

  switch (movementType) {
    case "receive":
    case "found":
    case "restored":
      return { quantityDelta: quantity, onRentDelta: 0, onTruckDelta: 0 };
    case "lost":
    case "damaged":
      return { quantityDelta: -quantity, onRentDelta: 0, onTruckDelta: 0 };
    case "patient_assignment":
    case "rental_checkout":
      return { quantityDelta: 0, onRentDelta: quantity, onTruckDelta: 0 };
    case "patient_transfer":
      return { quantityDelta: 0, onRentDelta: 0, onTruckDelta: 0 };
    case "rental_return":
    case "deceased_patient_equipment_return":
      return { quantityDelta: 0, onRentDelta: -quantity, onTruckDelta: 0 };
    case "delivery_load":
      return { quantityDelta: 0, onRentDelta: 0, onTruckDelta: quantity };
    case "delivery_delivered":
      return { quantityDelta: 0, onRentDelta: quantity, onTruckDelta: -quantity };
    case "delivery_returned":
      return { quantityDelta: 0, onRentDelta: -quantity, onTruckDelta: 0 };
    case "warehouse_transfer":
    case "discontinued":
    case "archived":
    case "hard_delete":
      return { quantityDelta: 0, onRentDelta: 0, onTruckDelta: 0 };
    case "reversal":
      throw new HttpsError("invalid-argument", "Use reverseInventoryMovement for reversals.");
    default:
      return { quantityDelta: 0, onRentDelta: 0, onTruckDelta: 0 };
  }
}

function assertMovementAllowedForState(params: {
  movementType: InventoryMovementType;
  quantityDelta: number;
  onRentDelta: number;
  onTruckDelta: number;
  inventory: InventoryDoc;
  product: InventoryDoc | null;
  quantity: number;
}): void {
  const { movementType, quantityDelta, onRentDelta, onTruckDelta, inventory, product, quantity } = params;
  const productDeleted = product?.deleted === true || product?.isDeleted === true;
  const itemDeleted = inventory.isDeleted === true || inventory.deleted === true;
  const status = text(inventory.status).toLowerCase();
  const productStatus = text(product?.status).toLowerCase();

  if ((productDeleted || itemDeleted) && movementType !== "restored" && movementType !== "reversal") {
    throw new HttpsError("failed-precondition", "Archived or deleted inventory cannot receive normal movement.");
  }

  if (
    (status === "discontinued" || productStatus === "discontinued") &&
    ["receive", "patient_assignment", "rental_checkout", "delivery_load", "delivery_delivered", "found"].includes(movementType)
  ) {
    throw new HttpsError("failed-precondition", "Discontinued products may be returned but not newly issued.");
  }

  if (!allowsFractionalUnits(inventory, product) && !Number.isInteger(quantity)) {
    throw new HttpsError("invalid-argument", "Quantity must be an integer for this product.");
  }

  const quantityBefore = readNumber(inventory, "quantityOnHand", 0);
  const onRentBefore = readNumber(inventory, "onRent", 0);
  const onTruckBefore = readNumber(inventory, "onTruck", 0);
  const committedBefore = readNumber(inventory, "committed", 0);
  const availableAfter =
    quantityBefore + quantityDelta - committedBefore - (onRentBefore + onRentDelta) - (onTruckBefore + onTruckDelta);

  if (quantityBefore + quantityDelta < 0) {
    throw new HttpsError("failed-precondition", "Inventory quantity cannot fall below zero.");
  }

  if (availableAfter < 0) {
    throw new HttpsError("failed-precondition", "This movement would make available inventory negative.");
  }

  if (onRentBefore + onRentDelta < 0) {
    throw new HttpsError("failed-precondition", "Returned assets must currently be assigned or checked out.");
  }

  if (onTruckBefore + onTruckDelta < 0) {
    throw new HttpsError("failed-precondition", "This item is not loaded on a truck.");
  }

  const serialized =
    readBoolean(inventory, "isSerialized") ||
    readBoolean(inventory, "requiresSerialTracking") ||
    Boolean(text(inventory.serial) || text(inventory.serialNumber));

  if (
    serialized &&
    ["patient_assignment", "rental_checkout"].includes(movementType) &&
    (onRentBefore > 0 || ["rental_out", "assigned", "checked_out"].includes(status))
  ) {
    throw new HttpsError("failed-precondition", "Serialized assets cannot be checked out twice.");
  }
}

async function resolveInventoryForMovement(
  database: Firestore,
  input: CreateMovementInput
): Promise<
  | { status: "found"; id: string; data: InventoryDoc }
  | { status: "not_found" }
  | { status: "ambiguous"; matches: MovementResult["matches"] }
  | { status: "invalid"; message: string }
> {
  const directId = text(input.inventoryItemId);
  if (directId) {
    assertSafeDocId(directId, "inventoryItemId");
    const snap = await database.collection("inventory").doc(directId).get();
    if (!snap.exists) return { status: "not_found" };
    return { status: "found", id: snap.id, data: snap.data() as InventoryDoc };
  }

  const scan = normalizeScanValue(input.barcode ?? input.serialNumber ?? input.lotNumber);
  if (scan.status === "invalid") {
    return { status: "invalid", message: scan.error ?? "Invalid scan." };
  }

  const fields = [
    ["barcode", scan.value],
    ["serial", scan.value],
    ["serialNumber", scan.value],
    ["lotNumber", scan.value],
    ["sku", scan.value],
    ["manufacturerItemId", scan.value],
    ["productId", scan.value],
  ] as const;
  const matches = new Map<string, InventoryDoc>();

  for (const [field, value] of fields) {
    const snap = await database
      .collection("inventory")
      .where(field, "==", value)
      .where("isDeleted", "!=", true)
      .limit(10)
      .get();
    snap.docs.forEach((docSnap) => {
      matches.set(docSnap.id, docSnap.data() as InventoryDoc);
    });
  }

  if (matches.size === 0) return { status: "not_found" };
  if (matches.size > 1) {
    return {
      status: "ambiguous",
      matches: Array.from(matches.entries()).map(([id, data]) => ({
        inventoryItemId: id,
        productId: text(data.productId),
        name: text(data.name),
        barcode: text(data.barcode),
        serialNumber: text(data.serialNumber) || text(data.serial),
        lotNumber: text(data.lotNumber),
      })),
    };
  }

  const [id, data] = Array.from(matches.entries())[0];
  return { status: "found", id, data };
}

function movementFingerprint(input: CreateMovementInput, actor: MovementActor): string {
  return JSON.stringify({
    actorUid: actor.uid,
    movementType: input.movementType,
    inventoryItemId: text(input.inventoryItemId),
    productId: text(input.productId),
    barcode: text(input.barcode),
    serialNumber: text(input.serialNumber),
    lotNumber: text(input.lotNumber),
    quantity: input.quantity ?? null,
    quantityDelta: input.quantityDelta ?? null,
    fromLocation: text(input.fromLocation),
    toLocation: text(input.toLocation),
    patientId: text(input.patientId),
    rentalId: text(input.rentalId),
    reason: text(input.reason),
    source: input.source ?? "system",
  });
}

function archiveCurrentEquipment(
  value: unknown,
  inventory: InventoryDoc,
  archivedAt: string,
  reason: string
): unknown[] | null {
  if (!Array.isArray(value)) return null;

  const inventoryId = text(inventory.id);
  const serial = text(inventory.serial) || text(inventory.serialNumber);
  const lotNumber = text(inventory.lotNumber);
  const productId = text(inventory.productId);
  let matched = false;

  const next = value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row = item as Record<string, unknown>;
    const isMatch =
      text(row.inventoryId) === inventoryId ||
      (serial && (text(row.serialNumber) === serial || text(row.serial) === serial)) ||
      (lotNumber && text(row.lotNumber) === lotNumber) ||
      (productId && text(row.productId) === productId);

    if (!isMatch) return row;
    matched = true;
    return {
      ...row,
      archived: true,
      status: "returned",
      archivedAt,
      archiveReason: reason,
      returnedAt: archivedAt,
    };
  });

  return matched ? next : null;
}

function operationRefFor(database: Firestore, input: CreateMovementInput, actor: MovementActor) {
  assertOperationId(input.operationId);
  return database.collection("inventoryOperations").doc(`${actor.uid}_${input.operationId}`);
}

export async function prepareInventoryMovementInTransaction(params: {
  transaction: Transaction;
  database: Firestore;
  input: CreateMovementInput & { inventoryItemId: string };
  actor: MovementActor;
  inventorySeed?: InventoryDoc;
  requestFingerprint?: string;
}): Promise<InventoryMovementWritePlan> {
  const { transaction, database, input, actor } = params;

  if (ADMIN_ONLY_MOVEMENTS.has(input.movementType) && actor.role !== "admin" && actor.role !== "tank") {
    return {
      result: {
        status: "permission_denied",
        operationId: input.operationId,
        message: "Admin access is required for this movement.",
      },
      apply: () => undefined,
    };
  }

  assertOperationId(input.operationId);
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");

  const source = input.source ?? "system";
  const reason = text(input.reason);
  const quantity = parsePositiveQuantity(input);
  const operationRef = operationRefFor(database, input, actor);
  const fingerprint = params.requestFingerprint ?? movementFingerprint(input, actor);
  const inventoryRef = database.collection("inventory").doc(input.inventoryItemId);

  const existingOperation = await transaction.get(operationRef);
  if (existingOperation.exists) {
    const data = existingOperation.data() as InventoryDoc;
    if (text(data.requestFingerprint) && text(data.requestFingerprint) !== fingerprint) {
      throw new HttpsError(
        "failed-precondition",
        "This operationId was already used with different request data."
      );
    }

    return {
      result: {
        status: "duplicate_operation",
        operationId: input.operationId,
        movementId: text(data.movementId),
        inventoryItemId: text(data.inventoryItemId),
        productId: text(data.productId),
        quantityBefore: readNumber(data, "quantityBefore", 0),
        quantityDelta: readNumber(data, "quantityDelta", 0),
        quantityAfter: readNumber(data, "quantityAfter", 0),
        message: "Movement already applied.",
      },
      apply: () => undefined,
    };
  }

  const inventorySnap = await transaction.get(inventoryRef);
  if (!inventorySnap.exists && !params.inventorySeed) {
    throw new HttpsError("not-found", "Inventory item was not found.");
  }

  const inventory: InventoryDoc = {
    id: inventoryRef.id,
    ...(params.inventorySeed ?? {}),
    ...(inventorySnap.exists ? (inventorySnap.data() as InventoryDoc) : {}),
  };
  const productId = text(input.productId) || text(inventory.productId);
  const productRef = productId ? database.collection("products").doc(productId) : null;
  const productSnap = productRef ? await transaction.get(productRef) : null;
  const product = productSnap?.exists ? (productSnap.data() as InventoryDoc) : null;
  const { quantityDelta, onRentDelta, onTruckDelta } = getMovementDeltas(
    input.movementType,
    quantity,
    input.quantityDelta
  );

  assertMovementAllowedForState({
    movementType: input.movementType,
    quantityDelta,
    onRentDelta,
    onTruckDelta,
    inventory,
    product,
    quantity,
  });

  if (input.movementType === "hard_delete") {
    await assertNoDependenciesForHardDelete(transaction, database, input.inventoryItemId, productId);
  }

  const quantityBefore = readNumber(inventory, "quantityOnHand", 0);
  const committed = readNumber(inventory, "committed", 0);
  const onRentBefore = readNumber(inventory, "onRent", 0);
  const onTruckBefore = readNumber(inventory, "onTruck", 0);
  const quantityAfter = quantityBefore + quantityDelta;
  const onRentAfter = onRentBefore + onRentDelta;
  const onTruckAfter = onTruckBefore + onTruckDelta;
  const availableAfter = quantityAfter - committed - onRentAfter - onTruckAfter;
  const movementRef = database.collection("inventoryTransactions").doc();
  const now = Timestamp.now();
  const patientId = text(input.patientId) || text(inventory.patientKey) || text(inventory.patientId);
  const patientRef =
    input.movementType === "deceased_patient_equipment_return" && patientId
      ? database.collection("patients").doc(patientId)
      : null;
  const patientSnap = patientRef ? await transaction.get(patientRef) : null;

  const inventoryUpdate: InventoryDoc = {
    quantityOnHand: quantityAfter,
    onRent: onRentAfter,
    onTruck: onTruckAfter,
    available: availableAfter,
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
    lastMovementId: movementRef.id,
  };

  if (input.movementType === "warehouse_transfer") {
    inventoryUpdate.locationName = text(input.toLocation);
  }

  if (input.movementType === "discontinued") {
    inventoryUpdate.status = "discontinued";
    inventoryUpdate.lifecycleStatus = "retired";
  }

  if (input.movementType === "archived") {
    inventoryUpdate.isDeleted = true;
    inventoryUpdate.deletedAt = FieldValue.serverTimestamp();
  }

  if (input.movementType === "restored") {
    inventoryUpdate.isDeleted = false;
    inventoryUpdate.restoredAt = FieldValue.serverTimestamp();
  }

  if (["patient_assignment", "patient_transfer", "rental_checkout", "delivery_delivered"].includes(input.movementType)) {
    inventoryUpdate.status =
      input.movementType === "rental_checkout" ? "rental_out" : "assigned";
    if (input.patientId) inventoryUpdate.patientKey = text(input.patientId);
    if (input.patientName) inventoryUpdate.patientName = text(input.patientName);
    if (input.rentalId) inventoryUpdate.rentalId = text(input.rentalId);
  }

  if (["rental_return", "deceased_patient_equipment_return", "delivery_returned"].includes(input.movementType)) {
    inventoryUpdate.status = "available";
    inventoryUpdate.patientKey = "";
    inventoryUpdate.patientName = "";
    inventoryUpdate.rentalId = "";
    inventoryUpdate.lastReturnedAt = FieldValue.serverTimestamp();
  }

  const apply = (): void => {
    if (inventorySnap.exists) {
      transaction.update(inventoryRef, inventoryUpdate);
    } else {
      transaction.set(inventoryRef, {
        ...(params.inventorySeed ?? {}),
        ...inventoryUpdate,
      });
    }

    if (patientRef) {
      const archivedAt = now.toDate().toISOString();
      const patientData = patientSnap?.exists ? (patientSnap.data() as InventoryDoc) : {};
      const archivedEquipment = archiveCurrentEquipment(
        patientData.currentEquipment,
        inventory,
        archivedAt,
        input.movementType
      );

      const patientUpdate: InventoryDoc = {
        currentEquipmentArchivedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (archivedEquipment) {
        patientUpdate.currentEquipment = archivedEquipment;
      }

      transaction.set(patientRef, patientUpdate, { merge: true });

      transaction.set(
        patientRef.collection("equipment").doc(input.inventoryItemId),
        {
          inventoryId: input.inventoryItemId,
          productId,
          itemName: text(inventory.name),
          barcode: text(input.barcode) || text(inventory.barcode),
          serialNumber:
            text(input.serialNumber) || text(inventory.serialNumber) || text(inventory.serial),
          lotNumber: text(input.lotNumber) || text(inventory.lotNumber),
          status: "returned",
          archived: true,
          archivedAt: FieldValue.serverTimestamp(),
          archiveReason: input.movementType,
          returnReason: input.movementType,
          returnedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(patientRef.collection("timeline").doc(), {
        type: "equipment_returned",
        title: "Equipment archived and checked back into inventory",
        body: `${text(inventory.name) || "Equipment"} was checked back into inventory.`,
        metadata: {
          inventoryId: input.inventoryItemId,
          productId,
          barcode: text(input.barcode) || text(inventory.barcode),
          serialNumber:
            text(input.serialNumber) || text(inventory.serialNumber) || text(inventory.serial),
          lotNumber: text(input.lotNumber) || text(inventory.lotNumber),
          movementId: movementRef.id,
          reason,
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.set(movementRef, {
      id: movementRef.id,
      operationId: input.operationId,
      productId,
      inventoryItemId: input.inventoryItemId,
      movementType: input.movementType,
      quantityDelta,
      quantityBefore,
      quantityAfter,
      fromLocation: text(input.fromLocation) || text(inventory.locationName),
      toLocation: text(input.toLocation),
      patientId: text(input.patientId),
      rentalId: text(input.rentalId),
      barcode: text(input.barcode) || text(inventory.barcode),
      serialNumber:
        text(input.serialNumber) || text(inventory.serialNumber) || text(inventory.serial),
      lotNumber: text(input.lotNumber) || text(inventory.lotNumber),
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      reason,
      source,
      correlationId: text(input.correlationId),
      createdAt: now,
      reversedMovementId: "",
      reversalMovementId: "",
      status: "success",
      metadata: {
        ...(input.metadata ?? {}),
        onRentBefore,
        onRentDelta,
        onRentAfter,
        onTruckBefore,
        onTruckDelta,
        onTruckAfter,
        committed,
        availableAfter,
      },
    });

    transaction.set(operationRef, {
      operationId: input.operationId,
      operationType: input.movementType,
      requestFingerprint: fingerprint,
      performedByUid: actor.uid,
      performedByEmail: actor.email,
      inventoryItemId: input.inventoryItemId,
      productId,
      movementId: movementRef.id,
      quantityBefore,
      quantityDelta,
      quantityAfter,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(database.collection("auditLogs").doc(), {
      action: `inventory.${input.movementType}`,
      actorUid: actor.uid,
      actorEmail: actor.email,
      targetCollection: "inventory",
      targetId: input.inventoryItemId,
      details: {
        operationId: input.operationId,
        movementId: movementRef.id,
        productId,
        quantityBefore,
        quantityDelta,
        quantityAfter,
        reason,
        source,
      },
      createdAt: FieldValue.serverTimestamp(),
      success: true,
    });

    if (input.movementType === "hard_delete") {
      transaction.delete(inventoryRef);
    }
  };

  return {
    result: {
      status: "success",
      operationId: input.operationId,
      movementId: movementRef.id,
      inventoryItemId: input.inventoryItemId,
      productId,
      quantityBefore,
      quantityDelta,
      quantityAfter,
    },
    apply,
  };
}

export async function createInventoryMovementInTransaction(params: {
  transaction: Transaction;
  database: Firestore;
  input: CreateMovementInput & { inventoryItemId: string };
  actor: MovementActor;
  inventorySeed?: InventoryDoc;
  requestFingerprint?: string;
}): Promise<MovementResult> {
  const plan = await prepareInventoryMovementInTransaction(params);
  plan.apply();
  return plan.result;
}

export async function createInventoryMovement(
  input: CreateMovementInput,
  actor: MovementActor,
  database: Firestore = defaultFirestore()
): Promise<MovementResult> {
  if (ADMIN_ONLY_MOVEMENTS.has(input.movementType) && actor.role !== "admin" && actor.role !== "tank") {
    return {
      status: "permission_denied",
      operationId: input.operationId,
      message: "Admin access is required for this movement.",
    };
  }

  // Preserve the legacy standalone validation order before identifier resolution.
  parsePositiveQuantity(input);
  operationRefFor(database, input, actor);

  // Preserve the fingerprint of the original request. Barcode/serial/lot
  // callers historically fingerprinted before inventoryItemId resolution.
  const requestFingerprint = movementFingerprint(input, actor);

  const resolved = await resolveInventoryForMovement(database, input);

  if (resolved.status === "invalid") {
    return {
      status: "invalid",
      operationId: input.operationId,
      message: resolved.message,
    };
  }

  if (resolved.status === "not_found") {
    return {
      status: "not_found",
      operationId: input.operationId,
      message: "Inventory item was not found.",
    };
  }

  if (resolved.status === "ambiguous") {
    return {
      status: "ambiguous",
      operationId: input.operationId,
      matches: resolved.matches,
    };
  }

  return database.runTransaction((transaction) =>
    createInventoryMovementInTransaction({
      transaction,
      database,
      input: {
        ...input,
        inventoryItemId: resolved.id,
      },
      actor,
      requestFingerprint,
    })
  );
}
async function assertNoDependenciesForHardDelete(
  transaction: Transaction,
  database: Firestore,
  inventoryItemId: string,
  productId: string
): Promise<void> {
  const checks = await Promise.all([
    transaction.get(
      database.collection("inventoryTransactions").where("inventoryItemId", "==", inventoryItemId).limit(1)
    ),
    transaction.get(database.collection("rentals").where("inventoryItemId", "==", inventoryItemId).limit(1)),
    transaction.get(database.collection("patients").where("currentEquipmentIds", "array-contains", inventoryItemId).limit(1)),
    productId
      ? transaction.get(database.collection("inventory").where("productId", "==", productId).limit(2))
      : Promise.resolve(null),
  ]);

  if (checks[0] && !checks[0].empty) {
    throw new HttpsError("failed-precondition", "Cannot hard delete inventory with movement history.");
  }

  if (checks[1] && !checks[1].empty) {
    throw new HttpsError("failed-precondition", "Cannot hard delete inventory with rental references.");
  }

  if (checks[2] && !checks[2].empty) {
    throw new HttpsError("failed-precondition", "Cannot hard delete inventory with patient assignments.");
  }
}

export async function reverseInventoryMovement(params: {
  operationId: string;
  movementId: string;
  reason: string;
  actor: MovementActor;
  source?: MovementSource;
  database?: Firestore;
}): Promise<MovementResult> {
  const database = params.database ?? defaultFirestore();
  assertOperationId(params.operationId);
  assertSafeDocId(params.movementId, "movementId");

  if (params.actor.role !== "admin" && params.actor.role !== "tank") {
    return {
      status: "permission_denied",
      operationId: params.operationId,
      message: "Admin access is required to reverse this movement.",
    };
  }

  const source = params.source ?? "system";
  const operationRef = database
    .collection("inventoryOperations")
    .doc(`${params.actor.uid}_${params.operationId}`);
  const originalRef = database.collection("inventoryTransactions").doc(params.movementId);

  return database.runTransaction(async (transaction) => {
    const existingOperation = await transaction.get(operationRef);
    if (existingOperation.exists) {
      const data = existingOperation.data() as InventoryDoc;
      return {
        status: "duplicate_operation",
        operationId: params.operationId,
        movementId: text(data.movementId),
        inventoryItemId: text(data.inventoryItemId),
        productId: text(data.productId),
        message: "Reversal already applied.",
      };
    }

    const originalSnap = await transaction.get(originalRef);
    if (!originalSnap.exists) {
      throw new HttpsError("not-found", "Original movement was not found.");
    }

    const original = originalSnap.data() as InventoryDoc;
    if (text(original.reversalMovementId)) {
      throw new HttpsError("already-exists", "This movement has already been reversed.");
    }

    const inventoryItemId = text(original.inventoryItemId);
    assertSafeDocId(inventoryItemId, "inventoryItemId");
    const inventoryRef = database.collection("inventory").doc(inventoryItemId);
    const inventorySnap = await transaction.get(inventoryRef);
    if (!inventorySnap.exists) {
      throw new HttpsError("not-found", "Inventory item was not found.");
    }

    const inventory = inventorySnap.data() as InventoryDoc;
    const quantityBefore = readNumber(inventory, "quantityOnHand", 0);
    const originalDelta = readNumber(original, "quantityDelta", 0);
    const quantityDelta = -originalDelta;
    const quantityAfter = quantityBefore + quantityDelta;

    if (quantityAfter < 0) {
      throw new HttpsError("failed-precondition", "Reversal would make quantity negative.");
    }

    const committed = readNumber(inventory, "committed", 0);
    const onRent = readNumber(inventory, "onRent", 0);
    const movementRef = database.collection("inventoryTransactions").doc();

    transaction.update(inventoryRef, {
      quantityOnHand: quantityAfter,
      available: quantityAfter - committed - onRent,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUid: params.actor.uid,
      updatedByEmail: params.actor.email,
      lastMovementId: movementRef.id,
    });

    transaction.update(originalRef, {
      reversalMovementId: movementRef.id,
    });

    transaction.set(movementRef, {
      id: movementRef.id,
      operationId: params.operationId,
      productId: text(original.productId),
      inventoryItemId,
      movementType: "reversal",
      quantityDelta,
      quantityBefore,
      quantityAfter,
      fromLocation: text(original.toLocation),
      toLocation: text(original.fromLocation),
      patientId: text(original.patientId),
      rentalId: text(original.rentalId),
      barcode: text(original.barcode),
      serialNumber: text(original.serialNumber),
      lotNumber: text(original.lotNumber),
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      reason: text(params.reason),
      source,
      createdAt: Timestamp.now(),
      reversedMovementId: params.movementId,
      reversalMovementId: "",
      status: "success",
      metadata: {
        originalMovementType: text(original.movementType),
      },
    });

    transaction.set(operationRef, {
      operationId: params.operationId,
      operationType: "reversal",
      performedByUid: params.actor.uid,
      performedByEmail: params.actor.email,
      inventoryItemId,
      productId: text(original.productId),
      movementId: movementRef.id,
      reversedMovementId: params.movementId,
      quantityBefore,
      quantityDelta,
      quantityAfter,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(database.collection("auditLogs").doc(), {
      action: "inventory.reversal",
      actorUid: params.actor.uid,
      actorEmail: params.actor.email,
      targetCollection: "inventoryTransactions",
      targetId: params.movementId,
      details: {
        operationId: params.operationId,
        movementId: movementRef.id,
        reversedMovementId: params.movementId,
        quantityBefore,
        quantityDelta,
        quantityAfter,
        reason: text(params.reason),
      },
      createdAt: FieldValue.serverTimestamp(),
      success: true,
    });

    return {
      status: "success",
      operationId: params.operationId,
      movementId: movementRef.id,
      inventoryItemId,
      productId: text(original.productId),
      quantityBefore,
      quantityDelta,
      quantityAfter,
    };
  });
}

export async function reconcileInventory(params: {
  dryRun: boolean;
  repair: boolean;
  actor: MovementActor;
  database?: Firestore;
}): Promise<{
  status: "success";
  dryRun: boolean;
  repair: boolean;
  issueCount: number;
  repairedCount: number;
  issues: Array<{ type: string; severity: "warning" | "error"; id: string; message: string }>;
}> {
  const database = params.database ?? defaultFirestore();
  const issues: Array<{ type: string; severity: "warning" | "error"; id: string; message: string }> = [];
  let repairedCount = 0;

  const [
    inventorySnap,
    movementSnap,
    productsSnap,
    rentalsSnap,
    deliverySnap,
    patientEquipmentSnap,
    workflowOpsSnap,
    deliverySignaturesSnap,
    deliveryDamagePhotosSnap,
  ] = await Promise.all([
    database.collection("inventory").limit(5000).get(),
    database.collection("inventoryTransactions").limit(10000).get(),
    database.collection("products").limit(5000).get(),
    database.collection("rentals").limit(5000).get(),
    database.collection("patientDeliveryTickets").limit(5000).get(),
    database.collectionGroup("equipment").limit(10000).get(),
    database.collection("domainWorkflowOperations").limit(10000).get(),
    database.collection("deliverySignatures").limit(5000).get(),
    database.collection("deliveryDamagePhotos").limit(5000).get(),
  ]);

  const inventoryIds = new Set(inventorySnap.docs.map((docSnap) => docSnap.id));
  const productIds = new Set(productsSnap.docs.map((docSnap) => docSnap.id));
  const inventoryById = new Map(inventorySnap.docs.map((docSnap) => [docSnap.id, docSnap.data() as InventoryDoc]));
  const activeRentalSerials = new Map<string, string[]>();
  const rentalIds = new Set<string>();
  const rentalMovementIds = new Set<string>();
  const rentalAssignmentIds = new Set<string>();
  const exchangeOps = new Map<string, { returnAsset?: string; checkoutAsset?: string; rentalId?: string }>();
  const deliveryMovementKeys = new Set<string>();
  const deliverySignatureTicketIds = new Set<string>();
  const deliveryTicketIds = new Set(deliverySnap.docs.map((docSnap) => docSnap.id));
  const workflowOperationIds = new Map<string, string[]>();
  const activePatientAssignments = new Map<string, string[]>();
  const serials = new Map<string, string[]>();

  for (const docSnap of inventorySnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const quantityOnHand = readNumber(data, "quantityOnHand", 0);
    const available = readNumber(data, "available", quantityOnHand);
    const productId = text(data.productId);
    const serial = text(data.serial) || text(data.serialNumber);

    if (quantityOnHand < 0 || available < 0) {
      issues.push({
        type: "negative_quantity",
        severity: "error",
        id: docSnap.id,
        message: `Inventory ${docSnap.id} has negative quantity fields.`,
      });
    }

    if (productId && !productIds.has(productId)) {
      issues.push({
        type: "orphan_inventory_product",
        severity: "error",
        id: docSnap.id,
        message: `Inventory ${docSnap.id} references missing product ${productId}.`,
      });
    }

    if (serial) {
      serials.set(serial, [...(serials.get(serial) ?? []), docSnap.id]);
    }

    const deletedProduct = productsSnap.docs.find((product) => product.id === productId)?.data()?.deleted === true;
    if (deletedProduct && (text(data.patientKey) || text(data.rentalId) || readNumber(data, "onRent", 0) > 0)) {
      issues.push({
        type: "archived_product_active_assignment",
        severity: "error",
        id: docSnap.id,
        message: `Inventory ${docSnap.id} belongs to archived product ${productId} but has active assignment fields.`,
      });
    }
  }

  for (const [serial, ids] of serials.entries()) {
    if (ids.length > 1) {
      issues.push({
        type: "duplicate_serial_number",
        severity: "error",
        id: serial,
        message: `Serial ${serial} appears on ${ids.length} inventory records: ${ids.join(", ")}.`,
      });
    }
  }

  for (const docSnap of rentalsSnap.docs) {
    rentalIds.add(docSnap.id);
    const data = docSnap.data() as InventoryDoc;
    const inventoryItemId = text(data.inventoryItemId);
    const serial = text(data.serialNumber) || text(data.serial);
    const isActive = !["returned", "closed", "cancelled"].includes(text(data.status).toLowerCase());
    if (inventoryItemId && !inventoryIds.has(inventoryItemId)) {
      issues.push({
        type: "orphan_rental_reference",
        severity: "error",
        id: docSnap.id,
        message: `Rental ${docSnap.id} references missing inventory ${inventoryItemId}.`,
      });
    }
    if (isActive && serial) {
      activeRentalSerials.set(serial, [...(activeRentalSerials.get(serial) ?? []), docSnap.id]);
    }
  }

  for (const [serial, ids] of activeRentalSerials.entries()) {
    if (ids.length > 1) {
      issues.push({
        type: "duplicate_active_rental",
        severity: "error",
        id: serial,
        message: `Serial ${serial} appears on ${ids.length} active rentals: ${ids.join(", ")}.`,
      });
    }
  }

  for (const docSnap of movementSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const inventoryItemId = text(data.inventoryItemId);
    const productId = text(data.productId);
    const metadata = data.metadata && typeof data.metadata === "object" ? (data.metadata as InventoryDoc) : {};
    const rentalId = text(data.rentalId);
    const movementType = text(data.movementType);
    if (rentalId && ["rental_checkout", "rental_return"].includes(movementType)) {
      rentalMovementIds.add(rentalId);
    }
    const exchangeOperationId = text(metadata.exchangeOperationId);
    if (exchangeOperationId) {
      const current = exchangeOps.get(exchangeOperationId) ?? {};
      if (text(metadata.exchangeSide) === "return") current.returnAsset = inventoryItemId;
      if (text(metadata.exchangeSide) === "checkout") current.checkoutAsset = inventoryItemId;
      if (rentalId) current.rentalId = rentalId;
      exchangeOps.set(exchangeOperationId, current);
    }
    const ticketId = text(metadata.ticketId) || text(metadata.deliveryId) || text(data.correlationId);
    const lineId = text(metadata.lineId);
    if (ticketId && lineId) {
      deliveryMovementKeys.add(`${ticketId}:${lineId}:${text(data.movementType)}`);
    }
    if (inventoryItemId && !inventoryIds.has(inventoryItemId)) {
      issues.push({
        type: "movement_missing_inventory",
        severity: "warning",
        id: docSnap.id,
        message: `Movement ${docSnap.id} references missing inventory ${inventoryItemId}.`,
      });
    }
    if (productId && !productIds.has(productId)) {
      issues.push({
        type: "movement_missing_product",
        severity: "warning",
        id: docSnap.id,
        message: `Movement ${docSnap.id} references missing product ${productId}.`,
      });
    }
  }

  for (const docSnap of deliverySnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const status = text(data.fulfillmentStatus).toLowerCase();
    const required = readNumber(data, "requiredScanCount", readNumber(data, "itemCount", 1));
    const delivered = readNumber(data, "deliveredScanCount", 0);
    const returned = readNumber(data, "returnedScanCount", 0);
    const fulfillmentLines =
      data.fulfillmentLines && typeof data.fulfillmentLines === "object"
        ? (data.fulfillmentLines as Record<string, InventoryDoc>)
        : {};

    if (status === "completed" && delivered + returned < required) {
      issues.push({
        type: "completed_ticket_unresolved_lines",
        severity: "error",
        id: docSnap.id,
        message: `Delivery ticket ${docSnap.id} is completed but has unresolved lines.`,
      });
    }

    if (text(data.signatureStatus) === "signed" && !text(data.signatureId)) {
      issues.push({
        type: "signed_delivery_missing_signature_reference",
        severity: "error",
        id: docSnap.id,
        message: `Delivery ticket ${docSnap.id} is signed without a signatureId.`,
      });
    }

    for (const [lineId, line] of Object.entries(fulfillmentLines)) {
      const lineStatus = text(line.status);
      if (
        ["delivered", "partially_delivered"].includes(lineStatus) &&
        !deliveryMovementKeys.has(`${docSnap.id}:${lineId}:delivery_delivered`)
      ) {
        issues.push({
          type: "delivered_line_missing_movement",
          severity: "error",
          id: `${docSnap.id}:${lineId}`,
          message: `Delivery line ${lineId} on ticket ${docSnap.id} is ${lineStatus} without a matching delivery movement.`,
        });
      }
    }
  }

  for (const docSnap of deliverySignaturesSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const ticketId = text(data.ticketId);
    if (ticketId) deliverySignatureTicketIds.add(ticketId);
    if (ticketId && !deliveryTicketIds.has(ticketId)) {
      issues.push({
        type: "finalized_signature_missing_delivery",
        severity: "error",
        id: docSnap.id,
        message: `Delivery signature ${docSnap.id} references missing ticket ${ticketId}.`,
      });
    }
    const storagePath = text(data.signatureStoragePath);
    if (storagePath) {
      const [exists] = await getStorage().bucket().file(storagePath).exists();
      if (!exists) {
        issues.push({
          type: "finalized_signature_missing_storage_object",
          severity: "error",
          id: docSnap.id,
          message: `Delivery signature ${docSnap.id} references missing Storage object ${storagePath}.`,
        });
      }
    }
  }

  for (const docSnap of deliverySnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    if (text(data.signatureStatus) === "signed" && !deliverySignatureTicketIds.has(docSnap.id)) {
      issues.push({
        type: "signed_delivery_without_finalized_signature",
        severity: "error",
        id: docSnap.id,
        message: `Delivery ticket ${docSnap.id} is signed without a finalized signature document.`,
      });
    }
  }

  for (const docSnap of deliveryDamagePhotosSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const ticketId = text(data.ticketId);
    if (ticketId && !deliveryTicketIds.has(ticketId)) {
      issues.push({
        type: "damage_photo_missing_delivery",
        severity: "error",
        id: docSnap.id,
        message: `Damage photo ${docSnap.id} references missing ticket ${ticketId}.`,
      });
    }
    const storagePath = text(data.storagePath);
    if (storagePath) {
      const [exists] = await getStorage().bucket().file(storagePath).exists();
      if (!exists) {
        issues.push({
          type: "damage_photo_missing_storage_object",
          severity: "error",
          id: docSnap.id,
          message: `Damage photo ${docSnap.id} references missing Storage object ${storagePath}.`,
        });
      }
    }
  }

  const [pendingFiles] = await getStorage().bucket().getFiles({
    prefix: "workflow-pending/delivery/",
    maxResults: 1000,
  });
  const pendingCutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const file of pendingFiles) {
    const [metadata] = await file.getMetadata();
    const updatedAt = metadata.updated ? Date.parse(metadata.updated) : Date.now();
    if (updatedAt < pendingCutoff) {
      issues.push({
        type: "stale_pending_workflow_upload",
        severity: "warning",
        id: file.name,
        message: `Pending workflow upload ${file.name} is older than 24 hours.`,
      });
    }
  }

  for (const docSnap of rentalsSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const inventoryItemId = text(data.inventoryItemId) || text(data.itemId);
    const status = text(data.status).toLowerCase();
    const inventory = inventoryItemId ? inventoryById.get(inventoryItemId) : null;

    if (["active", "checked_out", "overdue", "extended"].includes(status)) {
      if (!inventory || readNumber(inventory, "onRent", 0) <= 0) {
        issues.push({
          type: "active_rental_without_checked_out_asset",
          severity: "error",
          id: docSnap.id,
          message: `Rental ${docSnap.id} is active but its inventory item is not checked out.`,
        });
      }
    }

    if (["available", "returned", "closed"].includes(status) && inventory && text(inventory.patientKey)) {
      issues.push({
        type: "returned_rental_asset_still_assigned",
        severity: "error",
        id: docSnap.id,
        message: `Rental ${docSnap.id} is returned but inventory ${inventoryItemId} is still assigned.`,
      });
    }
  }

  for (const docSnap of patientEquipmentSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const inventoryItemId = text(data.inventoryId) || docSnap.id;
    const rentalId = text(data.rentalId);
    if (rentalId && text(data.status).toLowerCase() === "active") {
      rentalAssignmentIds.add(rentalId);
    }
    if (inventoryItemId && !inventoryIds.has(inventoryItemId)) {
      issues.push({
        type: "patient_equipment_missing_asset",
        severity: "error",
        id: docSnap.ref.path,
        message: `Patient equipment record ${docSnap.ref.path} points to missing inventory ${inventoryItemId}.`,
      });
    }
    if (text(data.status).toLowerCase() === "active") {
      activePatientAssignments.set(inventoryItemId, [
        ...(activePatientAssignments.get(inventoryItemId) ?? []),
        docSnap.ref.path,
      ]);
    }
  }

  for (const [inventoryItemId, paths] of activePatientAssignments.entries()) {
    if (paths.length > 1) {
      issues.push({
        type: "duplicate_active_patient_assignment",
        severity: "error",
        id: inventoryItemId,
        message: `Inventory ${inventoryItemId} has multiple active patient assignments: ${paths.join(", ")}.`,
      });
    }
  }

  for (const docSnap of rentalsSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const status = text(data.status).toLowerCase();
    const inventoryItemId = text(data.inventoryItemId) || text(data.itemId);
    const active = ["active", "checked_out", "overdue", "extended"].includes(status);
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0;
    const olderThanDraftCutoff = Date.now() - 72 * 60 * 60 * 1000;

    if (status === "draft" && createdAt > 0 && createdAt < olderThanDraftCutoff) {
      issues.push({
        type: "stale_rental_draft",
        severity: "warning",
        id: docSnap.id,
        message: `Rental ${docSnap.id} is a draft older than 72 hours.`,
      });
    }

    if (["available", "maintenance"].includes(status) && inventoryItemId && !text(data.movementId)) {
      issues.push({
        type: "rental_created_never_checked_out",
        severity: "warning",
        id: docSnap.id,
        message: `Rental ${docSnap.id} references inventory ${inventoryItemId} but has no checkout movement.`,
      });
    }

    if (active && !rentalMovementIds.has(docSnap.id)) {
      issues.push({
        type: "rental_without_movement",
        severity: "error",
        id: docSnap.id,
        message: `Active rental ${docSnap.id} has no matching rental movement.`,
      });
    }

    if (active && !rentalAssignmentIds.has(docSnap.id)) {
      issues.push({
        type: "rental_without_patient_assignment",
        severity: "error",
        id: docSnap.id,
        message: `Active rental ${docSnap.id} has no active patient equipment assignment.`,
      });
    }
  }

  for (const docSnap of movementSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const rentalId = text(data.rentalId);
    if (text(data.movementType) === "rental_checkout" && rentalId && !rentalIds.has(rentalId)) {
      issues.push({
        type: "rental_checkout_operation_missing_rental",
        severity: "error",
        id: docSnap.id,
        message: `Rental checkout movement ${docSnap.id} references missing rental ${rentalId}.`,
      });
    }
  }

  for (const [operationId, exchange] of exchangeOps.entries()) {
    if (!exchange.returnAsset || !exchange.checkoutAsset || exchange.returnAsset === exchange.checkoutAsset) {
      issues.push({
        type: "rental_exchange_asset_mismatch",
        severity: "error",
        id: operationId,
        message: `Rental exchange ${operationId} does not contain distinct old and replacement assets.`,
      });
    }
  }

  for (const docSnap of workflowOpsSnap.docs) {
    const data = docSnap.data() as InventoryDoc;
    const operationId = text(data.operationId);
    if (operationId) {
      workflowOperationIds.set(operationId, [...(workflowOperationIds.get(operationId) ?? []), docSnap.id]);
    }
    const workflowType = text(data.workflowType);
    const result = data.result && typeof data.result === "object" ? (data.result as InventoryDoc) : {};
    const rentalId = text(result.rentalId);
    if (workflowType.startsWith("rental.") && rentalId && !rentalIds.has(rentalId)) {
      issues.push({
        type: "orphan_rental_workflow_operation",
        severity: "warning",
        id: docSnap.id,
        message: `Workflow operation ${docSnap.id} references missing rental ${rentalId}.`,
      });
    }
  }

  for (const [operationId, ids] of workflowOperationIds.entries()) {
    if (ids.length > 1) {
      issues.push({
        type: "duplicate_workflow_operation_id",
        severity: "error",
        id: operationId,
        message: `Workflow operationId ${operationId} appears in ${ids.length} operation records.`,
      });
    }
  }

  if (params.repair && !params.dryRun) {
    const repairableNegative = issues.filter((issue) => issue.type === "negative_quantity");
    for (const issue of repairableNegative) {
      await database.collection("auditLogs").add({
        action: "inventory.reconciliation.repair_skipped",
        actorUid: params.actor.uid,
        actorEmail: params.actor.email,
        targetId: issue.id,
        details: {
          issue,
          reason: "Negative quantities require manual review and were not silently corrected.",
        },
        createdAt: FieldValue.serverTimestamp(),
        success: true,
      });
    }
    repairedCount = 0;
  }

  await database.collection("auditLogs").add({
    action: params.repair ? "inventory.reconciliation.repair" : "inventory.reconciliation.dry_run",
    actorUid: params.actor.uid,
    actorEmail: params.actor.email,
    details: {
      dryRun: params.dryRun,
      repair: params.repair,
      issueCount: issues.length,
      repairedCount,
    },
    createdAt: FieldValue.serverTimestamp(),
    success: true,
  });

  return {
    status: "success",
    dryRun: params.dryRun,
    repair: params.repair,
    issueCount: issues.length,
    repairedCount,
    issues,
  };
}
