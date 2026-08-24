import { createHash } from "node:crypto";
import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  createInventoryMovementInTransaction,
  type InventoryMovementType,
  type MovementActor,
} from "../inventory/movementService.js";
import {
  claimWorkflowOperation,
  completeWorkflowOperation,
  text,
  type WorkflowResult,
} from "../domainWorkflows/shared.js";

const ORDER_TRANSITIONS: Record<string, Set<string>> = {
  processing: new Set(["ready", "delivered", "cancelled"]),
  ready: new Set(["delivered", "cancelled"]),
  delivered: new Set(["archived"]),
  cancelled: new Set(["processing"]),
  archived: new Set([]),
};

export type OrderWorkflowAction = "create" | "cancel" | "restore" | "edit";

export type OrderWorkflowInput = {
  operationId: string;
  action: OrderWorkflowAction;
  orderId?: string;
  productId: string;
  quantity: number;
  patientName?: string;
  patientAddress?: string;
  productType?: string;
  purchaseCost?: number;
  barcode?: string;
  phone?: string;
  facilityName?: string;
  notes?: string;
};

export type OrderAllocation = {
  inventoryItemId: string;
  quantity: number;
  movementId?: string;
};

function assertTransition(current: string, next: string, label: string): void {
  const normalizedCurrent = current || "processing";
  if (!ORDER_TRANSITIONS[normalizedCurrent]?.has(next)) {
    throw new HttpsError(
      "failed-precondition",
      `Invalid order state transition: ${normalizedCurrent} -> ${next}.`
    );
  }
}

function assertOrderPayload(input: OrderWorkflowInput): void {
  if (!text(input.patientName)) {
    throw new HttpsError("invalid-argument", "Patient name is required.");
  }
  if (!text(input.productId)) {
    throw new HttpsError("invalid-argument", "Product ID is required.");
  }
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new HttpsError("invalid-argument", "Quantity must be at least 1.");
  }
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Compute a SHA-256 hash of all material CREATE request fields.
 * Produces a deterministic fingerprint without storing any PHI/PII.
 *
 * Material fields are those that affect:
 * - persisted order document content
 * - inventory allocation
 * - business behavior
 * - linkage/review state
 */
export function computeCreateRequestHash(input: {
  actorUid: string;
  action: string;
  productId: string;
  quantity: number;
  patientName?: string;
  patientAddress?: string;
  productType?: string;
  purchaseCost?: number;
  barcode?: string;
  phone?: string;
  facilityName?: string;
  notes?: string;
}): string {
  const canonical = JSON.stringify({
    actorUid: input.actorUid,
    action: input.action,
    productId: text(input.productId),
    quantity: input.quantity,
    patientName: text(input.patientName),
    patientAddress: text(input.patientAddress),
    productType: text(input.productType),
    purchaseCost: Number(input.purchaseCost ?? 0),
    barcode: text(input.barcode),
    phone: text(input.phone),
    facilityName: text(input.facilityName),
    notes: text(input.notes),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function makePatientKey(patientName: string, phone: string, patientAddress: string): string {
  const name = normalizeSearchText(patientName);
  const normalizedPhone = normalizePhone(phone);
  const address = normalizeSearchText(patientAddress).replace(/\s+/g, "");

  if (name && normalizedPhone) return `${name}|phone:${normalizedPhone}`;
  if (name && address) return `${name}|addr:${address.slice(0, 36)}`;

  return name || "";
}

function makeOrderKey(patientName: string, productType: string): string {
  return normalizeSearchText(`${patientName} ${productType}`);
}

function isSerializedInventory(inventory: Record<string, unknown>): boolean {
  return (
    inventory.isSerialized === true ||
    inventory.requiresSerialTracking === true ||
    Boolean(
      text(inventory.serial) ||
      text(inventory.serialNumber)
    )
  );
}

async function resolveAvailableInventory(
  transaction: Transaction,
  database: Firestore,
  productId: string,
  quantity: number
): Promise<Array<{ inventoryItemId: string; available: number }>> {
  const snap = await transaction.get(
    database
      .collection("inventory")
      .where("productId", "==", productId)
      .where("isDeleted", "!=", true)
      .limit(50)
  );

  const candidates: Array<{ inventoryItemId: string; available: number }> = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const status = text(data.status).toLowerCase();
    if (status === "discontinued" || status === "inactive") continue;

    const quantityOnHand = Number(data.quantityOnHand ?? 0);
    const committed = Number(data.committed ?? 0);
    const onRent = Number(data.onRent ?? 0);
    const onTruck = Number(data.onTruck ?? 0);
    let available = quantityOnHand - committed - onRent - onTruck;

    if (isSerializedInventory(data)) {
      available = Math.min(available, 1);
    }

    if (available > 0) {
      candidates.push({ inventoryItemId: docSnap.id, available });
    }
  }

  candidates.sort((a, b) => b.available - a.available);

  return candidates;
}

function allocateQuantity(
  candidates: Array<{ inventoryItemId: string; available: number }>,
  quantity: number
): Array<{ inventoryItemId: string; quantity: number }> {
  const result: Array<{ inventoryItemId: string; quantity: number }> = [];
  let remaining = quantity;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(candidate.available, remaining);
    result.push({ inventoryItemId: candidate.inventoryItemId, quantity: take });
    remaining -= take;
  }

  return result;
}

export async function orderWorkflow(
  params: {
    database: Firestore;
    transaction: Transaction;
    input: OrderWorkflowInput;
    actor: MovementActor;
  }
): Promise<WorkflowResult> {
  const { database, transaction, input, actor } = params;
  const operationId = text(input.operationId);
  const workflowType = `order.${input.action}`;

  const createFingerprintHash = input.action === "create"
    ? computeCreateRequestHash({
        actorUid: actor.uid,
        action: input.action,
        productId: text(input.productId),
        quantity: input.quantity,
        patientName: text(input.patientName),
        patientAddress: text(input.patientAddress),
        productType: text(input.productType),
        purchaseCost: input.purchaseCost,
        barcode: text(input.barcode),
        phone: text(input.phone),
        facilityName: text(input.facilityName),
        notes: text(input.notes),
      })
    : undefined;

  const editFingerprintHash = input.action === "edit"
    ? createHash("sha256").update(JSON.stringify({
        actorUid: actor.uid,
        action: input.action,
        orderId: text(input.orderId),
        productId: text(input.productId),
        quantity: input.quantity,
        patientName: text(input.patientName),
        patientAddress: text(input.patientAddress),
        productType: text(input.productType),
        purchaseCost: Number(input.purchaseCost ?? 0),
        barcode: text(input.barcode),
        phone: text(input.phone),
        facilityName: text(input.facilityName),
        notes: text(input.notes),
      })).digest("hex")
    : undefined;

  const baseFingerprint = {
    actorUid: actor.uid,
    action: input.action,
    productId: text(input.productId),
    quantity: input.quantity,
    patientName: text(input.patientName),
  };

  const claim = await claimWorkflowOperation({
    transaction,
    database,
    operationId,
    workflowType,
    actor,
    fingerprint:
      input.action === "create"
        ? createFingerprintHash!
        : input.action === "edit"
          ? editFingerprintHash!
          : { ...baseFingerprint, orderId: text(input.orderId) },
  });

  if (claim.duplicate) {
    return {
      ...claim.result,
      status: "duplicate_operation",
      workflowType,
    };
  }

  try {
    if (input.action === "create") {
      return await createOrderWorkflow({ database, transaction, input, actor, operationId, workflowType });
    }

    if (input.action === "cancel") {
      return await cancelOrderWorkflow({ database, transaction, input, actor, operationId, workflowType });
    }

    if (input.action === "restore") {
      return await restoreOrderWorkflow({ database, transaction, input, actor, operationId, workflowType });
    }

    if (input.action === "edit") {
      return await editOrderWorkflow({ database, transaction, input, actor, operationId, workflowType });
    }

    throw new HttpsError("invalid-argument", `Unsupported order action: ${input.action}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order workflow failed.";
    const code = error instanceof HttpsError ? error.code : "internal";
    throw new HttpsError(code, message);
  }
}

async function createOrderWorkflow(params: {
  database: Firestore;
  transaction: Transaction;
  input: OrderWorkflowInput;
  actor: MovementActor;
  operationId: string;
  workflowType: string;
}): Promise<WorkflowResult> {
  const { database, transaction, input, actor, operationId, workflowType } = params;
  assertOrderPayload(input);

  const quantity = Number(input.quantity);
  const productId = text(input.productId);

  const candidates = await resolveAvailableInventory(transaction, database, productId, quantity);
  if (candidates.length === 0) {
    throw new HttpsError("failed-precondition", "No available inventory for this product.");
  }

  const totalAvailable = candidates.reduce((sum, c) => sum + c.available, 0);
  if (totalAvailable < quantity) {
    throw new HttpsError("failed-precondition", "Insufficient inventory available.");
  }

  const createFingerprintHash = computeCreateRequestHash({
    actorUid: actor.uid,
    action: input.action,
    productId: text(input.productId),
    quantity: input.quantity,
    patientName: text(input.patientName),
    patientAddress: text(input.patientAddress),
    productType: text(input.productType),
    purchaseCost: input.purchaseCost,
    barcode: text(input.barcode),
    phone: text(input.phone),
    facilityName: text(input.facilityName),
    notes: text(input.notes),
  });

  const allocations = allocateQuantity(candidates, quantity);
  const movementIds: string[] = [];
  const allocationSnapshot: OrderAllocation[] = [];

  for (const allocation of allocations) {
    const movementId = `order-alloc-${operationId}-${allocation.inventoryItemId}`;
    const movementResult = await createInventoryMovementInTransaction({
      transaction,
      database,
      input: {
        operationId: movementId,
        movementType: "order_allocation",
        inventoryItemId: allocation.inventoryItemId,
        productId,
        quantity: allocation.quantity,
        reason: `Order allocation for ${text(input.patientName)}`,
        source: "orders",
        correlationId: operationId,
      },
      actor,
      requestFingerprint: `${createFingerprintHash}:${allocation.inventoryItemId}:${allocation.quantity}`,
    });

    if (movementResult.status !== "success") {
      throw new HttpsError("internal", `Order allocation movement failed: ${movementResult.message}`);
    }

    movementIds.push(movementResult.movementId ?? movementId);
    allocationSnapshot.push({
      inventoryItemId: allocation.inventoryItemId,
      quantity: allocation.quantity,
      movementId: movementResult.movementId ?? movementId,
    });
  }

  const patientName = text(input.patientName);
  const patientAddress = text(input.patientAddress);
  const productType = text(input.productType) || text(input.productId);
  const phone = text(input.phone);
  const barcode = text(input.barcode);
  const facilityName = text(input.facilityName);
  const notes = text(input.notes);
  const purchaseCost = Number(input.purchaseCost ?? 0);

  const patientKey = makePatientKey(patientName, phone, patientAddress);
  const orderKey = makeOrderKey(patientName, productType);
  const searchText = normalizeSearchText(
    [patientName, patientAddress, productType, phone, facilityName, notes, barcode, patientKey, orderKey].join(" ")
  );
  const normalizedName = normalizeSearchText(patientName);
  const normalizedPhone = normalizePhone(phone);
  const normalizedAddress = normalizeSearchText(patientAddress);
  const normalizedDob = normalizeSearchText("");

  const reviewReasons: string[] = [];
  if (!phone) reviewReasons.push("missingPhone");

  const orderRef = database.collection("orders").doc();
  transaction.set(orderRef, {
    productId,
    quantity,
    patientName,
    patientAddress,
    productType,
    purchaseCost,
    barcode,
    phone,
    facilityName,
    notes,
    status: "processing",
    inventoryAllocated: true,
    inventoryRestored: false,
    inventoryAllocations: allocationSnapshot,
    inventoryAllocationSourceId: "",
    createdBy: actor.email ?? actor.uid,
    createdByUid: actor.uid,
    updatedBy: actor.email ?? actor.uid,
    updatedByUid: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    isHospice: false,
    linkedPatientId: "",
    linkedInventoryId: productId,
    patientKey,
    orderKey,
    searchText,
    normalizedName,
    normalizedDob,
    normalizedPhone,
    normalizedAddress,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    smartRouteTargets: ["orders", "patients", "analytics"],
  });

  completeWorkflowOperation({
    transaction,
    database,
    operationId,
    workflowType,
    actor,
    result: {
      status: "success",
      operationId,
      workflowType,
      movementIds,
      orderId: orderRef.id,
      orderStatus: "processing",
      inventoryAllocated: true,
      inventoryRestored: false,
      allocations: allocationSnapshot,
    },
  });

  return {
    status: "success",
    operationId,
    workflowType,
    movementIds,
    orderId: orderRef.id,
    orderStatus: "processing",
    inventoryAllocated: true,
    inventoryRestored: false,
    allocations: allocationSnapshot,
  };
}

async function cancelOrderWorkflow(params: {
  database: Firestore;
  transaction: Transaction;
  input: OrderWorkflowInput;
  actor: MovementActor;
  operationId: string;
  workflowType: string;
}): Promise<WorkflowResult> {
  const { database, transaction, input, actor, operationId, workflowType } = params;
  const orderId = text(input.orderId);

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required for cancellation.");
  }

  const orderRef = database.collection("orders").doc(orderId);
  const orderSnap = await transaction.get(orderRef);

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }

  const orderData = orderSnap.data() as Record<string, unknown>;
  const currentStatus = text(orderData.status).toLowerCase();

  assertTransition(currentStatus, "cancelled", "order");

  if (orderData.inventoryRestored === true) {
    return {
      status: "success",
      operationId,
      workflowType,
      message: "Inventory already restored.",
      movementIds: [],
    };
  }

  const allocations = Array.isArray(orderData.inventoryAllocations)
    ? (orderData.inventoryAllocations as OrderAllocation[])
    : [];

  // FAIL CLOSED: If inventory was marked as allocated but we have no allocation
  // snapshot to restore from, reject the cancellation to prevent false accounting.
  if (orderData.inventoryAllocated === true && allocations.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Cannot cancel: order is marked as allocated but has no allocation snapshot to restore."
    );
  }

  const movementIds: string[] = [];

  for (const allocation of allocations) {
    const movementId = `order-restore-${operationId}-${allocation.inventoryItemId}`;
    const movementResult = await createInventoryMovementInTransaction({
      transaction,
      database,
      input: {
        operationId: movementId,
        movementType: "order_restoration",
        inventoryItemId: allocation.inventoryItemId,
        productId: text(orderData.productId),
        quantity: allocation.quantity,
        reason: `Order cancelled for ${text(orderData.patientName)}`,
        source: "orders",
        correlationId: orderId,
      },
      actor,
      requestFingerprint: `${operationId}:restore:${allocation.inventoryItemId}:${allocation.quantity}`,
    });

    if (movementResult.status !== "success") {
      throw new HttpsError("internal", `Order restoration movement failed: ${movementResult.message}`);
    }

    movementIds.push(movementResult.movementId ?? movementId);
  }

  transaction.update(orderRef, {
    status: "cancelled",
    inventoryRestored: true,
    updatedBy: actor.email ?? actor.uid,
    updatedByUid: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  completeWorkflowOperation({
    transaction,
    database,
    operationId,
    workflowType,
    actor,
    result: {
      status: "success",
      operationId,
      workflowType,
      movementIds,
      metadata: { orderId, restoredQuantity: allocations.reduce((sum, a) => sum + a.quantity, 0) },
    },
  });

  return {
    status: "success",
    operationId,
    workflowType,
    movementIds,
    metadata: { orderId, restoredQuantity: allocations.reduce((sum, a) => sum + a.quantity, 0) },
  };
}

async function restoreOrderWorkflow(params: {
  database: Firestore;
  transaction: Transaction;
  input: OrderWorkflowInput;
  actor: MovementActor;
  operationId: string;
  workflowType: string;
}): Promise<WorkflowResult> {
  const { database, transaction, input, actor, operationId, workflowType } = params;
  const orderId = text(input.orderId);

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required for restoration.");
  }

  const orderRef = database.collection("orders").doc(orderId);
  const orderSnap = await transaction.get(orderRef);

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }

  const orderData = orderSnap.data() as Record<string, unknown>;
  const currentStatus = text(orderData.status).toLowerCase();

  assertTransition(currentStatus, "processing", "order");

  const quantity = Number(input.quantity) || Number(orderData.quantity ?? 0);
  const productId = text(orderData.productId) || text(input.productId);

  if (!productId || quantity <= 0) {
    throw new HttpsError("invalid-argument", "Order must have a product and positive quantity to restore.");
  }

  const candidates = await resolveAvailableInventory(transaction, database, productId, quantity);
  if (candidates.length === 0) {
    throw new HttpsError("failed-precondition", "No available inventory for restoration.");
  }

  const totalAvailable = candidates.reduce((sum, c) => sum + c.available, 0);
  if (totalAvailable < quantity) {
    throw new HttpsError("failed-precondition", "Insufficient inventory available for restoration.");
  }

  const allocations = allocateQuantity(candidates, quantity);
  const movementIds: string[] = [];
  const allocationSnapshot: OrderAllocation[] = [];

  for (const allocation of allocations) {
    const movementId = `order-realloc-${operationId}-${allocation.inventoryItemId}`;
    const movementResult = await createInventoryMovementInTransaction({
      transaction,
      database,
      input: {
        operationId: movementId,
        movementType: "order_allocation",
        inventoryItemId: allocation.inventoryItemId,
        productId,
        quantity: allocation.quantity,
        reason: `Order restored for ${text(orderData.patientName)}`,
        source: "orders",
        correlationId: orderId,
      },
      actor,
      requestFingerprint: `${operationId}:reallocate:${allocation.inventoryItemId}:${allocation.quantity}`,
    });

    if (movementResult.status !== "success") {
      throw new HttpsError("internal", `Order reallocation movement failed: ${movementResult.message}`);
    }

    movementIds.push(movementResult.movementId ?? movementId);
    allocationSnapshot.push({
      inventoryItemId: allocation.inventoryItemId,
      quantity: allocation.quantity,
      movementId: movementResult.movementId ?? movementId,
    });
  }

  transaction.update(orderRef, {
    status: "processing",
    inventoryAllocated: true,
    inventoryRestored: false,
    inventoryAllocations: allocationSnapshot,
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: actor.email ?? actor.uid,
    restoredByUid: actor.uid,
    updatedBy: actor.email ?? actor.uid,
    updatedByUid: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  completeWorkflowOperation({
    transaction,
    database,
    operationId,
    workflowType,
    actor,
    result: {
      status: "success",
      operationId,
      workflowType,
      movementIds,
      metadata: { orderId, allocations: allocationSnapshot },
    },
  });

  return {
    status: "success",
    operationId,
    workflowType,
    movementIds,
    metadata: { orderId, allocations: allocationSnapshot },
  };
}

async function editOrderWorkflow(params: {
  database: Firestore;
  transaction: Transaction;
  input: OrderWorkflowInput;
  actor: MovementActor;
  operationId: string;
  workflowType: string;
}): Promise<WorkflowResult> {
  const { database, transaction, input, actor, operationId, workflowType } = params;
  const orderId = text(input.orderId);

  if (!orderId) {
    throw new HttpsError("invalid-argument", "orderId is required for edit.");
  }

  const orderRef = database.collection("orders").doc(orderId);
  const orderSnap = await transaction.get(orderRef);

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found.");
  }

  const orderData = orderSnap.data() as Record<string, unknown>;

  if (orderData.inventoryAllocated === true && orderData.inventoryRestored !== true) {
    const newProductId = text(input.productId);
    const newQuantity = Number(input.quantity);
    const currentProductId = text(orderData.productId);
    const currentQuantity = Number(orderData.quantity ?? 0);

    if (newProductId && newProductId !== currentProductId) {
      throw new HttpsError("failed-precondition", "Cannot change product on an allocated order.");
    }
    if (newQuantity > 0 && newQuantity !== currentQuantity) {
      throw new HttpsError("failed-precondition", "Cannot change quantity on an allocated order.");
    }
  }

  const patientName = text(input.patientName) || text(orderData.patientName) || "";
  const patientAddress = text(input.patientAddress) || text(orderData.patientAddress) || "";
  const productId = text(input.productId) || text(orderData.productId) || "";
  const productType = text(input.productType) || text(orderData.productType) || "";
  const purchaseCost = input.purchaseCost !== undefined ? Number(input.purchaseCost) : Number(orderData.purchaseCost ?? 0);
  const quantity = input.quantity > 0 ? Number(input.quantity) : Number(orderData.quantity ?? 1);
  const barcode = text(input.barcode) ?? text(orderData.barcode) ?? "";
  const phone = text(input.phone) ?? text(orderData.phone) ?? "";
  const facilityName = text(input.facilityName) ?? text(orderData.facilityName) ?? "";
  const notes = text(input.notes) ?? text(orderData.notes) ?? "";

  const patientKey = makePatientKey(patientName, phone, patientAddress);
  const orderKey = makeOrderKey(patientName, productType);
  const searchText = normalizeSearchText(
    [patientName, patientAddress, productType, phone, facilityName, notes, barcode, patientKey, orderKey].join(" ")
  );
  const normalizedName = normalizeSearchText(patientName);
  const normalizedPhone = normalizePhone(phone);
  const normalizedAddress = normalizeSearchText(patientAddress);
  const rawDob = text(orderData.dob);
  const normalizedDob = normalizeSearchText(rawDob);

  const reviewReasons: string[] = [];
  if (!phone) reviewReasons.push("missingPhone");

  const updatePayload: Record<string, unknown> = {
    patientName,
    patientAddress,
    productId,
    productType,
    purchaseCost,
    quantity,
    barcode,
    phone,
    facilityName,
    notes,
    inventoryAllocated: orderData.inventoryAllocated ?? false,
    inventoryRestored: orderData.inventoryRestored ?? false,
    inventoryAllocations: orderData.inventoryAllocations ?? [],
    inventoryAllocationSourceId: orderData.inventoryAllocationSourceId ?? "",
    patientKey,
    orderKey,
    searchText,
    normalizedName,
    normalizedDob,
    normalizedPhone,
    normalizedAddress,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    smartRouteTargets: ["orders", "patients", "analytics"],
    isHospice: orderData.isHospice ?? false,
    linkedPatientId: orderData.linkedPatientId ?? "",
    linkedInventoryId: productId,
    createdBy: orderData.createdBy ?? actor.email ?? actor.uid,
    createdByUid: orderData.createdByUid ?? actor.uid,
    updatedBy: actor.email ?? actor.uid,
    updatedByUid: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (orderData.createdAt) updatePayload.createdAt = orderData.createdAt;
  if (orderData.restoredAt) updatePayload.restoredAt = orderData.restoredAt;
  if (orderData.restoredBy) updatePayload.restoredBy = orderData.restoredBy;
  if (orderData.restoredByUid) updatePayload.restoredByUid = orderData.restoredByUid;
  if (orderData.archivedAt) updatePayload.archivedAt = orderData.archivedAt;
  if (orderData.archivedBy) updatePayload.archivedBy = orderData.archivedBy;
  if (orderData.archivedByUid) updatePayload.archivedByUid = orderData.archivedByUid;

  transaction.update(orderRef, updatePayload);

  completeWorkflowOperation({
    transaction,
    database,
    operationId,
    workflowType,
    actor,
    result: {
      status: "success",
      operationId,
      workflowType,
      orderId,
    },
  });

  return {
    status: "success",
    operationId,
    workflowType,
    orderId,
    orderStatus: text(orderData.status),
  };
}
