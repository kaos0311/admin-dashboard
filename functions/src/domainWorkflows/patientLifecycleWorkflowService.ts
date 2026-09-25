import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import type { MovementActor } from "../inventory/movementService.js";
import {
  assertAdmin,
  assertSafeDocId,
  assertTransition,
  claimWorkflowOperation,
  completeWorkflowOperation,
  PATIENT_LIFECYCLE_TRANSITIONS,
  text,
  type WorkflowResult,
  writeWorkflowAudit,
} from "./shared.js";

export type PatientLifecycleAction = "archive" | "restore" | "destroy";

export type PatientLifecycleInput = {
  operationId: string;
  patientId: string;
  action: PatientLifecycleAction;
  reason?: string;
  dryRun?: boolean;
  confirmationToken?: string;
};

async function dependencyReport(database: Firestore, patientId: string) {
  const [rentals, equipment, deliveries, documents] = await Promise.all([
    database
      .collection("rentals")
      .where("patientId", "==", patientId)
      .where("status", "in", ["checked_out", "overdue", "active", "extended"])
      .limit(10)
      .get(),
    database
      .collection("patients")
      .doc(patientId)
      .collection("equipment")
      .where("status", "==", "active")
      .limit(10)
      .get(),
    database
      .collection("patientDeliveryTickets")
      .where("patientKey", "==", patientId)
      .where("fulfillmentStatus", "in", ["needs_load", "loading", "loaded", "delivering"])
      .limit(10)
      .get(),
    database.collection("patients").doc(patientId).collection("documents").limit(1).get(),
  ]);

  return {
    activeRentalIds: rentals.docs.map((doc) => doc.id),
    activeEquipmentIds: equipment.docs.map((doc) => doc.id),
    unresolvedDeliveryIds: deliveries.docs.map((doc) => doc.id),
    hasDocuments: !documents.empty,
  };
}

function hasBlockingDependencies(report: Awaited<ReturnType<typeof dependencyReport>>, includeDocuments: boolean): boolean {
  return (
    report.activeRentalIds.length > 0 ||
    report.activeEquipmentIds.length > 0 ||
    report.unresolvedDeliveryIds.length > 0 ||
    (includeDocuments && report.hasDocuments)
  );
}

export async function patientLifecycleWorkflow(
  input: PatientLifecycleInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult & { dependencyReport?: Awaited<ReturnType<typeof dependencyReport>> }> {
  assertSafeDocId(input.patientId, "patientId");
  if (input.action === "destroy") assertAdmin(actor);
  const workflowType = `patient.${input.action}`;
  const report = await dependencyReport(database, input.patientId);

  if (input.action === "archive" && hasBlockingDependencies(report, false)) {
    throw new HttpsError("failed-precondition", "Patient has active workflow dependencies and cannot be archived.");
  }

  if (input.action === "destroy") {
    if (input.dryRun) {
      return {
        status: "success",
        operationId: input.operationId,
        workflowType,
        message: "Destroy dry-run dependency report generated.",
        movementIds: [],
        dependencyReport: report,
      };
    }
    if (input.confirmationToken !== `DESTROY-${input.patientId}`) {
      throw new HttpsError("failed-precondition", "Destroy confirmation token is required.");
    }
    if (hasBlockingDependencies(report, true)) {
      throw new HttpsError("failed-precondition", "Patient has protected dependencies and cannot be destroyed.");
    }
  }

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: input,
    });
    if (claimed.duplicate) return claimed.result;

    const patientRef = database.collection("patients").doc(input.patientId);
    const patientSnap = await transaction.get(patientRef);
    if (!patientSnap.exists) throw new HttpsError("not-found", "Patient was not found.");
    const patient = patientSnap.data() ?? {};
    const currentStatus = text(patient.status) || "active";
    const nextStatus =
      input.action === "archive" ? "archived" : input.action === "restore" ? "active" : "destroyed";
    assertTransition(PATIENT_LIFECYCLE_TRANSITIONS, currentStatus, nextStatus, "patient lifecycle");

    const statusUpdate: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
      lifecycleUpdatedByUid: actor.uid,
      lifecycleUpdatedByEmail: actor.email,
      lifecycleReason: text(input.reason),
    };
    if (input.action === "archive") statusUpdate.archivedAt = FieldValue.serverTimestamp();
    if (input.action === "restore") statusUpdate.restoredAt = FieldValue.serverTimestamp();
    if (input.action === "destroy") {
      statusUpdate.destroyedAt = FieldValue.serverTimestamp();
      statusUpdate.tombstoned = true;
    }

    transaction.set(patientRef, statusUpdate, { merge: true });
    transaction.set(patientRef.collection("timeline").doc(input.operationId), {
      type: `patient_${input.action}`,
      title:
        input.action === "archive"
          ? "Patient archived"
          : input.action === "restore"
            ? "Patient restored"
            : "Patient marked destroyed",
      body: text(input.reason),
      metadata: {
        previousStatus: currentStatus,
        newStatus: nextStatus,
      },
      actorUid: actor.uid,
      actorEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
      systemGenerated: true,
    });

    const result: WorkflowResult = { status: "success", operationId: input.operationId, workflowType, movementIds: [] };
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
        previousStatus: currentStatus,
        newStatus: nextStatus,
        reason: text(input.reason),
      },
    });
    return result;
  });
}
