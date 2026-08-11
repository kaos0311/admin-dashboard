import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  createInventoryMovementInTransaction,
  type InventoryMovementType,
  type MovementActor,
} from "../inventory/movementService.js";
import {
  assertSafeDocId,
  assertTransition,
  claimWorkflowOperation,
  completeWorkflowOperation,
  EQUIPMENT_ASSIGNMENT_TRANSITIONS,
  numberValue,
  text,
  type WorkflowResult,
  writeWorkflowAudit,
} from "./shared.js";

export type PatientEquipmentAction =
  | "assign"
  | "remove"
  | "transfer"
  | "recover_deceased"
  | "replace"
  | "lost"
  | "damaged"
  | "return_to_warehouse";

export type PatientEquipmentWorkflowInput = {
  operationId: string;
  action: PatientEquipmentAction;
  patientId: string;
  toPatientId?: string;
  inventoryItemId: string;
  replacementInventoryItemId?: string;
  productId?: string;
  patientName?: string;
  toPatientName?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  reason?: string;
};

function movementForAction(action: PatientEquipmentAction): InventoryMovementType {
  if (action === "assign" || action === "transfer" || action === "replace") return "patient_assignment";
  if (action === "lost") return "lost";
  if (action === "damaged") return "damaged";
  if (action === "recover_deceased") return "deceased_patient_equipment_return";
  return "rental_return";
}

function inventoryMovementForAction(action: PatientEquipmentAction): InventoryMovementType {
  return action === "transfer" ? "patient_transfer" : movementForAction(action);
}

function nextAssignmentStatus(action: PatientEquipmentAction): string {
  if (action === "assign") return "active";
  if (action === "remove") return "removed";
  if (action === "transfer") return "transferred";
  if (action === "recover_deceased") return "recovered";
  if (action === "return_to_warehouse") return "returned";
  return action;
}

export async function patientEquipmentWorkflow(
  input: PatientEquipmentWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.patientId, "patientId");
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  if (input.toPatientId) assertSafeDocId(input.toPatientId, "toPatientId");
  if (input.replacementInventoryItemId) {
    assertSafeDocId(input.replacementInventoryItemId, "replacementInventoryItemId");
  }

  const workflowType = `patient_equipment.${input.action}`;
  const quantity = Math.max(1, numberValue(input.quantity, 1));

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: { ...input, quantity },
    });
    if (claimed.duplicate) return claimed.result;

    const patientRef = database.collection("patients").doc(input.patientId);
    const patientSnap = await transaction.get(patientRef);
    if (!patientSnap.exists) throw new HttpsError("not-found", "Patient was not found.");
    const toPatientRef = input.toPatientId ? database.collection("patients").doc(input.toPatientId) : null;
    if (input.action === "transfer" && !toPatientRef) {
      throw new HttpsError("invalid-argument", "toPatientId is required for transfer.");
    }
    const toPatientSnap = toPatientRef ? await transaction.get(toPatientRef) : null;
    if (input.action === "transfer" && !toPatientSnap?.exists) {
      throw new HttpsError("not-found", "Destination patient was not found.");
    }
    const toPatientData = toPatientSnap?.exists ? toPatientSnap.data() ?? {} : {};

    const equipmentRef = patientRef.collection("equipment").doc(input.inventoryItemId);
    const equipmentSnap = await transaction.get(equipmentRef);
    const existingEquipment = equipmentSnap.data() ?? {};
    const currentAssignmentStatus = text(existingEquipment.status) || "active";
    const nextStatus = nextAssignmentStatus(input.action);

    if (input.action !== "assign") {
      if (!equipmentSnap.exists) {
        throw new HttpsError("failed-precondition", "Equipment assignment was not found.");
      }
      assertTransition(
        EQUIPMENT_ASSIGNMENT_TRANSITIONS,
        currentAssignmentStatus,
        nextStatus,
        "patient equipment assignment"
      );
    }

    if (input.action === "assign") {
      const activeSnap = await transaction.get(
        database.collectionGroup("equipment").where("inventoryId", "==", input.inventoryItemId).where("status", "==", "active").limit(2)
      );
      if (!activeSnap.empty) {
        throw new HttpsError("failed-precondition", "Serialized asset is already assigned to a patient.");
      }
    }

    if (input.action === "replace") {
      if (!input.replacementInventoryItemId) {
        throw new HttpsError("invalid-argument", "replacementInventoryItemId is required.");
      }

      const returnMovement = await createInventoryMovementInTransaction({
        transaction,
        database,
        actor,
        input: {
          operationId: `${input.operationId}-return`,
          movementType: "rental_return",
          inventoryItemId: input.inventoryItemId,
          productId: input.productId,
          barcode: input.barcode,
          serialNumber: input.serialNumber,
          lotNumber: input.lotNumber,
          quantity,
          patientId: input.patientId,
          patientName: input.patientName,
          reason: input.reason || "Patient equipment replacement returned old asset.",
          source: "patient",
          correlationId: input.patientId,
          metadata: {
            patientId: input.patientId,
            replacementInventoryItemId: input.replacementInventoryItemId,
            action: input.action,
            replacementSide: "return",
          },
        },
      });
      if (returnMovement.status !== "success" && returnMovement.status !== "duplicate_operation") {
        throw new HttpsError("failed-precondition", returnMovement.message || "Replacement return movement failed.");
      }

      const assignMovement = await createInventoryMovementInTransaction({
        transaction,
        database,
        actor,
        input: {
          operationId: `${input.operationId}-assign`,
          movementType: "patient_assignment",
          inventoryItemId: input.replacementInventoryItemId,
          quantity,
          patientId: input.patientId,
          patientName: input.patientName,
          reason: input.reason || "Patient equipment replacement assigned new asset.",
          source: "patient",
          correlationId: input.patientId,
          metadata: {
            patientId: input.patientId,
            replacesInventoryItemId: input.inventoryItemId,
            action: input.action,
            replacementSide: "assign",
          },
        },
      });
      if (assignMovement.status !== "success" && assignMovement.status !== "duplicate_operation") {
        throw new HttpsError("failed-precondition", assignMovement.message || "Replacement assignment movement failed.");
      }

      transaction.set(
        equipmentRef,
        {
          inventoryId: input.inventoryItemId,
          productId: text(input.productId) || text(existingEquipment.productId),
          barcode: text(input.barcode) || text(existingEquipment.barcode),
          serialNumber: text(input.serialNumber) || text(existingEquipment.serialNumber),
          lotNumber: text(input.lotNumber) || text(existingEquipment.lotNumber),
          status: "returned",
          closedAt: FieldValue.serverTimestamp(),
          closedByUid: actor.uid,
          closedByEmail: actor.email,
          closeReason: text(input.reason),
          replacementInventoryItemId: input.replacementInventoryItemId,
          movementId: returnMovement.movementId ?? "",
          updatedAt: FieldValue.serverTimestamp(),
          systemGenerated: true,
        },
        { merge: true }
      );

      transaction.set(patientRef.collection("equipment").doc(input.replacementInventoryItemId), {
        inventoryId: input.replacementInventoryItemId,
        status: "active",
        replacesInventoryItemId: input.inventoryItemId,
        assignedAt: FieldValue.serverTimestamp(),
        assignedByUid: actor.uid,
        assignedByEmail: actor.email,
        movementId: assignMovement.movementId ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });

      transaction.set(patientRef.collection("timeline").doc(input.operationId), {
        type: "equipment_replace",
        title: "Equipment replaced",
        body: text(input.reason) || "Patient equipment was replaced.",
        metadata: {
          inventoryItemId: input.inventoryItemId,
          replacementInventoryItemId: input.replacementInventoryItemId,
          returnMovementId: returnMovement.movementId ?? "",
          assignMovementId: assignMovement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });

      const movementIds = [returnMovement.movementId, assignMovement.movementId].filter(Boolean) as string[];
      const result: WorkflowResult = {
        status: "success",
        operationId: input.operationId,
        workflowType,
        movementIds,
      };
      completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
      writeWorkflowAudit({
        transaction,
        database,
        actor,
        action: workflowType,
        targetCollection: "patients",
        targetId: input.patientId,
        details: {
          operationId: input.operationId,
          inventoryItemId: input.inventoryItemId,
          replacementInventoryItemId: input.replacementInventoryItemId,
          action: input.action,
          movementIds,
        },
      });
      return result;
    }

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-movement`,
        movementType: inventoryMovementForAction(input.action),
        inventoryItemId: input.inventoryItemId,
        productId: input.productId,
        barcode: input.barcode,
        serialNumber: input.serialNumber,
        lotNumber: input.lotNumber,
        quantity,
        patientId: input.action === "transfer" ? text(input.toPatientId) : input.patientId,
        patientName:
          input.action === "transfer"
            ? text(input.toPatientName) || text(toPatientData.fullName) || text(toPatientData.patientName)
            : input.patientName,
        reason: input.reason || `Patient equipment ${input.action}.`,
        source: input.action === "recover_deceased" ? "deceased_pickup" : "patient",
        correlationId: input.action === "transfer" ? text(input.toPatientId) : input.patientId,
        metadata: {
          patientId: input.patientId,
          toPatientId: text(input.toPatientId),
          action: input.action,
        },
      },
    });
    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", movement.message || "Patient equipment movement failed.");
    }

    const baseEquipment = {
      inventoryId: input.inventoryItemId,
      productId: text(input.productId) || text(existingEquipment.productId),
      barcode: text(input.barcode) || text(existingEquipment.barcode),
      serialNumber: text(input.serialNumber) || text(existingEquipment.serialNumber),
      lotNumber: text(input.lotNumber) || text(existingEquipment.lotNumber),
      movementId: movement.movementId ?? "",
      updatedAt: FieldValue.serverTimestamp(),
      systemGenerated: true,
    };

    if (input.action === "assign") {
      transaction.set(
        equipmentRef,
        {
          ...baseEquipment,
          status: "active",
          assignedAt: FieldValue.serverTimestamp(),
          assignedByUid: actor.uid,
          assignedByEmail: actor.email,
        },
        { merge: true }
      );
    } else {
      transaction.set(
        equipmentRef,
        {
          ...baseEquipment,
          status: nextStatus,
          closedAt: FieldValue.serverTimestamp(),
          closedByUid: actor.uid,
          closedByEmail: actor.email,
          closeReason: text(input.reason),
        },
        { merge: true }
      );
    }

    if (input.action === "transfer" && toPatientRef) {
      transaction.set(
        toPatientRef.collection("equipment").doc(input.inventoryItemId),
        {
          ...baseEquipment,
          status: "active",
          transferredFromPatientId: input.patientId,
          transferredAt: FieldValue.serverTimestamp(),
          transferredByUid: actor.uid,
          transferredByEmail: actor.email,
          assignedAt: FieldValue.serverTimestamp(),
          assignedByUid: actor.uid,
          assignedByEmail: actor.email,
        },
        { merge: true }
      );
      transaction.set(toPatientRef.collection("timeline").doc(input.operationId), {
        type: "equipment_transfer_received",
        title: "Equipment transfer received",
        body: text(input.reason) || "Patient equipment was transferred to this patient.",
        metadata: {
          inventoryItemId: input.inventoryItemId,
          fromPatientId: input.patientId,
          movementId: movement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    }

    transaction.set(patientRef.collection("timeline").doc(input.operationId), {
      type: `equipment_${input.action}`,
      title: `Equipment ${input.action.replace(/_/g, " ")}`,
      body: text(input.reason) || "Patient equipment workflow completed.",
      metadata: {
        inventoryItemId: input.inventoryItemId,
        replacementInventoryItemId: text(input.replacementInventoryItemId),
        toPatientId: text(input.toPatientId),
        movementId: movement.movementId ?? "",
      },
      actorUid: actor.uid,
      actorEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
      systemGenerated: true,
    });

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
      movementIds: movement.movementId ? [movement.movementId] : [],
    };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: workflowType,
      targetCollection: "patients",
      targetId: input.patientId,
      details: {
        operationId: input.operationId,
        inventoryItemId: input.inventoryItemId,
        action: input.action,
        movementId: movement.movementId ?? "",
      },
    });
    return result;
  });
}
