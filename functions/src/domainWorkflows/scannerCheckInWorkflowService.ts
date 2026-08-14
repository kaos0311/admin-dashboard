import { type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  type InventoryScanField,
  normalizeScanValue,
  resolveInventoryScan,
} from "../inventory/inventoryScanResolver.js";
import { type MovementActor } from "../inventory/movementService.js";
import { patientEquipmentWorkflow } from "./patientEquipmentWorkflowService.js";
import { returnRentalWorkflow } from "./rentalWorkflowService.js";
import { assertOperationId, text, type WorkflowResult } from "./shared.js";

type InventoryDoc = Record<string, unknown>;

export type EquipmentCheckInByBarcodeInput = {
  operationId: string;
  barcode: string;
  rawScan?: string;
  quantity?: number;
  reason?: string;
};

type ResolvedInventory = {
  id: string;
  data: InventoryDoc;
};

const CHECK_IN_SCAN_FIELDS: InventoryScanField[] = [
  "barcode",
  "serial",
  "serialNumber",
  "lotNumber",
  "sku",
];

const ACTIVE_RENTAL_STATUSES = new Set([
  "active",
  "checked_out",
  "overdue",
  "extended",
  "exchanged",
]);

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function hasExplicitWarehouseCustody(inventory: InventoryDoc): boolean {
  const status = text(inventory.status).toLowerCase();
  const quantityOnHand = numberValue(inventory.quantityOnHand, 0);
  const onRent = numberValue(inventory.onRent, 0);
  const onTruck = numberValue(inventory.onTruck, 0);
  const committed = numberValue(inventory.committed, 0);
  const available = numberValue(inventory.available, quantityOnHand - committed - onRent - onTruck);
  const hasOwnership =
    Boolean(text(inventory.patientId)) ||
    Boolean(text(inventory.patientKey)) ||
    Boolean(text(inventory.rentalId)) ||
    Boolean(text(inventory.assignedTo));

  return status === "available" && quantityOnHand > 0 && onRent === 0 && available > 0 && !hasOwnership;
}

function alreadyInWarehouseResult(operationId: string, inventoryItemId: string): WorkflowResult {
  return {
    status: "success",
    operationId,
    workflowType: "scanner.equipment_check_in",
    code: "already_in_warehouse",
    message: "Equipment is already checked in to warehouse custody.",
    movementIds: [],
    metadata: {
      inventoryItemId,
      custody: "warehouse",
    },
  };
}

async function findInventoryByScan(
  database: Firestore,
  rawScan: string
): Promise<{ status: "found"; item: ResolvedInventory } | { status: "not_found" } | { status: "ambiguous"; count: number }> {
  const parsed = normalizeScanValue(rawScan);
  if (parsed.status === "invalid") {
    throw new HttpsError("invalid-argument", parsed.error ?? "Invalid barcode.");
  }

  const resolved = await resolveInventoryScan(database, parsed.value, {
    fields: CHECK_IN_SCAN_FIELDS,
    includeUppercaseVariant: true,
  });

  if (resolved.kind === "not_found") return { status: "not_found" };
  if (resolved.kind === "ambiguous") {
    return { status: "ambiguous", count: resolved.candidateIds.length };
  }
  return {
    status: "found",
    item: {
      id: resolved.inventoryItemId,
      data: resolved.inventory,
    },
  };
}

async function getExistingWorkflowDuplicate(
  database: Firestore,
  actor: MovementActor,
  operationId: string,
  inventoryItemId: string
): Promise<WorkflowResult | null> {
  const operationRef = database.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`);
  const snap = await operationRef.get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  const workflowType = text(data.workflowType);
  if (workflowType !== "rental.return" && workflowType !== "patient_equipment.return_to_warehouse") {
    throw new HttpsError("failed-precondition", "This operationId was already used with different workflow data.");
  }

  const requestFingerprint = text(data.requestFingerprint);
  if (requestFingerprint) {
    try {
      const parsed = JSON.parse(requestFingerprint) as { inventoryItemId?: unknown };
      if (text(parsed.inventoryItemId) && text(parsed.inventoryItemId) !== inventoryItemId) {
        throw new HttpsError("failed-precondition", "This operationId was already used with different workflow data.");
      }
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("failed-precondition", "This operationId was already used with unreadable workflow data.");
    }
  }

  const stored = data.result && typeof data.result === "object" ? (data.result as WorkflowResult) : null;
  return {
    ...(stored ?? {}),
    status: "duplicate_operation",
    operationId,
    workflowType,
    code: "duplicate_operation",
    message: "Workflow operation already applied.",
    movementIds: Array.isArray(data.movementIds) ? data.movementIds.map(String) : stored?.movementIds ?? [],
  };
}

async function findActiveRentals(database: Firestore, inventoryItemId: string): Promise<Array<{ id: string; data: InventoryDoc }>> {
  const matches: Record<string, InventoryDoc> = {};
  for (const field of ["inventoryItemId", "itemId"]) {
    const snap = await database.collection("rentals").where(field, "==", inventoryItemId).limit(10).get();
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() as InventoryDoc;
      if (ACTIVE_RENTAL_STATUSES.has(text(data.status).toLowerCase())) {
        matches[docSnap.id] = data;
      }
    });
  }
  return Object.entries(matches).map(([id, data]) => ({ id, data }));
}

async function findActivePatientAssignments(
  database: Firestore,
  inventoryItemId: string
): Promise<Array<{ patientId: string; data: InventoryDoc }>> {
  const snap = await database
    .collectionGroup("equipment")
    .where("inventoryId", "==", inventoryItemId)
    .limit(10)
    .get();

  return snap.docs
    .map((docSnap) => {
      const patientRef = docSnap.ref.parent.parent;
      return {
        patientId: patientRef?.id ?? "",
        data: docSnap.data() as InventoryDoc,
      };
    })
    .filter((row) => row.patientId && text(row.data.status).toLowerCase() === "active");
}

export async function equipmentCheckInByBarcodeWorkflow(
  input: EquipmentCheckInByBarcodeInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertOperationId(input.operationId);
  if (!text(input.barcode)) {
    throw new HttpsError("invalid-argument", "Barcode is required.");
  }

  const resolved = await findInventoryByScan(database, input.barcode);
  if (resolved.status === "not_found") {
    throw new HttpsError("not-found", "Inventory item was not found.");
  }
  if (resolved.status === "ambiguous") {
    throw new HttpsError("failed-precondition", "Scan matched multiple inventory items.");
  }

  const inventoryItemId = resolved.item.id;
  const existing = await getExistingWorkflowDuplicate(database, actor, input.operationId, inventoryItemId);
  if (existing) return existing;

  const [rentals, assignments] = await Promise.all([
    findActiveRentals(database, inventoryItemId),
    findActivePatientAssignments(database, inventoryItemId),
  ]);

  if (rentals.length > 1) {
    throw new HttpsError("failed-precondition", "Scanned equipment has ambiguous active ownership.");
  }

  if (rentals.length > 0 && assignments.length > 0) {
    throw new HttpsError("failed-precondition", "Scanned equipment has conflicting active rental and patient ownership.");
  }

  if (rentals.length === 1) {
    const rental = rentals[0];
    const quantity = input.quantity && Number.isFinite(input.quantity) && input.quantity > 0
      ? input.quantity
      : undefined;
    const reason = text(input.reason) || "Scanner equipment check-in.";

    return returnRentalWorkflow(
      {
        operationId: input.operationId,
        rentalId: rental.id,
        inventoryItemId,
        productId: text(rental.data.productId) || text(resolved.item.data.productId),
        patientId: text(rental.data.patientId),
        patientName: text(rental.data.patientName),
        serialNumber: text(rental.data.serialNumber) || text(resolved.item.data.serialNumber) || text(resolved.item.data.serial),
        quantity,
        reason,
      },
      actor,
      database
    );
  }

  if (assignments.length > 1) {
    throw new HttpsError("failed-precondition", "Scanned equipment has ambiguous active ownership.");
  }
  if (assignments.length === 0) {
    if (hasExplicitWarehouseCustody(resolved.item.data)) {
      return alreadyInWarehouseResult(input.operationId, inventoryItemId);
    }
    throw new HttpsError(
      "failed-precondition",
      "Scanned equipment has no active ownership and is not in a provable warehouse state; reconcile before check-in."
    );
  }

  const quantity = input.quantity && Number.isFinite(input.quantity) && input.quantity > 0
    ? input.quantity
    : undefined;
  const reason = text(input.reason) || "Scanner equipment check-in.";
  const assignment = assignments[0];
  return patientEquipmentWorkflow(
    {
      operationId: input.operationId,
      action: "return_to_warehouse",
      patientId: assignment.patientId,
      inventoryItemId,
      productId: text(assignment.data.productId) || text(resolved.item.data.productId),
      patientName: text(assignment.data.patientName),
      barcode: text(resolved.item.data.barcode),
      serialNumber: text(assignment.data.serialNumber) || text(resolved.item.data.serialNumber) || text(resolved.item.data.serial),
      lotNumber: text(assignment.data.lotNumber) || text(resolved.item.data.lotNumber),
      quantity,
      reason,
    },
    actor,
    database
  );
}
