import { createHash } from "node:crypto";

import {
  FieldValue,
  type Firestore,
  getFirestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { requireCallableAdmin } from "../auth/roles.js";
import {
  assertOperationId,
  assertSafeDocId,
  claimWorkflowOperation,
  completeWorkflowOperation,
  text,
  writeWorkflowAudit,
} from "../domainWorkflows/shared.js";
import { enforceCallableRateLimit } from "../security/rateLimit.js";
import type { MovementActor } from "./movementService.js";

export const INVENTORY_CLEANUP_ACTIONS = [
  "ASSIGN_CATEGORY",
  "LINK_CANONICAL_PRODUCT",
  "RELINK_PRODUCT_ID",
  "CORRECT_MANUFACTURER",
  "CORRECT_MODEL",
  "CORRECT_PRODUCT_NAME",
  "CORRECT_SERIAL",
  "CORRECT_ASSET_TAG",
  "CORRECT_ASSET_NUMBER",
  "MARK_AS_REVIEWED",
  "DISMISS_FALSE_POSITIVE",
] as const;

export type InventoryCleanupAction = (typeof INVENTORY_CLEANUP_ACTIONS)[number];
export type InventoryCleanupRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type InventoryCleanupMode = "preview" | "apply";

export type InventoryCleanupRequest = {
  mode: InventoryCleanupMode;
  operationId: string;
  action: InventoryCleanupAction;
  inventoryItemId: string;
  targetProductId?: string;
  field?: "category" | "manufacturer" | "modelNumber" | "name" | "serial" | "assetTag" | "assetNumber";
  newValue?: string;
  reason?: string;
  previewToken?: string;
  acknowledgement?: string;
  riskId?: string;
};

export type InventoryCleanupPreview = {
  status: "preview";
  operationId: string;
  workflowType: "inventory.cleanup";
  action: InventoryCleanupAction;
  riskLevel: InventoryCleanupRiskLevel;
  inventoryItemId: string;
  current: Record<string, string>;
  proposed: Record<string, string>;
  diff: Array<{ field: string; before: string; after: string }>;
  affectedRecords: number;
  sideEffects: string[];
  warnings: string[];
  previewToken: string;
  requiresReason: boolean;
  requiresAcknowledgement: boolean;
};

export type InventoryCleanupApplyResult = Omit<InventoryCleanupPreview, "status"> & {
  status: "success" | "duplicate_operation";
  auditWritten: boolean;
  changedFields: string[];
};

type InventoryDoc = Record<string, unknown>;

const WORKFLOW_TYPE = "inventory.cleanup";
const HIGH_RISK_ACKNOWLEDGEMENT = "I understand this changes serialized asset identity.";
const OPERATION_COLLECTION = "domainWorkflowOperations";
const REVIEW_COLLECTION = "inventoryGroupingRiskReviews";

const ACTION_RISK: Record<InventoryCleanupAction, InventoryCleanupRiskLevel> = {
  ASSIGN_CATEGORY: "LOW",
  LINK_CANONICAL_PRODUCT: "MEDIUM",
  RELINK_PRODUCT_ID: "MEDIUM",
  CORRECT_MANUFACTURER: "LOW",
  CORRECT_MODEL: "LOW",
  CORRECT_PRODUCT_NAME: "LOW",
  CORRECT_SERIAL: "HIGH",
  CORRECT_ASSET_TAG: "HIGH",
  CORRECT_ASSET_NUMBER: "HIGH",
  MARK_AS_REVIEWED: "LOW",
  DISMISS_FALSE_POSITIVE: "LOW",
};

const CATEGORY_NAMES = new Set([
  "Oxygen Equipment",
  "CPAP / PAP",
  "Respiratory",
  "Mobility",
  "Hospital Beds",
  "Patient Room Equipment",
  "Bathroom Safety",
  "Supplies",
  "Accessories / Replacement Parts",
  "Uncategorized",
]);

function database(): Firestore {
  return getFirestore();
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function actionFrom(value: unknown): InventoryCleanupAction {
  if (typeof value !== "string" || !INVENTORY_CLEANUP_ACTIONS.includes(value as InventoryCleanupAction)) {
    throw new HttpsError("invalid-argument", "Invalid cleanup action.");
  }
  return value as InventoryCleanupAction;
}

function modeFrom(value: unknown): InventoryCleanupMode {
  if (value === "preview" || value === "apply") return value;
  throw new HttpsError("invalid-argument", "Cleanup mode must be preview or apply.");
}

function fingerprint(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stateForHash(inventoryItemId: string, inventory: InventoryDoc): Record<string, unknown> {
  return {
    inventoryItemId,
    productId: clean(inventory.productId),
    category: clean(inventory.category),
    name: clean(inventory.name),
    manufacturer: clean(inventory.manufacturer),
    modelNumber: clean(inventory.modelNumber),
    sku: clean(inventory.sku),
    hcpc: clean(inventory.hcpc ?? inventory.hcpcs),
    serial: clean(inventory.serial ?? inventory.serialNumber),
    assetTag: clean(inventory.assetTag),
    assetNumber: clean(inventory.assetNumber),
    quantityOnHand: inventory.quantityOnHand ?? 0,
    available: inventory.available ?? 0,
    onRent: inventory.onRent ?? 0,
    status: clean(inventory.status),
    isDeleted: inventory.isDeleted === true || inventory.deleted === true,
  };
}

function previewTokenFor(params: {
  request: InventoryCleanupRequest;
  inventoryItemId: string;
  inventory: InventoryDoc;
  proposed: Record<string, string>;
}): string {
  return fingerprint({
    operationId: params.request.operationId,
    action: params.request.action,
    inventoryItemId: params.inventoryItemId,
    targetProductId: clean(params.request.targetProductId),
    field: clean(params.request.field),
    newValue: clean(params.request.newValue),
    current: stateForHash(params.inventoryItemId, params.inventory),
    proposed: params.proposed,
  });
}

function fieldForAction(action: InventoryCleanupAction, requestedField?: InventoryCleanupRequest["field"]): InventoryCleanupRequest["field"] | null {
  switch (action) {
    case "ASSIGN_CATEGORY":
      return "category";
    case "CORRECT_MANUFACTURER":
      return "manufacturer";
    case "CORRECT_MODEL":
      return "modelNumber";
    case "CORRECT_PRODUCT_NAME":
      return "name";
    case "CORRECT_SERIAL":
      return "serial";
    case "CORRECT_ASSET_TAG":
      return "assetTag";
    case "CORRECT_ASSET_NUMBER":
      return "assetNumber";
    case "LINK_CANONICAL_PRODUCT":
    case "RELINK_PRODUCT_ID":
    case "MARK_AS_REVIEWED":
    case "DISMISS_FALSE_POSITIVE":
      return null;
    default:
      return requestedField ?? null;
  }
}

function currentView(inventoryItemId: string, inventory: InventoryDoc): Record<string, string> {
  return {
    inventoryItemId,
    name: clean(inventory.name) || "Unknown Product",
    productId: clean(inventory.productId),
    category: clean(inventory.category),
    manufacturer: clean(inventory.manufacturer),
    modelNumber: clean(inventory.modelNumber),
    sku: clean(inventory.sku),
    hcpc: clean(inventory.hcpc ?? inventory.hcpcs),
    serial: clean(inventory.serial ?? inventory.serialNumber),
    assetTag: clean(inventory.assetTag),
    assetNumber: clean(inventory.assetNumber),
    status: clean(inventory.status),
    locationName: clean(inventory.locationName),
  };
}

function diffFor(current: Record<string, string>, proposed: Record<string, string>) {
  return Object.keys(proposed)
    .filter((field) => current[field] !== proposed[field])
    .sort()
    .map((field) => ({
      field,
      before: current[field] ?? "",
      after: proposed[field] ?? "",
    }));
}

function assertReasonAndAcknowledgement(input: InventoryCleanupRequest): void {
  const risk = ACTION_RISK[input.action];
  if ((risk === "MEDIUM" || risk === "HIGH") && !clean(input.reason)) {
    throw new HttpsError("invalid-argument", "A reason is required for this cleanup action.");
  }
  if (risk === "HIGH" && clean(input.acknowledgement) !== HIGH_RISK_ACKNOWLEDGEMENT) {
    throw new HttpsError("failed-precondition", "Explicit serialized-identity acknowledgement is required.");
  }
}

async function assertNoDuplicateIdentifier(params: {
  database: Firestore;
  inventoryItemId: string;
  field: "serial" | "assetTag" | "assetNumber";
  value: string;
}): Promise<void> {
  if (!params.value) return;
  const snap = await params.database
    .collection("inventory")
    .where(params.field, "==", params.value)
    .limit(10)
    .get();
  const duplicate = snap.docs.find((docSnap) => {
    const data = docSnap.data() as InventoryDoc;
    const active = data.isDeleted !== true && data.deleted !== true && clean(data.status) !== "inactive" && clean(data.status) !== "discontinued";
    return active && docSnap.id !== params.inventoryItemId;
  });
  if (duplicate) {
    throw new HttpsError("failed-precondition", `Identifier already exists on active inventory record ${duplicate.id}.`);
  }
}

async function buildPreview(
  input: InventoryCleanupRequest,
  databaseInstance: Firestore,
): Promise<InventoryCleanupPreview> {
  assertOperationId(input.operationId);
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  const inventoryRef = databaseInstance.collection("inventory").doc(input.inventoryItemId);
  const inventorySnap = await inventoryRef.get();
  if (!inventorySnap.exists) {
    throw new HttpsError("not-found", "Inventory item was not found.");
  }
  const inventory = inventorySnap.data() as InventoryDoc;
  if (inventory.isDeleted === true || inventory.deleted === true) {
    throw new HttpsError("failed-precondition", "Deleted inventory cannot be cleaned up.");
  }

  const current = currentView(inventorySnap.id, inventory);
  const proposed = { ...current };
  const warnings: string[] = [];
  const field = fieldForAction(input.action, input.field);

  if (input.action === "ASSIGN_CATEGORY") {
    const category = clean(input.newValue);
    if (!CATEGORY_NAMES.has(category)) {
      throw new HttpsError("invalid-argument", "Category is not a recognized cleanup category.");
    }
    proposed.category = category;
  } else if (input.action === "LINK_CANONICAL_PRODUCT" || input.action === "RELINK_PRODUCT_ID") {
    const targetProductId = clean(input.targetProductId);
    if (!targetProductId) throw new HttpsError("invalid-argument", "targetProductId is required.");
    assertSafeDocId(targetProductId, "targetProductId");
    const productSnap = await databaseInstance.collection("products").doc(targetProductId).get();
    if (!productSnap.exists) throw new HttpsError("not-found", "Target product was not found.");
    const product = productSnap.data() as InventoryDoc;
    if (product.deleted === true || product.isDeleted === true || clean(product.status) === "inactive" || clean(product.status) === "discontinued") {
      throw new HttpsError("failed-precondition", "Target product is inactive, discontinued, or deleted.");
    }
    proposed.productId = targetProductId;
    proposed.name = clean(product.name) || clean(product.productName) || current.name;
    proposed.category = clean(product.category) || current.category;
    proposed.manufacturer = clean(product.manufacturer) || clean(product.brand) || current.manufacturer;
    proposed.modelNumber = clean(product.modelNumber) || clean(product.model) || current.modelNumber;
    proposed.sku = clean(product.sku) || current.sku;
    proposed.hcpc = clean(product.hcpc ?? product.hcpcs) || current.hcpc;
    for (const compareField of ["manufacturer", "modelNumber", "sku", "hcpc"] as const) {
      if (current[compareField] && proposed[compareField] && current[compareField].toLowerCase() !== proposed[compareField].toLowerCase()) {
        warnings.push(`${compareField} differs between inventory and target product.`);
      }
    }
  } else if (field) {
    const value = clean(input.newValue);
    if (!value) throw new HttpsError("invalid-argument", "newValue is required.");
    if (["serial", "assetTag", "assetNumber"].includes(field)) {
      await assertNoDuplicateIdentifier({
        database: databaseInstance,
        inventoryItemId: input.inventoryItemId,
        field: field as "serial" | "assetTag" | "assetNumber",
        value,
      });
    }
    proposed[field] = value;
  } else if (input.action === "MARK_AS_REVIEWED" || input.action === "DISMISS_FALSE_POSITIVE") {
    if (!clean(input.riskId)) throw new HttpsError("invalid-argument", "riskId is required.");
  } else {
    throw new HttpsError("invalid-argument", "Unsupported cleanup action.");
  }

  const diff = diffFor(current, proposed);
  if (diff.length === 0 && input.action !== "MARK_AS_REVIEWED" && input.action !== "DISMISS_FALSE_POSITIVE") {
    throw new HttpsError("failed-precondition", "Cleanup request does not change any fields.");
  }

  return {
    status: "preview",
    operationId: input.operationId,
    workflowType: WORKFLOW_TYPE,
    action: input.action,
    riskLevel: ACTION_RISK[input.action],
    inventoryItemId: input.inventoryItemId,
    current,
    proposed,
    diff,
    affectedRecords: 1,
    sideEffects: [
      "No stock quantity change.",
      "No inventory movement is created.",
      "No rental state change.",
      "No patient-equipment state change.",
    ],
    warnings,
    previewToken: previewTokenFor({ request: input, inventoryItemId: input.inventoryItemId, inventory, proposed }),
    requiresReason: ["MEDIUM", "HIGH"].includes(ACTION_RISK[input.action]),
    requiresAcknowledgement: ACTION_RISK[input.action] === "HIGH",
  };
}

function updateForPreview(preview: InventoryCleanupPreview): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const change of preview.diff) {
    update[change.field] = change.after;
  }
  return update;
}

function requestFingerprint(input: InventoryCleanupRequest): Record<string, unknown> {
  return {
    action: input.action,
    inventoryItemId: input.inventoryItemId,
    targetProductId: clean(input.targetProductId),
    field: clean(input.field),
    newValue: clean(input.newValue),
    reason: clean(input.reason),
    riskId: clean(input.riskId),
    previewToken: clean(input.previewToken),
  };
}

export async function previewInventoryCleanup(
  input: InventoryCleanupRequest,
  databaseInstance: Firestore = database(),
): Promise<InventoryCleanupPreview> {
  return buildPreview(input, databaseInstance);
}

export async function applyInventoryCleanup(
  input: InventoryCleanupRequest,
  actor: MovementActor,
  databaseInstance: Firestore = database(),
): Promise<InventoryCleanupApplyResult> {
  assertReasonAndAcknowledgement(input);
  assertOperationId(input.operationId);

  const existingOperation = await databaseInstance
    .collection(OPERATION_COLLECTION)
    .doc(`${actor.uid}_${input.operationId}`)
    .get();
  if (existingOperation.exists) {
    const data = existingOperation.data() as {
      requestFingerprint?: unknown;
      result?: {
        metadata?: {
          preview?: InventoryCleanupPreview;
          changedFields?: unknown;
        };
      };
    };
    if (text(data.requestFingerprint) !== JSON.stringify(requestFingerprint(input))) {
      throw new HttpsError("failed-precondition", "Operation ID was already used with different cleanup input.");
    }
    const storedPreview = data.result?.metadata?.preview;
    if (storedPreview && typeof storedPreview === "object") {
      const changedFields = Array.isArray(data.result?.metadata?.changedFields)
        ? data.result?.metadata?.changedFields.filter((field): field is string => typeof field === "string")
        : storedPreview.diff.map((change) => change.field);
      return {
        ...storedPreview,
        status: "duplicate_operation",
        auditWritten: true,
        changedFields,
      };
    }
  }

  const preview = await buildPreview(input, databaseInstance);
  if (!clean(input.previewToken) || input.previewToken !== preview.previewToken) {
    throw new HttpsError("failed-precondition", "Cleanup preview is stale. Refresh the preview and try again.");
  }

  return databaseInstance.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database: databaseInstance,
      operationId: input.operationId,
      workflowType: WORKFLOW_TYPE,
      actor,
      fingerprint: requestFingerprint(input),
    });

    if (claimed.duplicate) {
      return {
        ...preview,
        ...(claimed.result.metadata?.preview && typeof claimed.result.metadata.preview === "object"
          ? (claimed.result.metadata.preview as InventoryCleanupPreview)
          : {}),
        status: "duplicate_operation",
        auditWritten: true,
        changedFields: preview.diff.map((change) => change.field),
      };
    }

    const inventoryRef = databaseInstance.collection("inventory").doc(input.inventoryItemId);
    const inventorySnap = await transaction.get(inventoryRef);
    if (!inventorySnap.exists) throw new HttpsError("not-found", "Inventory item was not found.");
    const currentToken = previewTokenFor({
      request: input,
      inventoryItemId: input.inventoryItemId,
      inventory: inventorySnap.data() as InventoryDoc,
      proposed: preview.proposed,
    });
    if (currentToken !== input.previewToken) {
      throw new HttpsError("failed-precondition", "Inventory record changed after preview.");
    }

    if (input.action === "MARK_AS_REVIEWED" || input.action === "DISMISS_FALSE_POSITIVE") {
      const reviewId = fingerprint({
        inventoryItemId: input.inventoryItemId,
        riskId: clean(input.riskId),
      }).slice(0, 32);
      transaction.set(databaseInstance.collection(REVIEW_COLLECTION).doc(reviewId), {
        inventoryItemId: input.inventoryItemId,
        riskId: clean(input.riskId),
        status: input.action === "MARK_AS_REVIEWED" ? "reviewed" : "false_positive",
        reason: clean(input.reason),
        actorUid: actor.uid,
        actorEmail: actor.email,
        operationId: input.operationId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      transaction.update(inventoryRef, {
        ...updateForPreview(preview),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: actor.uid,
        updatedByEmail: actor.email,
        lastCleanupOperationId: input.operationId,
      });
    }

    const result: InventoryCleanupApplyResult = {
      ...preview,
      status: "success",
      auditWritten: true,
      changedFields: preview.diff.map((change) => change.field),
    };

    completeWorkflowOperation({
      transaction,
      database: databaseInstance,
      operationId: input.operationId,
      workflowType: WORKFLOW_TYPE,
      actor,
      result: {
        status: "success",
        operationId: input.operationId,
        workflowType: WORKFLOW_TYPE,
        movementIds: [],
        metadata: {
          action: input.action,
          inventoryItemId: input.inventoryItemId,
          changedFields: result.changedFields,
          preview,
        },
      },
    });

    writeWorkflowAudit({
      transaction,
      database: databaseInstance,
      actor,
      action: "inventory.cleanup",
      targetCollection: input.action === "MARK_AS_REVIEWED" || input.action === "DISMISS_FALSE_POSITIVE"
        ? REVIEW_COLLECTION
        : "inventory",
      targetId: input.inventoryItemId,
      details: {
        operationId: input.operationId,
        cleanupAction: input.action,
        field: clean(input.field),
        targetProductId: clean(input.targetProductId),
        oldValues: Object.fromEntries(preview.diff.map((change) => [change.field, change.before])),
        newValues: Object.fromEntries(preview.diff.map((change) => [change.field, change.after])),
        reason: clean(input.reason),
      },
    });

    return result;
  });
}

function parseCleanupRequest(data: unknown): InventoryCleanupRequest {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }
  const source = data as Record<string, unknown>;
  const action = actionFrom(source.action);
  const operationId = clean(source.operationId);
  assertOperationId(operationId);
  const inventoryItemId = clean(source.inventoryItemId);
  assertSafeDocId(inventoryItemId, "inventoryItemId");

  return {
    mode: modeFrom(source.mode),
    operationId,
    action,
    inventoryItemId,
    targetProductId: clean(source.targetProductId),
    field: clean(source.field) as InventoryCleanupRequest["field"],
    newValue: clean(source.newValue),
    reason: clean(source.reason),
    previewToken: clean(source.previewToken),
    acknowledgement: clean(source.acknowledgement),
    riskId: clean(source.riskId),
  };
}

export const inventoryCleanupWorkflowCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "admin");
    const role = await requireCallableAdmin(
      request.auth
        ? {
            uid: request.auth.uid,
            token: request.auth.token as Record<string, unknown>,
          }
        : undefined,
      "Admin access is required for inventory cleanup.",
    );
    if (role !== "admin") {
      throw new HttpsError("permission-denied", "Admin access is required for inventory cleanup.");
    }
    const actor: MovementActor = {
      uid: request.auth!.uid,
      email: String((request.auth!.token as Record<string, unknown>)?.email ?? request.auth!.uid),
      role,
    };
    const input = parseCleanupRequest(request.data);

    if (input.mode === "preview") {
      return previewInventoryCleanup(input);
    }

    return applyInventoryCleanup(input, actor);
  },
);
