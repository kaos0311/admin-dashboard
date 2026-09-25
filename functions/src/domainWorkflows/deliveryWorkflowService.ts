import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
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
  DELIVERY_EVIDENCE_TRANSITIONS,
  DELIVERY_LINE_TRANSITIONS,
  DELIVERY_SIGNATURE_TRANSITIONS,
  numberValue,
  text,
  type WorkflowResult,
  writeWorkflowAudit,
} from "./shared.js";

export type DeliveryScanMode = "load" | "deliver" | "return";

export type DeliveryWorkflowInput = {
  operationId: string;
  ticketId: string;
  lineId?: string;
  inventoryItemId: string;
  productId?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  mode: DeliveryScanMode;
  patientId?: string;
  patientName?: string;
  deliveryTicketNumber?: string;
  salesOrderNumber?: string;
  vehicleId?: string;
  truckId?: string;
  returnCondition?: string;
  returnNotes?: string;
};

export type DeliverySignatureFinalizeInput = {
  operationId: string;
  ticketId: string;
  patientId?: string;
  signerName: string;
  signerRole: string;
  signerRelationship?: string;
  witnessName?: string;
  refusalReason?: string;
  pendingStoragePath: string;
  pendingDownloadURL?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  checksum?: string;
};

export type DeliveryDamageFinalizeInput = {
  operationId: string;
  ticketId: string;
  patientId?: string;
  files: Array<{
    pendingStoragePath: string;
    pendingDownloadURL?: string;
    fileName: string;
    contentType?: string;
    fileSize?: number;
    checksum?: string;
  }>;
  damageNotes?: string;
  returnCondition?: string;
};

export type DeliveryRouteInput = {
  operationId: string;
  ticketId: string;
  etaMinutes?: number;
  routeSequence?: number;
  routeStatus?: string;
  routeNotes?: string;
};

export type DeliveryTechCheckInInput = {
  operationId: string;
  ticketId: string;
  techName: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
};

function movementTypeForMode(mode: DeliveryScanMode): InventoryMovementType {
  if (mode === "load") return "delivery_load";
  if (mode === "deliver") return "delivery_delivered";
  return "delivery_returned";
}

function lineStatusForMode(mode: DeliveryScanMode, fulfilled: number, required: number): string {
  if (mode === "load") return "loaded";
  if (mode === "return") return "returned";
  return fulfilled >= required ? "delivered" : "partially_delivered";
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 140) || "file";
}

function assertPendingDeliveryPath(path: string, ticketId: string, operationId: string, kind: "signatures" | "damage-photos"): void {
  const prefix = `workflow-pending/delivery/${ticketId}/${kind}/${operationId}`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    throw new HttpsError("invalid-argument", "Pending upload path does not belong to this delivery workflow.");
  }
}

async function assertStorageObject(path: string, contentTypePrefix: string): Promise<void> {
  const file = getStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError("not-found", "Pending upload object was not found.");
  }
  const [metadata] = await file.getMetadata();
  const contentType = text(metadata.contentType);
  if (!contentType.startsWith(contentTypePrefix)) {
    throw new HttpsError("failed-precondition", "Pending upload has an invalid content type.");
  }
}

export async function recordDeliveryScanWorkflow(
  input: DeliveryWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");

  const quantity = Math.max(1, numberValue(input.quantity, 1));
  const workflowType = `delivery.${input.mode}`;
  const fingerprint = {
    ...input,
    quantity,
    workflowType,
  };

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint,
    });
    if (claimed.duplicate) return claimed.result;

    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", "Delivery ticket was not found.");
    }

    const ticket = ticketSnap.data() ?? {};
    const patientId = text(input.patientId) || text(ticket.patientKey) || text(ticket.patientId);
    const deliveryTicketNumber = text(input.deliveryTicketNumber) || text(ticket.deliveryTicketNumber);
    const salesOrderNumber = text(input.salesOrderNumber) || text(ticket.salesOrderNumber);
    const required = Math.max(1, numberValue(ticket.requiredScanCount, numberValue(ticket.itemCount, 1)));
    const loadedBefore = numberValue(ticket.loadedScanCount, 0);
    const deliveredBefore = numberValue(ticket.deliveredScanCount, 0);
    const returnedBefore = numberValue(ticket.returnedScanCount, 0);
    const fulfillmentLines =
      ticket.fulfillmentLines && typeof ticket.fulfillmentLines === "object"
        ? (ticket.fulfillmentLines as Record<string, Record<string, unknown>>)
        : {};
    const currentLineStatus = text(fulfillmentLines[input.lineId || input.inventoryItemId]?.status) || "pending";

    if (input.mode === "deliver" && deliveredBefore + quantity > loadedBefore) {
      throw new HttpsError("failed-precondition", "Delivered quantity cannot exceed loaded quantity.");
    }

    if (input.mode === "return" && returnedBefore + quantity > Math.max(loadedBefore, deliveredBefore)) {
      throw new HttpsError("failed-precondition", "Returned quantity cannot exceed handled quantity.");
    }

    const nextFulfilled =
      input.mode === "load"
        ? loadedBefore + quantity
        : input.mode === "deliver"
          ? deliveredBefore + quantity
          : returnedBefore + quantity;
    const nextLineStatus = lineStatusForMode(input.mode, nextFulfilled, required);
    assertTransition(
      DELIVERY_LINE_TRANSITIONS,
      currentLineStatus,
      nextLineStatus,
      "delivery line"
    );

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-movement`,
        movementType: movementTypeForMode(input.mode),
        inventoryItemId: input.inventoryItemId,
        productId: input.productId,
        barcode: input.barcode,
        serialNumber: input.serialNumber,
        lotNumber: input.lotNumber,
        quantity,
        patientId,
        patientName: text(input.patientName) || text(ticket.patientName),
        reason:
          input.mode === "load"
            ? "Loaded onto truck for delivery ticket."
            : input.mode === "deliver"
              ? "Delivered to patient."
              : "Returned from delivery workflow.",
        source: "delivery_fulfillment",
        correlationId: input.ticketId,
        metadata: {
          deliveryId: input.ticketId,
          ticketId: input.ticketId,
          lineId: input.lineId || input.inventoryItemId,
          patientId,
          deliveryTicketNumber,
          salesOrderNumber,
          vehicleId: text(input.vehicleId),
          truckId: text(input.truckId),
          returnCondition: text(input.returnCondition),
          returnNotes: text(input.returnNotes),
        },
      },
    });

    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", movement.message || "Inventory movement failed.");
    }

    const lineId = input.lineId || input.inventoryItemId;
    const linePath = `fulfillmentLines.${lineId}`;
    const ticketUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      [`${linePath}.lineId`]: lineId,
      [`${linePath}.inventoryItemId`]: input.inventoryItemId,
      [`${linePath}.productId`]: text(input.productId),
      [`${linePath}.status`]: nextLineStatus,
      [`${linePath}.quantity`]: quantity,
      [`${linePath}.updatedAt`]: FieldValue.serverTimestamp(),
      [`${linePath}.movementId`]: movement.movementId ?? "",
      [`${linePath}.operationId`]: input.operationId,
    };

    if (input.mode === "load") {
      ticketUpdate.loadedScanCount = FieldValue.increment(quantity);
      ticketUpdate.fulfillmentStatus = loadedBefore + quantity >= required ? "loaded" : "loading";
    } else if (input.mode === "deliver") {
      ticketUpdate.deliveredScanCount = FieldValue.increment(quantity);
      ticketUpdate.fulfillmentStatus = deliveredBefore + quantity >= required ? "delivered" : "delivering";
    } else {
      ticketUpdate.returnedScanCount = FieldValue.increment(quantity);
      ticketUpdate.fulfillmentStatus = "returned";
    }

    transaction.set(ticketRef, ticketUpdate, { merge: true });

    const scanRef = database.collection("deliveryFulfillmentScans").doc(input.operationId);
    transaction.set(scanRef, {
      ticketId: input.ticketId,
      lineId,
      patientKey: patientId,
      patientName: text(input.patientName) || text(ticket.patientName),
      deliveryTicketNumber,
      mode: input.mode,
      inventoryId: input.inventoryItemId,
      productId: text(input.productId),
      barcode: text(input.barcode),
      serial: text(input.serialNumber),
      lotNumber: text(input.lotNumber),
      movementId: movement.movementId ?? "",
      scannedBy: actor.uid,
      scannedByEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (patientId) {
      const patientRef = database.collection("patients").doc(patientId);
      transaction.set(patientRef.collection("timeline").doc(input.operationId), {
        type:
          input.mode === "load"
            ? "delivery_loaded"
            : input.mode === "deliver"
              ? "delivery_delivered"
              : "delivery_returned",
        title:
          input.mode === "load"
            ? "Equipment loaded for delivery"
            : input.mode === "deliver"
              ? "Equipment delivered"
              : "Equipment returned",
        body:
          input.mode === "return"
            ? `Equipment returned. Condition: ${text(input.returnCondition) || "not recorded"}.`
            : `Equipment scanned for delivery ticket ${deliveryTicketNumber || input.ticketId}.`,
        metadata: {
          deliveryTicketId: input.ticketId,
          deliveryTicketNumber,
          inventoryId: input.inventoryItemId,
          productId: text(input.productId),
          barcode: text(input.barcode),
          serial: text(input.serialNumber),
          lotNumber: text(input.lotNumber),
          movementId: movement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });

      if (input.mode === "deliver" || input.mode === "return") {
        transaction.set(
          patientRef.collection("equipment").doc(input.inventoryItemId),
          {
            inventoryId: input.inventoryItemId,
            productId: text(input.productId),
            barcode: text(input.barcode),
            serialNumber: text(input.serialNumber),
            lotNumber: text(input.lotNumber),
            status: input.mode === "deliver" ? "delivered" : "returned",
            deliveryTicketId: input.ticketId,
            deliveryTicketNumber,
            movementId: movement.movementId ?? "",
            deliveredAt: input.mode === "deliver" ? FieldValue.serverTimestamp() : FieldValue.delete(),
            returnedAt: input.mode === "return" ? FieldValue.serverTimestamp() : FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
            systemGenerated: true,
          },
          { merge: true }
        );
      }
    }

    if (salesOrderNumber && input.mode === "deliver") {
      transaction.set(
        database.collection("orders").doc(salesOrderNumber),
        {
          status: "delivered",
          deliveredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
      movementIds: movement.movementId ? [movement.movementId] : [],
    };

    completeWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      result,
    });
    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: workflowType,
      targetCollection: "patientDeliveryTickets",
      targetId: input.ticketId,
      details: {
        operationId: input.operationId,
        movementId: movement.movementId ?? "",
        inventoryItemId: input.inventoryItemId,
        lineId,
        mode: input.mode,
        quantity,
      },
    });

    return result;
  });
}

export async function completeDeliveryTicketWorkflow(
  input: { operationId: string; ticketId: string },
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  const workflowType = "delivery.complete";

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

    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Delivery ticket was not found.");

    const ticket = ticketSnap.data() ?? {};
    const required = Math.max(1, numberValue(ticket.requiredScanCount, numberValue(ticket.itemCount, 1)));
    const delivered = numberValue(ticket.deliveredScanCount, 0);
    const returned = numberValue(ticket.returnedScanCount, 0);
    if (delivered + returned < required) {
      throw new HttpsError("failed-precondition", "Delivery ticket has unresolved lines.");
    }

    transaction.set(
      ticketRef,
      {
        fulfillmentStatus: "completed",
        completedAt: FieldValue.serverTimestamp(),
        completedByUid: actor.uid,
        completedByEmail: actor.email,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const result: WorkflowResult = {
      status: "success",
      operationId: input.operationId,
      workflowType,
      movementIds: [],
    };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: workflowType,
      targetCollection: "patientDeliveryTickets",
      targetId: input.ticketId,
      details: { operationId: input.operationId },
    });
    return result;
  });
}

export async function finalizeDeliverySignatureWorkflow(
  input: DeliverySignatureFinalizeInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  assertPendingDeliveryPath(input.pendingStoragePath, input.ticketId, input.operationId, "signatures");
  await assertStorageObject(input.pendingStoragePath, "image/");
  const workflowType = "delivery.signature_finalize";

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

    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Delivery ticket was not found.");
    const ticket = ticketSnap.data() ?? {};
    const patientId = text(input.patientId) || text(ticket.patientKey) || text(ticket.patientId);
    if (!patientId) throw new HttpsError("failed-precondition", "Delivery ticket is not linked to a patient.");

    const currentStatus = text(ticket.signatureStatus) || "unsigned";
    const nextStatus = text(input.refusalReason) ? "refused" : "signed";
    assertTransition(DELIVERY_SIGNATURE_TRANSITIONS, currentStatus, nextStatus, "delivery signature");

    const signatureRef = database.collection("deliverySignatures").doc(input.operationId);
    const safeTicket = sanitizeFileName(text(ticket.deliveryTicketNumber) || input.ticketId);
    const patientRef = database.collection("patients").doc(patientId);

    transaction.set(signatureRef, {
      id: input.operationId,
      ticketId: input.ticketId,
      patientKey: patientId,
      patientId,
      patientName: text(ticket.patientName),
      deliveryTicketNumber: text(ticket.deliveryTicketNumber),
      signerName: text(input.signerName),
      signerRole: text(input.signerRole),
      signerRelationship: text(input.signerRelationship),
      witnessName: text(input.witnessName),
      refusalReason: text(input.refusalReason),
      signatureStoragePath: input.pendingStoragePath,
      signatureDownloadURL: text(input.pendingDownloadURL),
      originalPdfStoragePath: text(ticket.storagePath),
      contentType: text(input.contentType) || "image/png",
      fileSize: numberValue(input.fileSize, 0),
      checksum: text(input.checksum),
      capturedBy: actor.uid,
      capturedByEmail: actor.email,
      signedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      finalized: true,
    });

    transaction.set(patientRef.collection("documents").doc(input.operationId), {
      patientId,
      patientName: text(ticket.patientName),
      fileName: `${safeTicket}-signature.png`,
      originalFileName: text(input.fileName) || `${safeTicket}-signature.png`,
      storagePath: input.pendingStoragePath,
      downloadURL: text(input.pendingDownloadURL),
      contentType: text(input.contentType) || "image/png",
      fileSize: numberValue(input.fileSize, 0),
      documentType: "Delivery Signature",
      notes: `Electronic signature for delivery ticket ${text(ticket.deliveryTicketNumber) || input.ticketId}.`,
      signerName: text(input.signerName),
      signerRole: text(input.signerRole),
      signerRelationship: text(input.signerRelationship),
      witnessName: text(input.witnessName),
      refusalReason: text(input.refusalReason),
      sourceDeliveryTicketId: input.ticketId,
      sourceDeliveryTicketNumber: text(ticket.deliveryTicketNumber),
      uploadedBy: actor.email || actor.uid,
      uploadedAt: FieldValue.serverTimestamp(),
      systemGenerated: true,
    });

    if (text(ticket.storagePath)) {
      transaction.set(patientRef.collection("documents").doc(`${input.operationId}-signed-ticket`), {
        patientId,
        patientName: text(ticket.patientName),
        fileName: text(ticket.fileName) || `${safeTicket}.pdf`,
        originalFileName: text(ticket.fileName) || `${safeTicket}.pdf`,
        storagePath: text(ticket.storagePath),
        downloadURL: "",
        contentType: "application/pdf",
        fileSize: 0,
        documentType: "Signed Delivery Ticket",
        notes: `Delivery ticket signed electronically by ${text(input.signerName)} (${text(input.signerRole)}). Original PDF preserved exactly as uploaded.`,
        signatureId: input.operationId,
        signatureStoragePath: input.pendingStoragePath,
        signatureDownloadURL: text(input.pendingDownloadURL),
        sourceDeliveryTicketId: input.ticketId,
        sourceDeliveryTicketNumber: text(ticket.deliveryTicketNumber),
        originalPdfPreserved: true,
        uploadedBy: actor.email || actor.uid,
        uploadedAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    }

    transaction.set(ticketRef, {
      signatureStatus: nextStatus,
      signatureId: input.operationId,
      signatureStoragePath: input.pendingStoragePath,
      signatureDownloadURL: text(input.pendingDownloadURL),
      signedByName: text(input.signerName),
      signedByRole: text(input.signerRole),
      signerRelationship: text(input.signerRelationship),
      witnessName: text(input.witnessName),
      refusalReason: text(input.refusalReason),
      signedAt: FieldValue.serverTimestamp(),
      signedByCapturedUser: actor.uid,
      signedByCapturedEmail: actor.email,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(patientRef.collection("timeline").doc(input.operationId), {
      type: "delivery_signed",
      title: nextStatus === "signed" ? "Delivery ticket signed" : "Delivery signature refused",
      body: `${text(input.signerName)} ${nextStatus === "signed" ? "signed" : "refused"} as ${text(input.signerRole)}.`,
      metadata: {
        deliveryTicketId: input.ticketId,
        deliveryTicketNumber: text(ticket.deliveryTicketNumber),
        signatureId: input.operationId,
        signatureStoragePath: input.pendingStoragePath,
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
      targetCollection: "patientDeliveryTickets",
      targetId: input.ticketId,
      details: { operationId: input.operationId, patientId, storagePath: input.pendingStoragePath },
    });
    return result;
  });
}

export async function finalizeDeliveryDamagePhotosWorkflow(
  input: DeliveryDamageFinalizeInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > 12) {
    throw new HttpsError("invalid-argument", "One to twelve damage photos are required.");
  }
  for (const file of input.files) {
    assertPendingDeliveryPath(file.pendingStoragePath, input.ticketId, input.operationId, "damage-photos");
    await assertStorageObject(file.pendingStoragePath, "image/");
  }
  const workflowType = "delivery.damage_photos_finalize";

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

    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Delivery ticket was not found.");
    const ticket = ticketSnap.data() ?? {};
    const patientId = text(input.patientId) || text(ticket.patientKey) || text(ticket.patientId);
    if (!patientId) throw new HttpsError("failed-precondition", "Delivery ticket is not linked to a patient.");
    assertTransition(DELIVERY_EVIDENCE_TRANSITIONS, "none", "recorded", "delivery damage evidence");

    const patientRef = database.collection("patients").doc(patientId);
    const photoIds: string[] = [];

    input.files.forEach((file, index) => {
      const photoId = `${input.operationId}-${index}`;
      photoIds.push(photoId);
      const safeFile = sanitizeFileName(file.fileName || `damage-photo-${index + 1}.jpg`);
      transaction.set(database.collection("deliveryDamagePhotos").doc(photoId), {
        id: photoId,
        ticketId: input.ticketId,
        patientKey: patientId,
        patientId,
        patientName: text(ticket.patientName),
        deliveryTicketNumber: text(ticket.deliveryTicketNumber),
        fileName: safeFile,
        originalFileName: file.fileName || safeFile,
        storagePath: file.pendingStoragePath,
        downloadURL: text(file.pendingDownloadURL),
        contentType: text(file.contentType) || "image/jpeg",
        fileSize: numberValue(file.fileSize, 0),
        checksum: text(file.checksum),
        returnCondition: text(input.returnCondition),
        damageNotes: text(input.damageNotes),
        uploadedBy: actor.uid,
        uploadedByEmail: actor.email,
        uploadedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        finalized: true,
      });
      transaction.set(patientRef.collection("documents").doc(photoId), {
        patientId,
        patientName: text(ticket.patientName),
        fileName: safeFile,
        originalFileName: file.fileName || safeFile,
        storagePath: file.pendingStoragePath,
        downloadURL: text(file.pendingDownloadURL),
        contentType: text(file.contentType) || "image/jpeg",
        fileSize: numberValue(file.fileSize, 0),
        documentType: "Damage Photo",
        notes: text(input.damageNotes)
          ? `Damage photo for delivery ticket ${text(ticket.deliveryTicketNumber) || input.ticketId}. ${text(input.damageNotes)}`
          : `Damage photo for delivery ticket ${text(ticket.deliveryTicketNumber) || input.ticketId}.`,
        returnCondition: text(input.returnCondition),
        sourceDeliveryTicketId: input.ticketId,
        sourceDeliveryTicketNumber: text(ticket.deliveryTicketNumber),
        uploadedBy: actor.email || actor.uid,
        uploadedAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    });

    transaction.set(ticketRef, {
      damagePhotoCount: FieldValue.increment(input.files.length),
      lastDamagePhotoUploadedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(patientRef.collection("timeline").doc(input.operationId), {
      type: "damage_photos_uploaded",
      title: "Damage photos uploaded",
      body: `${input.files.length} damage photo${input.files.length === 1 ? "" : "s"} added for delivery ticket ${text(ticket.deliveryTicketNumber) || input.ticketId}.`,
      metadata: {
        deliveryTicketId: input.ticketId,
        deliveryTicketNumber: text(ticket.deliveryTicketNumber),
        photoIds,
        returnCondition: text(input.returnCondition),
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
      targetCollection: "patientDeliveryTickets",
      targetId: input.ticketId,
      details: { operationId: input.operationId, patientId, photoIds },
    });
    return result;
  });
}

export async function deliveryTechCheckInWorkflow(
  input: DeliveryTechCheckInInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  const workflowType = "delivery.tech_check_in";
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpsError("invalid-argument", "Valid latitude and longitude are required.");
  }

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, fingerprint: input });
    if (claimed.duplicate) return claimed.result;
    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Delivery ticket was not found.");
    const ticket = ticketSnap.data() ?? {};
    const locationRef = database.collection("deliveryTechLocations").doc(input.operationId);
    transaction.set(locationRef, {
      techName: text(input.techName),
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: numberValue(input.accuracy, 0),
      ticketId: input.ticketId,
      deliveryTicketNumber: text(ticket.deliveryTicketNumber),
      patientKey: text(ticket.patientKey) || text(ticket.patientId),
      patientName: text(ticket.patientName),
      recordedBy: actor.uid,
      recordedByEmail: actor.email,
      recordedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(ticketRef, {
      lastTechLatitude: input.latitude,
      lastTechLongitude: input.longitude,
      lastTechAccuracy: numberValue(input.accuracy, 0),
      lastTechName: text(input.techName),
      lastTechLocationAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const result: WorkflowResult = { status: "success", operationId: input.operationId, workflowType, movementIds: [] };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({ transaction, database, actor, action: workflowType, targetCollection: "patientDeliveryTickets", targetId: input.ticketId, details: { operationId: input.operationId } });
    return result;
  });
}

export async function updateDeliveryRouteWorkflow(
  input: DeliveryRouteInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.ticketId, "ticketId");
  const workflowType = "delivery.route_update";
  const routeStatus = text(input.routeStatus) || "planned";
  if (!["planned", "en_route", "arrived", "delayed", "completed"].includes(routeStatus)) {
    throw new HttpsError("invalid-argument", "Invalid route status.");
  }

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, fingerprint: input });
    if (claimed.duplicate) return claimed.result;
    const ticketRef = database.collection("patientDeliveryTickets").doc(input.ticketId);
    const ticketSnap = await transaction.get(ticketRef);
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Delivery ticket was not found.");
    transaction.set(ticketRef, {
      etaMinutes: Math.max(0, numberValue(input.etaMinutes, 0)),
      routeSequence: Math.max(0, numberValue(input.routeSequence, 0)),
      routeStatus,
      routeNotes: text(input.routeNotes),
      routeUpdatedBy: actor.uid,
      routeUpdatedByEmail: actor.email,
      routeUpdatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const result: WorkflowResult = { status: "success", operationId: input.operationId, workflowType, movementIds: [] };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({ transaction, database, actor, action: workflowType, targetCollection: "patientDeliveryTickets", targetId: input.ticketId, details: { operationId: input.operationId, routeStatus } });
    return result;
  });
}
