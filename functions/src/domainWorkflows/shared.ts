import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import type { MovementActor } from "../inventory/movementService.js";

export type WorkflowStatus =
  | "success"
  | "duplicate_operation"
  | "not_found"
  | "invalid"
  | "permission_denied"
  | "invalid_state"
  | "insufficient_quantity"
  | "asset_unavailable"
  | "dependency_conflict"
  | "validation_error";

export type WorkflowResult = {
  status: WorkflowStatus;
  operationId: string;
  workflowType: string;
  code?: string;
  message?: string;
  movementIds?: string[];
  rentalId?: string;
  assignmentId?: string;
  metadata?: Record<string, unknown>;
  orderId?: string;
  orderStatus?: string;
  inventoryAllocated?: boolean;
  inventoryRestored?: boolean;
  allocations?: Array<{ inventoryItemId: string; quantity: number; movementId?: string }>;
  restoredQuantity?: number;
};

export const DELIVERY_LINE_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(["loaded", "failed"]),
  loaded: new Set(["partially_delivered", "delivered", "returned", "failed"]),
  partially_delivered: new Set(["delivered", "returned", "failed"]),
  delivered: new Set([]),
  returned: new Set([]),
  failed: new Set(["loaded"]),
};

export const RENTAL_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["active", "cancelled"]),
  available: new Set(["checked_out", "cancelled", "retired", "maintenance"]),
  checked_out: new Set(["available", "returned", "exchanged", "extended", "overdue"]),
  overdue: new Set(["available", "returned", "exchanged", "extended"]),
  maintenance: new Set(["available", "retired"]),
  retired: new Set([]),
  active: new Set(["returned", "exchanged", "extended", "closed"]),
  extended: new Set(["returned", "exchanged", "closed"]),
  exchanged: new Set(["returned", "closed"]),
  returned: new Set(["closed"]),
  cancelled: new Set([]),
  closed: new Set([]),
};

export const EQUIPMENT_ASSIGNMENT_TRANSITIONS: Record<string, Set<string>> = {
  active: new Set(["removed", "transferred", "lost", "damaged", "returned", "recovered"]),
  transferred: new Set([]),
  removed: new Set([]),
  lost: new Set(["recovered"]),
  damaged: new Set(["returned"]),
  recovered: new Set(["returned"]),
  returned: new Set([]),
};

export const PATIENT_LIFECYCLE_TRANSITIONS: Record<string, Set<string>> = {
  active: new Set(["archived"]),
  archived: new Set(["active", "destroyed"]),
  destroyed: new Set([]),
};

export const DELIVERY_SIGNATURE_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(["signed", "refused"]),
  unsigned: new Set(["signed", "refused"]),
  signed: new Set([]),
  refused: new Set([]),
};

export const DELIVERY_EVIDENCE_TRANSITIONS: Record<string, Set<string>> = {
  none: new Set(["recorded"]),
  recorded: new Set(["recorded"]),
};

const OPERATION_ID_PATTERN = /^[a-zA-Z0-9_-]{8,160}$/;
const SAFE_DOC_ID_PATTERN = /^[^/.][^/]{0,159}$/;
const pendingWorkflowFingerprints = new WeakMap<Transaction, Map<string, string>>();

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

export function assertSafeDocId(value: string, label: string): void {
  if (!SAFE_DOC_ID_PATTERN.test(value) || value === "." || value === "..") {
    throw new HttpsError("invalid-argument", `${label} is not a safe document ID.`);
  }
}

export function assertOperationId(operationId: string): void {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new HttpsError("invalid-argument", "Invalid operationId.");
  }
}

export function assertAdmin(actor: MovementActor): void {
  if (actor.role !== "admin" && actor.role !== "tank") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
}

export function assertTransition(
  map: Record<string, Set<string>>,
  current: string,
  next: string,
  label: string
): void {
  const normalizedCurrent = current || "pending";
  if (!map[normalizedCurrent]?.has(next)) {
    throw new HttpsError(
      "failed-precondition",
      `Invalid ${label} state transition: ${normalizedCurrent} -> ${next}.`
    );
  }
}

export async function claimWorkflowOperation(params: {
  transaction: Transaction;
  database: Firestore;
  operationId: string;
  workflowType: string;
  actor: MovementActor;
  fingerprint: Record<string, unknown> | string;
}): Promise<{ duplicate: false } | { duplicate: true; result: WorkflowResult }> {
  const { transaction, database, operationId, workflowType, actor, fingerprint } = params;
  assertOperationId(operationId);
  const ref = database.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`);
  const snap = await transaction.get(ref);
  const requestFingerprint = typeof fingerprint === "string" ? fingerprint : JSON.stringify(fingerprint);

  if (snap.exists) {
    const data = snap.data() ?? {};
    if (text(data.requestFingerprint) && text(data.requestFingerprint) !== requestFingerprint) {
      throw new HttpsError(
        "failed-precondition",
        "This operationId was already used with different workflow data."
      );
    }

    const storedResult = data.result && typeof data.result === "object"
      ? (data.result as WorkflowResult)
      : null;

    return {
      duplicate: true,
      result: {
        ...(storedResult ?? {}),
        status: "duplicate_operation",
        operationId,
        workflowType,
        code: "duplicate_operation",
        message: "Workflow operation already applied.",
        movementIds: Array.isArray(data.movementIds) ? data.movementIds.map(String) : storedResult?.movementIds ?? [],
      },
    };
  }

  let pending = pendingWorkflowFingerprints.get(transaction);
  if (!pending) {
    pending = new Map<string, string>();
    pendingWorkflowFingerprints.set(transaction, pending);
  }
  pending.set(ref.path, requestFingerprint);

  return { duplicate: false };
}

export function completeWorkflowOperation(params: {
  transaction: Transaction;
  database: Firestore;
  operationId: string;
  workflowType: string;
  actor: MovementActor;
  result: WorkflowResult;
}): void {
  const { transaction, database, operationId, workflowType, actor, result } = params;
  const ref = database.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`);
  const requestFingerprint = pendingWorkflowFingerprints.get(transaction)?.get(ref.path);
  transaction.set(
    ref,
    {
      operationId,
      workflowType,
      ...(requestFingerprint ? { requestFingerprint } : {}),
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      status: "completed",
      result,
      movementIds: result.movementIds ?? [],
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  pendingWorkflowFingerprints.get(transaction)?.delete(ref.path);
}

export function writeWorkflowAudit(params: {
  transaction: Transaction;
  database: Firestore;
  actor: MovementActor;
  action: string;
  targetCollection: string;
  targetId: string;
  details: Record<string, unknown>;
}): void {
  const { transaction, database, actor, action, targetCollection, targetId, details } = params;
  transaction.set(database.collection("auditLogs").doc(), {
    action,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetCollection,
    targetId,
    details,
    createdAt: FieldValue.serverTimestamp(),
    success: true,
  });
}
