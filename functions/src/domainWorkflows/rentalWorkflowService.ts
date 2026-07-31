import { FieldValue, type Firestore, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  createInventoryMovementInTransaction,
  type MovementActor,
} from "../inventory/movementService.js";
import {
  assertAdmin,
  assertSafeDocId,
  assertTransition,
  claimWorkflowOperation,
  completeWorkflowOperation,
  numberValue,
  RENTAL_TRANSITIONS,
  text,
  type WorkflowResult,
  writeWorkflowAudit,
} from "./shared.js";

export type RentalWorkflowInput = {
  operationId: string;
  rentalId: string;
  inventoryItemId?: string;
  replacementInventoryItemId?: string;
  productId?: string;
  replacementProductId?: string;
  patientId?: string;
  patientName?: string;
  serialNumber?: string;
  replacementSerialNumber?: string;
  quantity?: number;
  reason?: string;
};

export type CreateAndCheckoutRentalInput = Omit<RentalWorkflowInput, "rentalId"> & {
  rentalId?: string;
  rentalData?: Record<string, unknown>;
};

function activeRentalStatus(status: string): boolean {
  return ["active", "checked_out", "overdue", "extended", "exchanged"].includes(status.toLowerCase());
}

function activePatientStatus(status: string): boolean {
  return !["archived", "destroyed", "deleted", "inactive"].includes(status.toLowerCase());
}

function cleanRentalData(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const allowed = new Set([
    "productId",
    "productName",
    "itemId",
    "itemGroup",
    "procCode",
    "modifiers",
    "serialNumber",
    "assetNumber",
    "assetTag",
    "patientName",
    "patientId",
    "patientDob",
    "phone",
    "location",
    "condition",
    "checkedOutDate",
    "expectedReturnDate",
    "returnedDate",
    "nextBillingDate",
    "nextBillingPeriod",
    "monthlyRate",
    "quantity",
    "charge",
    "allow",
    "extCharge",
    "extAllow",
    "parNumber",
    "parExpiration",
    "planType",
    "itemDiagnosis",
    "insuranceName",
    "payor",
    "orderingDoctor",
    "primaryDoctor",
    "orderDocNpi",
    "primaryDocNpi",
    "salesOrderId",
    "salesOrderDetailId",
    "hospice",
    "sourceReport",
    "notes",
  ]);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (allowed.has(key)) next[key] = value;
  }
  return next;
}

function rentalProductName(rental: Record<string, unknown>, product: Record<string, unknown> | null): string {
  return text(rental.productName) || text(product?.name) || text(product?.productName) || "Rental equipment";
}

export async function createAndCheckoutRentalWorkflow(
  input: CreateAndCheckoutRentalInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  if (!input.inventoryItemId) throw new HttpsError("invalid-argument", "inventoryItemId is required.");
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  if (!input.patientId) throw new HttpsError("invalid-argument", "patientId is required.");
  assertSafeDocId(input.patientId, "patientId");
  if (input.rentalId) assertSafeDocId(input.rentalId, "rentalId");

  const inventoryItemId = input.inventoryItemId;
  const patientId = input.patientId;
  const rentalRef = input.rentalId
    ? database.collection("rentals").doc(input.rentalId)
    : database.collection("rentals").doc();
  const rentalId = rentalRef.id;
  const workflowType = "rental.create_and_checkout";
  const quantity = Math.max(1, numberValue(input.quantity, 1));
  const rentalData = cleanRentalData(input.rentalData);

  return database.runTransaction(async (transaction) => {
    const claimed = await claimWorkflowOperation({
      transaction,
      database,
      operationId: input.operationId,
      workflowType,
      actor,
      fingerprint: { ...input, rentalId, quantity, rentalData },
    });
    if (claimed.duplicate) return claimed.result;

    const [rentalSnap, patientSnap, inventorySnap] = await Promise.all([
      transaction.get(rentalRef),
      transaction.get(database.collection("patients").doc(patientId)),
      transaction.get(database.collection("inventory").doc(inventoryItemId)),
    ]);

    if (rentalSnap.exists) {
      throw new HttpsError("already-exists", "Rental already exists.");
    }
    if (!patientSnap.exists) {
      throw new HttpsError("not-found", "Patient was not found.");
    }

    const patient = patientSnap.data() ?? {};
    if (!activePatientStatus(text(patient.status) || "active")) {
      throw new HttpsError("failed-precondition", "Patient is not active.");
    }
    if (!inventorySnap.exists) {
      throw new HttpsError("not-found", "Inventory item was not found.");
    }

    const inventory = inventorySnap.data() ?? {};
    const productId = text(input.productId) || text(rentalData.productId) || text(inventory.productId);
    const productRef = productId ? database.collection("products").doc(productId) : null;
    const productSnap = productRef ? await transaction.get(productRef) : null;
    const product = productSnap?.exists ? productSnap.data() ?? {} : null;
    if (productRef && !productSnap?.exists) {
      throw new HttpsError("not-found", "Product was not found.");
    }

    const serialNumber = text(input.serialNumber) || text(rentalData.serialNumber) || text(inventory.serial) || text(inventory.serialNumber);
    if (serialNumber) {
      const activeSnap = await transaction.get(
        database.collection("rentals").where("serialNumber", "==", serialNumber).limit(5)
      );
      const duplicate = activeSnap.docs.find((docSnap) => activeRentalStatus(text(docSnap.data().status)));
      if (duplicate) {
        throw new HttpsError("failed-precondition", "Serialized asset already has an active rental.");
      }
    }

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-movement`,
        movementType: "rental_checkout",
        inventoryItemId,
        productId,
        serialNumber,
        quantity,
        rentalId,
        patientId,
        patientName: text(input.patientName) || text(rentalData.patientName) || text(patient.fullName) || text(patient.patientName),
        reason: input.reason || "Rental created and checked out.",
        source: "rental",
        correlationId: rentalId,
      },
    });
    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", movement.message || "Rental checkout movement failed.");
    }

    const productName = rentalProductName(rentalData, product);
    const assignmentId = inventoryItemId;
    transaction.create(rentalRef, {
      ...rentalData,
      productId,
      productName,
      itemId: inventoryItemId,
      inventoryItemId,
      serialNumber,
      patientId,
      patientName: text(input.patientName) || text(rentalData.patientName) || text(patient.fullName) || text(patient.patientName),
      status: "checked_out",
      quantity,
      createdAt: FieldValue.serverTimestamp(),
      checkedOutAt: FieldValue.serverTimestamp(),
      checkedOutByUid: actor.uid,
      checkedOutByEmail: actor.email,
      movementId: movement.movementId ?? "",
      updatedAt: FieldValue.serverTimestamp(),
      systemGenerated: true,
    });

    const patientRef = database.collection("patients").doc(patientId);
    transaction.set(
      patientRef.collection("equipment").doc(assignmentId),
      {
        inventoryId: inventoryItemId,
        productId,
        productName,
        serialNumber,
        status: "active",
        rentalId,
        assignedAt: FieldValue.serverTimestamp(),
        assignedByUid: actor.uid,
        assignedByEmail: actor.email,
        movementId: movement.movementId ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      },
      { merge: true }
    );
    transaction.set(patientRef.collection("timeline").doc(input.operationId), {
      type: "rental_created_and_checked_out",
      title: "Rental created and checked out",
      body: `${productName} was created and checked out.`,
      metadata: {
        rentalId,
        inventoryItemId,
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
      rentalId,
      assignmentId,
    };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: workflowType,
      targetCollection: "rentals",
      targetId: rentalId,
      details: { operationId: input.operationId, inventoryItemId, patientId, movementId: movement.movementId ?? "" },
    });
    return result;
  });
}

export async function checkoutRentalWorkflow(
  input: RentalWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.rentalId, "rentalId");
  if (!input.inventoryItemId) throw new HttpsError("invalid-argument", "inventoryItemId is required.");
  assertSafeDocId(input.inventoryItemId, "inventoryItemId");
  const inventoryItemId = input.inventoryItemId;
  const workflowType = "rental.checkout";
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

    const rentalRef = database.collection("rentals").doc(input.rentalId);
    const rentalSnap = await transaction.get(rentalRef);
    if (!rentalSnap.exists) throw new HttpsError("not-found", "Rental was not found.");
    const rental = rentalSnap.data() ?? {};
    const currentStatus = text(rental.status) || "available";
    assertTransition(RENTAL_TRANSITIONS, currentStatus, "checked_out", "rental");

    const serialNumber = text(input.serialNumber) || text(rental.serialNumber);
    if (serialNumber) {
      const activeSnap = await transaction.get(
        database.collection("rentals").where("serialNumber", "==", serialNumber).limit(5)
      );
      const duplicate = activeSnap.docs.find(
        (docSnap) => docSnap.id !== input.rentalId && activeRentalStatus(text(docSnap.data().status))
      );
      if (duplicate) {
        throw new HttpsError("failed-precondition", "Serialized asset already has an active rental.");
      }
    }

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-movement`,
        movementType: "rental_checkout",
        inventoryItemId,
        productId: input.productId || text(rental.productId),
        serialNumber,
        quantity,
        rentalId: input.rentalId,
        patientId: input.patientId || text(rental.patientId),
        patientName: input.patientName || text(rental.patientName),
        reason: input.reason || "Rental checked out.",
        source: "rental",
        correlationId: input.rentalId,
      },
    });
    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", movement.message || "Rental checkout movement failed.");
    }

    transaction.set(
      rentalRef,
      {
        status: "checked_out",
        inventoryItemId,
        itemId: inventoryItemId,
        productId: input.productId || text(rental.productId),
        patientId: input.patientId || text(rental.patientId),
        patientName: input.patientName || text(rental.patientName),
        checkedOutAt: FieldValue.serverTimestamp(),
        checkedOutByUid: actor.uid,
        checkedOutByEmail: actor.email,
        movementId: movement.movementId ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const patientId = input.patientId || text(rental.patientId);
    if (patientId) {
      transaction.set(
        database.collection("patients").doc(patientId).collection("equipment").doc(inventoryItemId),
        {
          inventoryId: inventoryItemId,
          productId: input.productId || text(rental.productId),
          serialNumber,
          status: "active",
          rentalId: input.rentalId,
          assignedAt: FieldValue.serverTimestamp(),
          assignedByUid: actor.uid,
          assignedByEmail: actor.email,
          movementId: movement.movementId ?? "",
          updatedAt: FieldValue.serverTimestamp(),
          systemGenerated: true,
        },
        { merge: true }
      );
      transaction.set(database.collection("patients").doc(patientId).collection("timeline").doc(input.operationId), {
        type: "rental_checked_out",
        title: "Rental checked out",
        body: `${text(rental.productName) || "Rental equipment"} was checked out.`,
        metadata: {
          rentalId: input.rentalId,
          inventoryItemId,
          movementId: movement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    }

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
      targetCollection: "rentals",
      targetId: input.rentalId,
      details: { operationId: input.operationId, inventoryItemId },
    });
    return result;
  });
}

export async function returnRentalWorkflow(
  input: RentalWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.rentalId, "rentalId");
  const workflowType = "rental.return";

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

    const rentalRef = database.collection("rentals").doc(input.rentalId);
    const rentalSnap = await transaction.get(rentalRef);
    if (!rentalSnap.exists) throw new HttpsError("not-found", "Rental was not found.");
    const rental = rentalSnap.data() ?? {};
    const currentStatus = text(rental.status) || "checked_out";
    assertTransition(RENTAL_TRANSITIONS, currentStatus, "available", "rental");

    const inventoryItemId = text(input.inventoryItemId) || text(rental.inventoryItemId) || text(rental.itemId);
    if (!inventoryItemId) throw new HttpsError("failed-precondition", "Rental is not linked to an inventory item.");
    assertSafeDocId(inventoryItemId, "inventoryItemId");

    const movement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-movement`,
        movementType: "rental_return",
        inventoryItemId,
        productId: input.productId || text(rental.productId),
        serialNumber: input.serialNumber || text(rental.serialNumber),
        quantity: Math.max(1, numberValue(input.quantity, numberValue(rental.quantity, 1))),
        rentalId: input.rentalId,
        patientId: input.patientId || text(rental.patientId),
        reason: input.reason || "Rental returned.",
        source: "rental",
        correlationId: input.rentalId,
      },
    });
    if (movement.status !== "success" && movement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", movement.message || "Rental return movement failed.");
    }

    const patientId = text(input.patientId) || text(rental.patientId);
    transaction.set(
      rentalRef,
      {
        status: "available",
        patientName: "",
        patientId: "",
        returnedDate: new Date().toISOString().slice(0, 10),
        returnedAt: FieldValue.serverTimestamp(),
        returnedByUid: actor.uid,
        returnedByEmail: actor.email,
        returnMovementId: movement.movementId ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (patientId) {
      transaction.set(database.collection("patients").doc(patientId).collection("timeline").doc(input.operationId), {
        type: "rental_returned",
        title: "Rental returned",
        body: `${text(rental.productName) || "Rental equipment"} was returned.`,
        metadata: {
          rentalId: input.rentalId,
          inventoryItemId,
          movementId: movement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    }

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
      targetCollection: "rentals",
      targetId: input.rentalId,
      details: { operationId: input.operationId, inventoryItemId },
    });
    return result;
  });
}

export async function cancelRentalWorkflow(
  input: RentalWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.rentalId, "rentalId");
  const workflowType = "rental.cancel";

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

    const rentalRef = database.collection("rentals").doc(input.rentalId);
    const rentalSnap = await transaction.get(rentalRef);
    if (!rentalSnap.exists) throw new HttpsError("not-found", "Rental was not found.");
    const currentStatus = text(rentalSnap.data()?.status) || "available";
    assertTransition(RENTAL_TRANSITIONS, currentStatus, "cancelled", "rental");

    transaction.set(
      rentalRef,
      {
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledByUid: actor.uid,
        cancelledByEmail: actor.email,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const result: WorkflowResult = { status: "success", operationId: input.operationId, workflowType, movementIds: [] };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    return result;
  });
}

export async function exchangeRentalWorkflow(
  input: RentalWorkflowInput,
  actor: MovementActor,
  database: Firestore = getFirestore()
): Promise<WorkflowResult> {
  assertSafeDocId(input.rentalId, "rentalId");
    if (!input.replacementInventoryItemId) {
      throw new HttpsError("invalid-argument", "replacementInventoryItemId is required.");
    }
    assertSafeDocId(input.replacementInventoryItemId, "replacementInventoryItemId");
    const replacementInventoryItemId = input.replacementInventoryItemId;
  const workflowType = "rental.exchange";

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

    const rentalRef = database.collection("rentals").doc(input.rentalId);
    const rentalSnap = await transaction.get(rentalRef);
    if (!rentalSnap.exists) throw new HttpsError("not-found", "Rental was not found.");
    const rental = rentalSnap.data() ?? {};
    const currentStatus = text(rental.status) || "checked_out";
    assertTransition(RENTAL_TRANSITIONS, currentStatus, "exchanged", "rental");

    const oldInventoryItemId = text(input.inventoryItemId) || text(rental.inventoryItemId) || text(rental.itemId);
    if (!oldInventoryItemId) {
      throw new HttpsError("failed-precondition", "Rental is not linked to an existing inventory item.");
    }
    assertSafeDocId(oldInventoryItemId, "inventoryItemId");

    const patientId = text(input.patientId) || text(rental.patientId);
    const patientName = text(input.patientName) || text(rental.patientName);
    const quantity = Math.max(1, numberValue(input.quantity, numberValue(rental.quantity, 1)));

    const returnMovement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-return`,
        movementType: "rental_return",
        inventoryItemId: oldInventoryItemId,
        productId: input.productId || text(rental.productId),
        serialNumber: input.serialNumber || text(rental.serialNumber),
        quantity,
        rentalId: input.rentalId,
        patientId,
        reason: input.reason || "Rental exchange returned old asset.",
        source: "rental",
        correlationId: input.rentalId,
        metadata: { exchangeOperationId: input.operationId, exchangeSide: "return" },
      },
    });
    if (returnMovement.status !== "success" && returnMovement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", returnMovement.message || "Rental exchange return failed.");
    }

    const checkoutMovement = await createInventoryMovementInTransaction({
      transaction,
      database,
      actor,
      input: {
        operationId: `${input.operationId}-checkout`,
        movementType: "rental_checkout",
        inventoryItemId: replacementInventoryItemId,
        productId: input.replacementProductId || input.productId || text(rental.productId),
        serialNumber: input.replacementSerialNumber,
        quantity,
        rentalId: input.rentalId,
        patientId,
        patientName,
        reason: input.reason || "Rental exchange issued replacement asset.",
        source: "rental",
        correlationId: input.rentalId,
        metadata: {
          exchangeOperationId: input.operationId,
          exchangeSide: "checkout",
          returnedInventoryItemId: oldInventoryItemId,
        },
      },
    });
    if (checkoutMovement.status !== "success" && checkoutMovement.status !== "duplicate_operation") {
      throw new HttpsError("failed-precondition", checkoutMovement.message || "Rental exchange checkout failed.");
    }

    transaction.set(
      rentalRef,
      {
        status: "checked_out",
        previousInventoryItemId: oldInventoryItemId,
        inventoryItemId: replacementInventoryItemId,
        itemId: replacementInventoryItemId,
        productId: input.replacementProductId || input.productId || text(rental.productId),
        serialNumber: text(input.replacementSerialNumber) || text(rental.serialNumber),
        patientId,
        patientName,
        exchangedAt: FieldValue.serverTimestamp(),
        exchangedByUid: actor.uid,
        exchangedByEmail: actor.email,
        exchangeReturnMovementId: returnMovement.movementId ?? "",
        exchangeCheckoutMovementId: checkoutMovement.movementId ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (patientId) {
      const patientRef = database.collection("patients").doc(patientId);
      transaction.set(
        patientRef.collection("equipment").doc(oldInventoryItemId),
        {
          status: "returned",
          returnedAt: FieldValue.serverTimestamp(),
          movementId: returnMovement.movementId ?? "",
          updatedAt: FieldValue.serverTimestamp(),
          systemGenerated: true,
        },
        { merge: true }
      );
      transaction.set(
        patientRef.collection("equipment").doc(replacementInventoryItemId),
        {
          inventoryId: replacementInventoryItemId,
          productId: input.replacementProductId || input.productId || text(rental.productId),
          serialNumber: text(input.replacementSerialNumber),
          status: "active",
          rentalId: input.rentalId,
          replacesInventoryItemId: oldInventoryItemId,
          assignedAt: FieldValue.serverTimestamp(),
          assignedByUid: actor.uid,
          assignedByEmail: actor.email,
          movementId: checkoutMovement.movementId ?? "",
          updatedAt: FieldValue.serverTimestamp(),
          systemGenerated: true,
        },
        { merge: true }
      );
      transaction.set(patientRef.collection("timeline").doc(input.operationId), {
        type: "rental_exchanged",
        title: "Rental exchanged",
        body: "Rental equipment was exchanged.",
        metadata: {
          rentalId: input.rentalId,
          oldInventoryItemId,
          replacementInventoryItemId: input.replacementInventoryItemId,
          returnMovementId: returnMovement.movementId ?? "",
          checkoutMovementId: checkoutMovement.movementId ?? "",
        },
        actorUid: actor.uid,
        actorEmail: actor.email,
        createdAt: FieldValue.serverTimestamp(),
        systemGenerated: true,
      });
    }

    const movementIds = [returnMovement.movementId, checkoutMovement.movementId].filter(Boolean) as string[];
    const result: WorkflowResult = { status: "success", operationId: input.operationId, workflowType, movementIds };
    completeWorkflowOperation({ transaction, database, operationId: input.operationId, workflowType, actor, result });
    writeWorkflowAudit({
      transaction,
      database,
      actor,
      action: workflowType,
      targetCollection: "rentals",
      targetId: input.rentalId,
      details: { operationId: input.operationId, oldInventoryItemId, replacementInventoryItemId: input.replacementInventoryItemId, movementIds },
    });
    return result;
  });
}

function timestampMillis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
}

export async function reportStaleRentalDrafts(params: {
  actor: MovementActor;
  dryRun: boolean;
  repair: boolean;
  olderThanHours: number;
  database?: Firestore;
}): Promise<{
  status: "success";
  dryRun: boolean;
  repair: boolean;
  olderThanHours: number;
  count: number;
  rentals: Array<Record<string, unknown>>;
}> {
  assertAdmin(params.actor);
  const database = params.database ?? getFirestore();
  const cutoff = Date.now() - Math.max(1, params.olderThanHours) * 60 * 60 * 1000;
  const snap = await database.collection("rentals").limit(5000).get();
  const rentals: Array<Record<string, unknown>> = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const status = text(data.status).toLowerCase();
    const createdAtMs = timestampMillis(data.createdAt) || timestampMillis(data.updatedAt);
    const stale = createdAtMs > 0 && createdAtMs < cutoff;
    const missingMovement = !text(data.movementId) && !text(data.checkoutMovementId);
    const incomplete =
      status === "draft" ||
      (["available", "maintenance"].includes(status) && missingMovement && (text(data.patientId) || text(data.inventoryItemId) || text(data.itemId)));

    if (stale && incomplete) {
      rentals.push({
        rentalId: docSnap.id,
        patientId: text(data.patientId),
        patientName: text(data.patientName),
        inventoryItemId: text(data.inventoryItemId) || text(data.itemId),
        productName: text(data.productName),
        status,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        missingMovement,
      });
    }
  }

  if (params.repair && !params.dryRun) {
    const batch = database.batch();
    for (const rental of rentals.slice(0, 250)) {
      batch.set(
        database.collection("rentals").doc(String(rental.rentalId)),
        {
          status: "abandoned",
          abandonedAt: FieldValue.serverTimestamp(),
          abandonedByUid: params.actor.uid,
          abandonedByEmail: params.actor.email,
          abandonReason: "Marked abandoned by stale rental draft cleanup.",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  await database.collection("auditLogs").add({
    action: params.repair ? "rental.cleanup.repair" : "rental.cleanup.dry_run",
    actorUid: params.actor.uid,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    details: {
      dryRun: params.dryRun,
      repair: params.repair,
      olderThanHours: params.olderThanHours,
      count: rentals.length,
    },
    createdAt: FieldValue.serverTimestamp(),
    success: true,
  });

  return {
    status: "success",
    dryRun: params.dryRun,
    repair: params.repair,
    olderThanHours: params.olderThanHours,
    count: rentals.length,
    rentals,
  };
}
