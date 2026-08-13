import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  clearEmulatorData,
  EMULATOR_PORTS,
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "../test-utils/emulator-setup";
import {
  createInventoryMovement,
  type MovementActor,
} from "../inventory/movementService";
import {
  applyInventoryCleanup,
  inventoryCleanupWorkflowCallable,
  previewInventoryCleanup,
} from "../inventory/cleanupWorkflow";
import { createInventoryMovementCallable } from "../inventory/movementFunctions";
import { receiveScannedInventoryIntake } from "../inventory/receiveScannedInventoryIntake";
import {
  cancelRentalWorkflowCallable,
  exchangeRentalWorkflowCallable,
  patientEquipmentWorkflowCallable,
  returnRentalWorkflowCallable,
} from "../domainWorkflows/domainWorkflowFunctions";
import {
  cancelRentalWorkflow,
  createAndCheckoutRentalWorkflow,
  exchangeRentalWorkflow,
  returnRentalWorkflow,
} from "../domainWorkflows/rentalWorkflowService";
import { patientEquipmentWorkflow } from "../domainWorkflows/patientEquipmentWorkflowService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const actor: MovementActor = {
  uid: "golden-staff-001",
  email: "golden.staff@example.test",
  role: "staff",
};

const adminActor: MovementActor = {
  uid: "golden-admin-001",
  email: "golden.admin@example.test",
  role: "admin",
};

type CallableWorkflowResult = Record<string, unknown> & {
  status?: string;
  workflowType?: string;
  movementIds?: string[];
};

let rulesTestEnv: RulesTestEnvironment | null = null;

beforeAll(async () => {
  validateEmulatorSafety();
  rulesTestEnv = await initializeTestEnvironment({
    projectId: getEmulatorProjectId(),
    firestore: {
      host: "127.0.0.1",
      port: EMULATOR_PORTS.firestore,
      rules: readFileSync(join(process.cwd(), "..", "firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await rulesTestEnv?.cleanup();
});

beforeEach(async () => {
  await clearEmulatorData();
  await seedUser(actor.uid, { role: "staff", email: actor.email });
  await seedUser(adminActor.uid, { role: "admin", email: adminActor.email });
});

async function seedUser(uid: string, overrides: Record<string, unknown> = {}) {
  await db.collection("users").doc(uid).set({
    uid,
    email: `${uid}@example.test`,
    role: "staff",
    active: true,
    disabled: false,
    deleted: false,
    displayName: `Synthetic ${uid}`,
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedProduct(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("products").doc(id).set({
    name: `Golden product ${id}`,
    productName: `Golden product ${id}`,
    status: "active",
    deleted: false,
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedInventory(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("inventory").doc(id).set({
    name: `Golden inventory ${id}`,
    productId: "",
    barcode: id,
    quantityOnHand: 10,
    committed: 0,
    onRent: 0,
    onTruck: 0,
    available: 10,
    status: "active",
    lifecycleStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedPatient(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("patients").doc(id).set({
    fullName: `Synthetic Patient ${id}`,
    patientName: `Synthetic Patient ${id}`,
    status: "active",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });
}

async function countByOperation(collectionName: string, operationId: string) {
  const snap = await db.collection(collectionName).where("operationId", "==", operationId).get();
  return snap.size;
}

async function seedExchangeRentalFixture(prefix: string, overrides: {
  rental?: Record<string, unknown>;
  oldInventory?: Record<string, unknown>;
  replacementInventory?: Record<string, unknown>;
  replacementId?: string;
  patientId?: string;
  rentalId?: string;
} = {}) {
  const productId = `${prefix}-product`;
  const patientId = overrides.patientId ?? `${prefix}-patient`;
  const rentalId = overrides.rentalId ?? `${prefix}-rental`;
  const oldInventoryId = `${prefix}-old-inventory`;
  const replacementInventoryId = overrides.replacementId ?? `${prefix}-replacement-inventory`;

  await seedProduct(productId);
  await seedPatient(patientId, { fullName: `Exchange Patient ${prefix}` });
  await seedInventory(oldInventoryId, {
    productId,
    serialNumber: `${prefix}-OLD-SN`,
    quantityOnHand: 1,
    committed: 0,
    onRent: 1,
    onTruck: 0,
    available: 0,
    status: "rental_out",
    patientKey: patientId,
    patientName: `Exchange Patient ${prefix}`,
    rentalId,
    ...overrides.oldInventory,
  });
  await seedInventory(replacementInventoryId, {
    productId,
    serialNumber: `${prefix}-NEW-SN`,
    quantityOnHand: 1,
    committed: 0,
    onRent: 0,
    onTruck: 0,
    available: 1,
    status: "active",
    ...overrides.replacementInventory,
  });
  await db.collection("rentals").doc(rentalId).set({
    productId,
    productName: `Golden product ${productId}`,
    inventoryItemId: oldInventoryId,
    itemId: oldInventoryId,
    serialNumber: `${prefix}-OLD-SN`,
    patientId,
    patientName: `Exchange Patient ${prefix}`,
    status: "checked_out",
    quantity: 1,
    createdAt: Timestamp.now(),
    checkedOutAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides.rental,
  });
  await db.collection("patients").doc(patientId).collection("equipment").doc(oldInventoryId).set({
    inventoryId: oldInventoryId,
    productId,
    productName: `Golden product ${productId}`,
    serialNumber: `${prefix}-OLD-SN`,
    status: "active",
    rentalId,
    assignedAt: Timestamp.now(),
    movementId: `${prefix}-original-movement`,
    systemGenerated: true,
  });

  return { productId, patientId, rentalId, oldInventoryId, replacementInventoryId };
}

async function seedCancelableRentalFixture(prefix: string, overrides: {
  rental?: Record<string, unknown>;
  inventory?: Record<string, unknown>;
  patientId?: string;
  rentalId?: string;
  inventoryId?: string;
} = {}) {
  const productId = `${prefix}-product`;
  const patientId = overrides.patientId ?? `${prefix}-patient`;
  const rentalId = overrides.rentalId ?? `${prefix}-rental`;
  const inventoryId = overrides.inventoryId ?? `${prefix}-inventory`;

  await seedProduct(productId);
  await seedPatient(patientId, { fullName: `Cancel Patient ${prefix}` });
  await seedInventory(inventoryId, {
    productId,
    serialNumber: `${prefix}-SN`,
    quantityOnHand: 1,
    committed: 0,
    onRent: 0,
    onTruck: 0,
    available: 1,
    status: "active",
    ...overrides.inventory,
  });
  await db.collection("rentals").doc(rentalId).set({
    productId,
    productName: `Golden product ${productId}`,
    inventoryItemId: inventoryId,
    itemId: inventoryId,
    serialNumber: `${prefix}-SN`,
    patientId,
    patientName: `Cancel Patient ${prefix}`,
    status: "available",
    quantity: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides.rental,
  });

  return { productId, patientId, rentalId, inventoryId };
}

async function seedPatientEquipmentFixture(prefix: string, overrides: {
  assigned?: boolean;
  inventory?: Record<string, unknown>;
  equipment?: Record<string, unknown>;
  patientId?: string;
  toPatientId?: string;
  inventoryId?: string;
} = {}) {
  const productId = `${prefix}-product`;
  const patientId = overrides.patientId ?? `${prefix}-patient`;
  const toPatientId = overrides.toPatientId ?? `${prefix}-to-patient`;
  const inventoryId = overrides.inventoryId ?? `${prefix}-inventory`;
  const patientName = `Patient Equipment ${prefix}`;
  const toPatientName = `Patient Equipment Target ${prefix}`;
  const assigned = overrides.assigned === true;

  await seedProduct(productId);
  await seedPatient(patientId, { fullName: patientName, patientName });
  await seedPatient(toPatientId, { fullName: toPatientName, patientName: toPatientName });
  await seedInventory(inventoryId, {
    productId,
    serialNumber: `${prefix}-SN`,
    quantityOnHand: 1,
    committed: 0,
    onRent: assigned ? 1 : 0,
    onTruck: 0,
    available: assigned ? 0 : 1,
    status: assigned ? "assigned" : "active",
    patientKey: assigned ? patientId : "",
    patientName: assigned ? patientName : "",
    isSerialized: true,
    ...overrides.inventory,
  });

  if (assigned) {
    await db.collection("patients").doc(patientId).collection("equipment").doc(inventoryId).set({
      inventoryId,
      productId,
      productName: `Golden product ${productId}`,
      serialNumber: `${prefix}-SN`,
      status: "active",
      assignedAt: Timestamp.now(),
      movementId: `${prefix}-original-movement`,
      systemGenerated: true,
      ...overrides.equipment,
    });
  }

  return { productId, patientId, toPatientId, inventoryId, patientName, toPatientName };
}

async function invokeCreateMovementCallable(data: Record<string, unknown>, authContext?: { uid: string; role: string }) {
  const callable = createInventoryMovementCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<unknown>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip: "127.0.0.1",
      headers: {},
    },
  });
}

async function invokeInventoryCleanupCallable(
  data: Record<string, unknown>,
  authContext?: { uid: string; email?: string; role: string },
  ip = "127.0.0.1",
) {
  const callable = inventoryCleanupWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: {},
    },
  });
}

async function invokeReceiveInventoryByBarcode(data: Record<string, unknown>) {
  const { receiveInventoryByBarcode } = await import("../inventory/receiveInventoryByBarcode.js");
  const callable = receiveInventoryByBarcode as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };

  return callable.run({
    data,
    auth: {
      uid: actor.uid,
      token: {
        email: actor.email,
        role: actor.role,
      },
    },
    rawRequest: {
      ip: "127.0.0.1",
      headers: {},
    },
  });
}

async function invokeCycleCountInventoryByBarcode(
  data: Record<string, unknown>
) {
  const { cycleCountInventoryByBarcode } = await import(
    "../inventory/inventoryTransactionFunctions.js"
  );

  const callable = cycleCountInventoryByBarcode as unknown as {
    run: (
      request: Record<string, unknown>
    ) => Promise<Record<string, unknown>>;
  };

  return callable.run({
    data,
    auth: {
      uid: actor.uid,
      token: {
        uid: actor.uid,
        email: actor.email,
        role: actor.role,
      },
    },
    rawRequest: {
      ip: "127.0.0.1",
      headers: {},
    },
  });
}
async function invokeExchangeRentalCallable(
  data: Record<string, unknown>,
  authContext?: { uid: string; email?: string; role: string },
  ip = "127.0.0.1",
) {
  const callable = exchangeRentalWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<CallableWorkflowResult>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: {},
    },
  });
}

async function invokeReturnRentalCallable(
  data: Record<string, unknown>,
  authContext?: { uid: string; email?: string; role: string },
  ip = "127.0.0.1",
) {
  const callable = returnRentalWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<CallableWorkflowResult>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: {},
    },
  });
}

async function invokeCancelRentalCallable(
  data: Record<string, unknown>,
  authContext?: { uid: string; email?: string; role: string },
  ip = "127.0.0.1",
) {
  const callable = cancelRentalWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<CallableWorkflowResult>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: {},
    },
  });
}

async function invokePatientEquipmentCallable(
  data: Record<string, unknown>,
  authContext?: { uid: string; email?: string; role: string },
  ip = "127.0.0.1",
) {
  const callable = patientEquipmentWorkflowCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<CallableWorkflowResult>;
  };

  return callable.run({
    data,
    auth: authContext
      ? {
          uid: authContext.uid,
          token: {
            uid: authContext.uid,
            email: authContext.email ?? `${authContext.uid}@example.test`,
            role: authContext.role,
          },
        }
      : undefined,
    rawRequest: {
      ip,
      headers: {},
    },
  });
}

function exchangeCallableInput(
  fixture: Awaited<ReturnType<typeof seedExchangeRentalFixture>>,
  operationId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    operationId,
    rentalId: fixture.rentalId,
    inventoryItemId: fixture.oldInventoryId,
    replacementInventoryItemId: fixture.replacementInventoryId,
    productId: fixture.productId,
    replacementProductId: fixture.productId,
    patientId: fixture.patientId,
    patientName: `Exchange Patient ${fixture.rentalId.replace("-rental", "")}`,
    serialNumber: `${fixture.rentalId.replace("-rental", "")}-OLD-SN`,
    replacementSerialNumber: `${fixture.rentalId.replace("-rental", "")}-NEW-SN`,
    quantity: 1,
    reason: "Golden rental exchange callable",
    ...overrides,
  };
}

function returnWorkflowInput(
  fixture: Awaited<ReturnType<typeof seedExchangeRentalFixture>>,
  operationId: string,
  overrides: Record<string, unknown> = {},
) {
  const prefix = fixture.rentalId.replace("-rental", "");
  return {
    operationId,
    rentalId: fixture.rentalId,
    inventoryItemId: fixture.oldInventoryId,
    productId: fixture.productId,
    patientId: fixture.patientId,
    serialNumber: `${prefix}-OLD-SN`,
    quantity: 1,
    reason: "Golden rental return",
    ...overrides,
  };
}

function cancelWorkflowInput(
  fixture: Awaited<ReturnType<typeof seedCancelableRentalFixture>>,
  operationId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    operationId,
    rentalId: fixture.rentalId,
    reason: "Golden rental cancellation",
    ...overrides,
  };
}

function patientEquipmentInput(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  action: "assign" | "remove" | "transfer" = "assign",
  overrides: Record<string, unknown> = {},
) {
  return {
    operationId,
    action,
    patientId: fixture.patientId,
    toPatientId: action === "transfer" ? fixture.toPatientId : undefined,
    inventoryItemId: fixture.inventoryId,
    productId: fixture.productId,
    patientName: fixture.patientName,
    toPatientName: action === "transfer" ? fixture.toPatientName : undefined,
    serialNumber: `${fixture.inventoryId.replace("-inventory", "")}-SN`,
    quantity: 1,
    reason: `Golden patient equipment ${action}`,
    ...overrides,
  };
}

async function expectExchangeFixtureUnchanged(
  fixture: Awaited<ReturnType<typeof seedExchangeRentalFixture>>,
  operationId: string,
  actorUid = actor.uid,
) {
  const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
  expect(rental).toMatchObject({
    status: "checked_out",
    inventoryItemId: fixture.oldInventoryId,
    itemId: fixture.oldInventoryId,
  });

  const oldInventory = (await db.collection("inventory").doc(fixture.oldInventoryId).get()).data();
  expect(oldInventory).toMatchObject({
    status: "rental_out",
    onRent: 1,
    available: 0,
    patientKey: fixture.patientId,
    rentalId: fixture.rentalId,
  });

  const replacementInventory = (await db.collection("inventory").doc(fixture.replacementInventoryId).get()).data();
  expect(replacementInventory).toMatchObject({
    onRent: 0,
    available: 1,
  });

  const oldEquipment = await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get();
  expect(oldEquipment.data()?.status).toBe("active");
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.replacementInventoryId).get()).exists).toBe(false);
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(false);
  expect((await db.collection("domainWorkflowOperations").doc(`${actorUid}_${operationId}`).get()).exists).toBe(false);
  expect(await countByOperation("inventoryTransactions", `${operationId}-return`)).toBe(0);
  expect(await countByOperation("inventoryTransactions", `${operationId}-checkout`)).toBe(0);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "rental.exchange")).toHaveLength(0);
}

async function expectReturnFixtureCheckedOut(
  fixture: Awaited<ReturnType<typeof seedExchangeRentalFixture>>,
  operationId: string,
  actorUid = actor.uid,
) {
  expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()).toMatchObject({
    status: "checked_out",
    inventoryItemId: fixture.oldInventoryId,
    itemId: fixture.oldInventoryId,
    patientId: fixture.patientId,
  });
  expect((await db.collection("inventory").doc(fixture.oldInventoryId).get()).data()).toMatchObject({
    status: "rental_out",
    onRent: 1,
    available: 0,
    patientKey: fixture.patientId,
    rentalId: fixture.rentalId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get()).data()?.status).toBe("active");
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(false);
  expect((await db.collection("domainWorkflowOperations").doc(`${actorUid}_${operationId}`).get()).exists).toBe(false);
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "rental.return")).toHaveLength(0);
}

async function expectReturnCommitted(
  fixture: Awaited<ReturnType<typeof seedExchangeRentalFixture>>,
  operationId: string,
  movementId: string | undefined,
) {
  expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()).toMatchObject({
    status: "available",
    patientId: "",
    patientName: "",
    returnMovementId: movementId,
  });
  expect((await db.collection("inventory").doc(fixture.oldInventoryId).get()).data()).toMatchObject({
    status: "available",
    onRent: 0,
    available: 1,
    patientKey: "",
    patientName: "",
    rentalId: "",
    lastMovementId: movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get()).data()).toMatchObject({
    status: "returned",
    returnMovementId: movementId,
    movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).data()).toMatchObject({
    type: "rental_returned",
    metadata: {
      rentalId: fixture.rentalId,
      inventoryItemId: fixture.oldInventoryId,
      movementId,
    },
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
    operationId,
    workflowType: "rental.return",
    status: "completed",
  });
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(1);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "rental.return")).toHaveLength(1);
}

async function expectCancelFixtureAvailable(
  fixture: Awaited<ReturnType<typeof seedCancelableRentalFixture>>,
  operationId: string,
  actorUid = actor.uid,
) {
  expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()).toMatchObject({
    status: "available",
    inventoryItemId: fixture.inventoryId,
    patientId: fixture.patientId,
  });
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "active",
    onRent: 0,
    available: 1,
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actorUid}_${operationId}`).get()).exists).toBe(false);
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "rental.cancel")).toHaveLength(0);
}

async function expectCancelCommitted(
  fixture: Awaited<ReturnType<typeof seedCancelableRentalFixture>>,
  operationId: string,
) {
  expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()).toMatchObject({
    status: "cancelled",
    cancelledByUid: actor.uid,
    cancelledByEmail: actor.email,
  });
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "active",
    onRent: 0,
    available: 1,
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
    operationId,
    workflowType: "rental.cancel",
    status: "completed",
    movementIds: [],
  });
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "rental.cancel")).toHaveLength(1);
}

async function expectPatientEquipmentAvailable(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  actorUid = actor.uid,
) {
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "active",
    onRent: 0,
    available: 1,
    patientKey: "",
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).exists).toBe(false);
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(false);
  expect((await db.collection("domainWorkflowOperations").doc(`${actorUid}_${operationId}`).get()).exists).toBe(false);
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.patientId).get();
  expect(audits.docs.filter((doc) => String(doc.data().action).startsWith("patient_equipment."))).toHaveLength(0);
}

async function expectPatientEquipmentActive(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  movementId: string | undefined,
) {
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "assigned",
    onRent: 1,
    available: 0,
    patientKey: fixture.patientId,
    patientName: fixture.patientName,
    lastMovementId: movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).data()).toMatchObject({
    inventoryId: fixture.inventoryId,
    productId: fixture.productId,
    status: "active",
    movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).data()).toMatchObject({
    type: "equipment_assign",
    metadata: {
      inventoryItemId: fixture.inventoryId,
      movementId,
    },
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
    operationId,
    workflowType: "patient_equipment.assign",
    status: "completed",
    movementIds: movementId ? [movementId] : [],
  });
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(1);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.patientId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "patient_equipment.assign")).toHaveLength(1);
}

async function expectPatientEquipmentAssignedState(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  actorUid = actor.uid,
) {
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "assigned",
    onRent: 1,
    available: 0,
    patientKey: fixture.patientId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).data()?.status).toBe("active");
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(false);
  expect((await db.collection("domainWorkflowOperations").doc(`${actorUid}_${operationId}`).get()).exists).toBe(false);
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
}

async function expectPatientEquipmentTransferred(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  movementId: string | undefined,
) {
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "assigned",
    onRent: 1,
    available: 0,
    patientKey: fixture.toPatientId,
    patientName: fixture.toPatientName,
    lastMovementId: movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "transferred",
    movementId,
  });
  expect((await db.collection("patients").doc(fixture.toPatientId).collection("equipment").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "active",
    transferredFromPatientId: fixture.patientId,
    movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).data()).toMatchObject({
    type: "equipment_transfer",
  });
  expect((await db.collection("patients").doc(fixture.toPatientId).collection("timeline").doc(operationId).get()).data()).toMatchObject({
    type: "equipment_transfer_received",
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
    operationId,
    workflowType: "patient_equipment.transfer",
    status: "completed",
  });
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(1);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.patientId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "patient_equipment.transfer")).toHaveLength(1);
}

async function expectPatientEquipmentRemoved(
  fixture: Awaited<ReturnType<typeof seedPatientEquipmentFixture>>,
  operationId: string,
  movementId: string | undefined,
) {
  expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "available",
    onRent: 0,
    available: 1,
    patientKey: "",
    patientName: "",
    lastMovementId: movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).data()).toMatchObject({
    status: "removed",
    movementId,
  });
  expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).data()).toMatchObject({
    type: "equipment_remove",
  });
  expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
    operationId,
    workflowType: "patient_equipment.remove",
    status: "completed",
  });
  expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(1);
  const audits = await db.collection("auditLogs").where("targetId", "==", fixture.patientId).get();
  expect(audits.docs.filter((doc) => doc.data().action === "patient_equipment.remove")).toHaveLength(1);
}

async function seedGeneralRateLimitExhausted(ip: string) {
  const hash = createHash("sha256").update(ip).digest("hex");
  await db.collection("rateLimitBuckets").doc(`v1:general:ip:${hash}`).set({
    tokens: 0,
    updatedAt: Date.now(),
    expiresAt: new Date(Date.now() + 120_000),
  });
}

describe("AHM Golden Regression Suite - emulator invariants", () => {
  it("GOLDEN-EMU-INV-001 records movement, operation, audit, and inventory state atomically", async () => {
    await seedInventory("golden-inv-001", { quantityOnHand: 10, available: 10 });

    const result = await createInventoryMovement(
      {
        operationId: "golden-emu-inv-001",
        movementType: "receive",
        inventoryItemId: "golden-inv-001",
        quantity: 4,
        reason: "Golden receive movement",
        source: "scanner",
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.quantityBefore).toBe(10);
    expect(result.quantityDelta).toBe(4);
    expect(result.quantityAfter).toBe(14);

    const inventory = (await db.collection("inventory").doc("golden-inv-001").get()).data();
    expect(inventory?.quantityOnHand).toBe(14);
    expect(inventory?.available).toBe(14);
    expect(inventory?.lastMovementId).toBe(result.movementId);

    expect(await countByOperation("inventoryTransactions", "golden-emu-inv-001")).toBe(1);
    const operation = await db.collection("inventoryOperations").doc(`${actor.uid}_golden-emu-inv-001`).get();
    expect(operation.data()).toMatchObject({
      operationId: "golden-emu-inv-001",
      operationType: "receive",
      status: "completed",
      movementId: result.movementId,
    });

    const audits = await db.collection("auditLogs").where("targetId", "==", "golden-inv-001").get();
    expect(audits.size).toBe(1);
    expect(audits.docs[0].data().details?.movementId).toBe(result.movementId);
  });

  it("GOLDEN-EMU-INV-002 failed movement leaves no partial mutation", async () => {
    await seedInventory("golden-inv-002", { quantityOnHand: 2, available: 2 });

    await expect(
      createInventoryMovement(
        {
          operationId: "golden-emu-inv-002",
          movementType: "lost",
          inventoryItemId: "golden-inv-002",
          quantity: 3,
          reason: "Invalid golden loss",
          source: "inventory_page",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const inventory = (await db.collection("inventory").doc("golden-inv-002").get()).data();
    expect(inventory?.quantityOnHand).toBe(2);
    expect(inventory?.available).toBe(2);
    expect(await countByOperation("inventoryTransactions", "golden-emu-inv-002")).toBe(0);
    const operation = await db.collection("inventoryOperations").doc(`${actor.uid}_golden-emu-inv-002`).get();
    expect(operation.exists).toBe(false);
  });

  it("GOLDEN-EMU-INV-003 duplicate idempotent movement does not execute twice", async () => {
    await seedInventory("golden-inv-003", { quantityOnHand: 5, available: 5 });
    const input = {
      operationId: "golden-emu-inv-003",
      movementType: "receive" as const,
      inventoryItemId: "golden-inv-003",
      quantity: 2,
      reason: "Golden duplicate receive",
      source: "scanner" as const,
    };

    const first = await createInventoryMovement(input, actor, db);
    const second = await createInventoryMovement(input, actor, db);

    expect(first.status).toBe("success");
    expect(second.status).toBe("duplicate_operation");
    expect(second.movementId).toBe(first.movementId);

    const inventory = (await db.collection("inventory").doc("golden-inv-003").get()).data();
    expect(inventory?.quantityOnHand).toBe(7);
    expect(await countByOperation("inventoryTransactions", "golden-emu-inv-003")).toBe(1);
  });

  it("GOLDEN-EMU-HARD-001 hard delete commits delete, movement, operation, and audit atomically", async () => {
    const inventoryId = "golden-hard-001";
    const operationId = "golden-emu-hard-001";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    const result = await createInventoryMovement(
      {
        operationId,
        movementType: "hard_delete",
        inventoryItemId: inventoryId,
        quantity: 1,
        reason: "Golden hard delete",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    expect(result.status).toBe("success");
    expect((await db.collection("inventory").doc(inventoryId).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", operationId)).toBe(1);

    const operation = await db
      .collection("inventoryOperations")
      .doc(`${adminActor.uid}_${operationId}`)
      .get();

    expect(operation.data()).toMatchObject({
      operationId,
      operationType: "hard_delete",
      status: "completed",
      movementId: result.movementId,
      inventoryItemId: inventoryId,
    });

    const audits = await db
      .collection("auditLogs")
      .where("targetId", "==", inventoryId)
      .get();

    expect(
      audits.docs.filter(
        (doc) => doc.data().action === "inventory.hard_delete"
      )
    ).toHaveLength(1);
  });

  it("GOLDEN-EMU-HARD-002 same hard-delete operation retries after inventory deletion", async () => {
    const inventoryId = "golden-hard-002";
    const operationId = "golden-emu-hard-002";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    const input = {
      operationId,
      movementType: "hard_delete" as const,
      inventoryItemId: inventoryId,
      quantity: 1,
      reason: "Golden retry hard delete",
      source: "inventory_page" as const,
    };

    const first = await createInventoryMovement(
      input,
      adminActor,
      db
    );

    expect(first.status).toBe("success");
    expect(
      (await db.collection("inventory").doc(inventoryId).get()).exists
    ).toBe(false);

    const retry = await createInventoryMovement(
      input,
      adminActor,
      db
    );

    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementId).toBe(first.movementId);

    expect(
      await countByOperation(
        "inventoryTransactions",
        operationId
      )
    ).toBe(1);

    const audits = await db
      .collection("auditLogs")
      .where("targetId", "==", inventoryId)
      .get();

    expect(
      audits.docs.filter(
        (doc) => doc.data().action === "inventory.hard_delete"
      )
    ).toHaveLength(1);
  });

  it("GOLDEN-EMU-HARD-003 conflicting hard-delete operation reuse fails after original deletion", async () => {
    const firstInventoryId = "golden-hard-003-a";
    const secondInventoryId = "golden-hard-003-b";
    const operationId = "golden-emu-hard-003";

    await seedInventory(firstInventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    await seedInventory(secondInventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    await createInventoryMovement(
      {
        operationId,
        movementType: "hard_delete",
        inventoryItemId: firstInventoryId,
        quantity: 1,
        reason: "Golden original hard delete",
        source: "inventory_page",
      },
      adminActor,
      db
    );

    expect(
      (await db.collection("inventory").doc(firstInventoryId).get()).exists
    ).toBe(false);

    await expect(
      createInventoryMovement(
        {
          operationId,
          movementType: "hard_delete",
          inventoryItemId: secondInventoryId,
          quantity: 1,
          reason: "Golden conflicting hard delete",
          source: "inventory_page",
        },
        adminActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });

    expect(
      (await db.collection("inventory").doc(secondInventoryId).get()).exists
    ).toBe(true);

    expect(
      await countByOperation(
        "inventoryTransactions",
        operationId
      )
    ).toBe(1);
  });

  it("GOLDEN-EMU-HARD-004 concurrent same-operation hard deletes execute once", async () => {
    const inventoryId = "golden-hard-004";
    const operationId = "golden-emu-hard-004";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    const input = {
      operationId,
      movementType: "hard_delete" as const,
      inventoryItemId: inventoryId,
      quantity: 1,
      reason: "Golden concurrent hard delete",
      source: "inventory_page" as const,
    };

    const settled = await Promise.allSettled([
      createInventoryMovement(input, adminActor, db),
      createInventoryMovement(input, adminActor, db),
    ]);

    expect(
      settled.every((result) => result.status === "fulfilled")
    ).toBe(true);

    const statuses = settled.map((result) =>
      result.status === "fulfilled"
        ? result.value.status
        : "rejected"
    );

    expect(statuses.sort()).toEqual([
      "duplicate_operation",
      "success",
    ]);

    expect(
      (await db.collection("inventory").doc(inventoryId).get()).exists
    ).toBe(false);

    expect(
      await countByOperation(
        "inventoryTransactions",
        operationId
      )
    ).toBe(1);

    const audits = await db
      .collection("auditLogs")
      .where("targetId", "==", inventoryId)
      .get();

    expect(
      audits.docs.filter(
        (doc) => doc.data().action === "inventory.hard_delete"
      )
    ).toHaveLength(1);
  });

  it("GOLDEN-EMU-HARD-005 movement history blocks hard delete without creating an operation", async () => {
    const inventoryId = "golden-hard-005";
    const operationId = "golden-emu-hard-005";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    await db.collection("inventoryTransactions").doc(
      "golden-hard-existing-movement-005"
    ).set({
      inventoryItemId: inventoryId,
      operationId: "golden-hard-prior-operation-005",
      movementType: "receive",
    });

    await expect(
      createInventoryMovement(
        {
          operationId,
          movementType: "hard_delete",
          inventoryItemId: inventoryId,
          quantity: 1,
          reason: "Golden protected hard delete",
          source: "inventory_page",
        },
        adminActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message:
        "Cannot hard delete inventory with movement history.",
    });

    expect(
      (await db.collection("inventory").doc(inventoryId).get()).exists
    ).toBe(true);

    expect(
      (
        await db
          .collection("inventoryOperations")
          .doc(`${adminActor.uid}_${operationId}`)
          .get()
      ).exists
    ).toBe(false);

    expect(
      await countByOperation(
        "inventoryTransactions",
        operationId
      )
    ).toBe(0);
  });

  it("GOLDEN-EMU-HARD-006 rental reference blocks hard delete", async () => {
    const inventoryId = "golden-hard-006";
    const operationId = "golden-emu-hard-006";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    await db.collection("rentals").doc(
      "golden-hard-rental-006"
    ).set({
      inventoryItemId: inventoryId,
    });

    await expect(
      createInventoryMovement(
        {
          operationId,
          movementType: "hard_delete",
          inventoryItemId: inventoryId,
          quantity: 1,
          reason: "Golden rental-protected hard delete",
          source: "inventory_page",
        },
        adminActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message:
        "Cannot hard delete inventory with rental references.",
    });

    expect(
      (await db.collection("inventory").doc(inventoryId).get()).exists
    ).toBe(true);

    expect(
      (
        await db
          .collection("inventoryOperations")
          .doc(`${adminActor.uid}_${operationId}`)
          .get()
      ).exists
    ).toBe(false);
  });

  it("GOLDEN-EMU-HARD-007 patient assignment blocks hard delete", async () => {
    const inventoryId = "golden-hard-007";
    const operationId = "golden-emu-hard-007";

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    await db.collection("patients").doc(
      "golden-hard-patient-007"
    ).set({
      currentEquipmentIds: [inventoryId],
    });

    await expect(
      createInventoryMovement(
        {
          operationId,
          movementType: "hard_delete",
          inventoryItemId: inventoryId,
          quantity: 1,
          reason: "Golden patient-protected hard delete",
          source: "inventory_page",
        },
        adminActor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message:
        "Cannot hard delete inventory with patient assignments.",
    });

    expect(
      (await db.collection("inventory").doc(inventoryId).get()).exists
    ).toBe(true);

    expect(
      (
        await db
          .collection("inventoryOperations")
          .doc(`${adminActor.uid}_${operationId}`)
          .get()
      ).exists
    ).toBe(false);
  });
  it("GOLDEN-EMU-CYCLE-001 applies an absolute cycle-count target", async () => {
    await seedInventory("golden-cycle-001", {
      barcode: "GOLDEN-CYCLE-SCAN-001",
      quantityOnHand: 10,
      available: 10,
    });

    const result = await invokeCycleCountInventoryByBarcode({
      operationId: "golden-emu-cycle-001",
      barcode: "GOLDEN-CYCLE-SCAN-001",
      quantity: 7,
      source: "manual_entry",
    });

    expect(result).toMatchObject({
      success: true,
      status: "success",
      inventoryItemId: "golden-cycle-001",
      quantityBefore: 10,
      quantityChange: -3,
      quantityAfter: 7,
    });

    const inventory = (
      await db.collection("inventory").doc("golden-cycle-001").get()
    ).data();

    expect(inventory?.quantityOnHand).toBe(7);
    expect(inventory?.available).toBe(7);

    expect(
      await countByOperation(
        "inventoryTransactions",
        "golden-emu-cycle-001"
      )
    ).toBe(1);
  });

  it("GOLDEN-EMU-CYCLE-002 duplicate cycle-count retry executes once", async () => {
    await seedInventory("golden-cycle-002", {
      barcode: "GOLDEN-CYCLE-SCAN-002",
      quantityOnHand: 10,
      available: 10,
    });

    const input = {
      operationId: "golden-emu-cycle-002",
      barcode: "GOLDEN-CYCLE-SCAN-002",
      quantity: 7,
      source: "manual_entry",
    };

    const first = await invokeCycleCountInventoryByBarcode(input);
    const retry = await invokeCycleCountInventoryByBarcode(input);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate");

    const inventory = (
      await db.collection("inventory").doc("golden-cycle-002").get()
    ).data();

    expect(inventory?.quantityOnHand).toBe(7);

    expect(
      await countByOperation(
        "inventoryTransactions",
        "golden-emu-cycle-002"
      )
    ).toBe(1);
  });

  it("GOLDEN-EMU-CYCLE-003 conflicting target with same operation ID fails closed", async () => {
    await seedInventory("golden-cycle-003", {
      barcode: "GOLDEN-CYCLE-SCAN-003",
      quantityOnHand: 10,
      available: 10,
    });

    await invokeCycleCountInventoryByBarcode({
      operationId: "golden-emu-cycle-003",
      barcode: "GOLDEN-CYCLE-SCAN-003",
      quantity: 7,
      source: "manual_entry",
    });

    await expect(
      invokeCycleCountInventoryByBarcode({
        operationId: "golden-emu-cycle-003",
        barcode: "GOLDEN-CYCLE-SCAN-003",
        quantity: 6,
        source: "manual_entry",
      })
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });

    const inventory = (
      await db.collection("inventory").doc("golden-cycle-003").get()
    ).data();

    expect(inventory?.quantityOnHand).toBe(7);

    expect(
      await countByOperation(
        "inventoryTransactions",
        "golden-emu-cycle-003"
      )
    ).toBe(1);
  });

  it("GOLDEN-EMU-CYCLE-004 missing operation ID is rejected before mutation", async () => {
    await seedInventory("golden-cycle-004", {
      barcode: "GOLDEN-CYCLE-SCAN-004",
      quantityOnHand: 10,
      available: 10,
    });

    await expect(
      invokeCycleCountInventoryByBarcode({
        barcode: "GOLDEN-CYCLE-SCAN-004",
        quantity: 7,
        source: "manual_entry",
      })
    ).rejects.toMatchObject({
      code: "invalid-argument",
    });

    const inventory = (
      await db.collection("inventory").doc("golden-cycle-004").get()
    ).data();

    expect(inventory?.quantityOnHand).toBe(10);
    expect(inventory?.available).toBe(10);

    expect(
      await countByOperation(
        "inventoryTransactions",
        "golden-emu-cycle-004"
      )
    ).toBe(0);
  });

  it("GOLDEN-EMU-CYCLE-005 absolute count uses current transactional quantity", async () => {
    await seedInventory("golden-cycle-005", {
      barcode: "GOLDEN-CYCLE-SCAN-005",
      quantityOnHand: 10,
      available: 10,
    });

    // Simulate an earlier caller/view having observed quantity 10.
    const staleSnapshot = (
      await db.collection("inventory").doc("golden-cycle-005").get()
    ).data();

    expect(staleSnapshot?.quantityOnHand).toBe(10);

    // Inventory changes before the authoritative cycle-count transaction.
    await db.collection("inventory").doc("golden-cycle-005").update({
      quantityOnHand: 14,
      available: 14,
    });

    const { setInventoryQuantityToCount } = await import(
      "../inventory/movementService.js"
    );

    const result = await setInventoryQuantityToCount(
      {
        operationId: "golden-emu-cycle-005",
        inventoryItemId: "golden-cycle-005",
        barcode: "GOLDEN-CYCLE-SCAN-005",
        targetQuantity: 7,
        reason: "Golden stale-snapshot cycle count",
        source: "scanner",
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.quantityBefore).toBe(14);
    expect(result.quantityDelta).toBe(-7);
    expect(result.quantityAfter).toBe(7);

    const inventory = (
      await db.collection("inventory").doc("golden-cycle-005").get()
    ).data();

    expect(inventory?.quantityOnHand).toBe(7);
    expect(inventory?.available).toBe(7);
  });
  it("GOLDEN-EMU-REC-001 valid receive operation succeeds exactly once", async () => {
    await seedInventory("golden-rec-001", { barcode: "GOLDEN-REC-SCAN-001", quantityOnHand: 20, available: 20 });

    const result = await invokeReceiveInventoryByBarcode({
      operationId: "golden-emu-rec-001",
      barcode: "GOLDEN-REC-SCAN-001",
      rawScan: "GOLDEN-REC-SCAN-001",
      quantity: 6,
      source: "manual_entry",
    });

    expect(result.status).toBe("success");
    expect(result.quantityAfter).toBe(26);
    const inventory = (await db.collection("inventory").doc("golden-rec-001").get()).data();
    expect(inventory).toMatchObject({
      barcode: "GOLDEN-REC-SCAN-001",
      quantityOnHand: 26,
      available: 26,
      lastMovementId: result.transactionId,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-001")).toBe(1);
  });

  it("GOLDEN-EMU-REC-002 retry with same operation ID does not duplicate receive mutations", async () => {
    await seedInventory("golden-rec-002", { barcode: "GOLDEN-REC-SCAN-002", quantityOnHand: 30, available: 30 });
    const input = {
      operationId: "golden-emu-rec-002",
      barcode: "GOLDEN-REC-SCAN-002",
      rawScan: "GOLDEN-REC-SCAN-002",
      quantity: 5,
      source: "manual_entry",
    };

    const first = await invokeReceiveInventoryByBarcode(input);
    const retry = await invokeReceiveInventoryByBarcode(input);

    expect(retry).toMatchObject(first);
    const inventory = (await db.collection("inventory").doc("golden-rec-002").get()).data();
    expect(inventory?.quantityOnHand).toBe(35);
    expect(inventory?.available).toBe(35);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-002")).toBe(1);
  });

  it("GOLDEN-EMU-REC-003 conflicting receive operation ID reuse fails closed", async () => {
    await seedInventory("golden-rec-003", { barcode: "GOLDEN-REC-SCAN-003", quantityOnHand: 40, available: 40 });
    const baseInput = {
      operationId: "golden-emu-rec-003",
      barcode: "GOLDEN-REC-SCAN-003",
      rawScan: "GOLDEN-REC-SCAN-003",
      quantity: 4,
      source: "manual_entry",
    };

    await invokeReceiveInventoryByBarcode(baseInput);

    await expect(
      invokeReceiveInventoryByBarcode({ ...baseInput, quantity: 9 })
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const inventory = (await db.collection("inventory").doc("golden-rec-003").get()).data();
    expect(inventory?.quantityOnHand).toBe(44);
    expect(inventory?.available).toBe(44);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-003")).toBe(1);
  });

  it("GOLDEN-EMU-REC-004 receive-scanned product create path is transaction-safe and idempotent", async () => {
    await seedProduct("golden-rec-product-004", {
      name: "Golden scanned intake product",
      sku: "GOLDEN-REC-SCAN-004",
      upc: "GOLDEN-REC-SCAN-004",
      defaultPurchasePrice: 12.5,
      reorderLevel: 2,
    });
    const input = {
      operationId: "golden-emu-rec-004",
      mode: "product-match" as const,
      productId: "golden-rec-product-004",
      rawScan: "GOLDEN-REC-SCAN-004",
      normalizedScan: "GOLDEN-REC-SCAN-004",
      quantity: 7,
      locationId: "Golden Warehouse",
    };

    const first = await receiveScannedInventoryIntake(input, actor, db);
    const retry = await receiveScannedInventoryIntake(input, actor, db);

    expect(first).toMatchObject({
      status: "success",
      createdOrMerged: "created",
      mode: "product-match",
      quantityBefore: 0,
      quantityChange: 7,
      quantityAfter: 7,
    });
    expect(retry).toMatchObject(first);
    const inventory = (await db.collection("inventory").doc(first.inventoryItemId).get()).data();
    expect(inventory).toMatchObject({
      productId: "golden-rec-product-004",
      barcode: "GOLDEN-REC-SCAN-004",
      quantityOnHand: 7,
      available: 7,
      locationName: "Golden Warehouse",
      scanSource: "product_catalog_scan",
      pendingScanReview: false,
      lastMovementId: first.movementId,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-004")).toBe(1);
    const operation = await db.collection("inventoryOperations").doc(`${actor.uid}_golden-emu-rec-004`).get();
    expect(operation.data()).toMatchObject({
      operationId: "golden-emu-rec-004",
      operationType: "receive",
      status: "completed",
      intakeMode: "product-match",
      intakeResult: {
        status: "success",
        inventoryItemId: first.inventoryItemId,
        movementId: first.movementId,
      },
    });
  });

  it("GOLDEN-EMU-REC-005 receive-scanned product merge path is transaction-safe", async () => {
    await seedProduct("golden-rec-product-005", {
      name: "Golden merge product",
      sku: "GOLDEN-REC-SCAN-005",
      upc: "GOLDEN-REC-SCAN-005",
    });
    await seedInventory("product-scan-golden-rec-product-005-GOLDEN-REC-SCAN-005", {
      name: "Existing golden merge inventory",
      productId: "golden-rec-product-005",
      barcode: "GOLDEN-REC-SCAN-005",
      quantityOnHand: 4,
      available: 4,
      locationName: "Old Location",
      scanSource: "legacy",
      pendingScanReview: true,
    });

    const result = await receiveScannedInventoryIntake(
      {
        operationId: "golden-emu-rec-005",
        mode: "product-match",
        productId: "golden-rec-product-005",
        rawScan: "GOLDEN-REC-SCAN-005",
        normalizedScan: "GOLDEN-REC-SCAN-005",
        quantity: 3,
        locationId: "Merged Location",
      },
      actor,
      db
    );

    expect(result).toMatchObject({
      status: "success",
      createdOrMerged: "merged",
      quantityBefore: 4,
      quantityChange: 3,
      quantityAfter: 7,
    });
    const inventory = (await db.collection("inventory").doc(result.inventoryItemId).get()).data();
    expect(inventory).toMatchObject({
      productId: "golden-rec-product-005",
      barcode: "GOLDEN-REC-SCAN-005",
      quantityOnHand: 7,
      available: 7,
      locationName: "Merged Location",
      scanSource: "product_catalog_scan",
      pendingScanReview: false,
      lastMovementId: result.movementId,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-005")).toBe(1);
  });

  it("GOLDEN-EMU-REC-006 receive-scanned create failure rolls back without orphan records", async () => {
    await expect(
      receiveScannedInventoryIntake(
        {
          operationId: "golden-emu-rec-006",
          mode: "product-match",
          productId: "missing-golden-rec-product-006",
          rawScan: "GOLDEN-REC-SCAN-006",
          normalizedScan: "GOLDEN-REC-SCAN-006",
          quantity: 2,
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "not-found" });

    expect((await db.collection("inventory").doc("product-scan-missing-golden-rec-product-006-GOLDEN-REC-SCAN-006").get()).exists).toBe(false);
    expect((await db.collection("inventoryOperations").doc(`${actor.uid}_golden-emu-rec-006`).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-006")).toBe(0);
  });

  it("GOLDEN-EMU-REC-007 receive-scanned merge retry, conflict, independent operation, and concurrency are stable", async () => {
    await seedProduct("golden-rec-product-007", {
      name: "Golden retry product",
      sku: "GOLDEN-REC-SCAN-007",
      upc: "GOLDEN-REC-SCAN-007",
    });
    await seedInventory("product-scan-golden-rec-product-007-GOLDEN-REC-SCAN-007", {
      productId: "golden-rec-product-007",
      barcode: "GOLDEN-REC-SCAN-007",
      quantityOnHand: 8,
      available: 8,
    });
    const input = {
      operationId: "golden-emu-rec-007",
      mode: "product-match" as const,
      productId: "golden-rec-product-007",
      rawScan: "GOLDEN-REC-SCAN-007",
      normalizedScan: "GOLDEN-REC-SCAN-007",
      quantity: 2,
      locationId: "Stable Location",
    };

    const first = await receiveScannedInventoryIntake(input, actor, db);
    const retry = await receiveScannedInventoryIntake(input, actor, db);
    await expect(
      receiveScannedInventoryIntake({ ...input, quantity: 5 }, actor, db)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    const independent = await receiveScannedInventoryIntake(
      { ...input, operationId: "golden-emu-rec-007-independent", quantity: 1 },
      actor,
      db
    );
    const concurrentInput = {
      ...input,
      operationId: "golden-emu-rec-007-concurrent",
      quantity: 4,
    };
    const concurrent = await Promise.allSettled([
      receiveScannedInventoryIntake(concurrentInput, actor, db),
      receiveScannedInventoryIntake(concurrentInput, actor, db),
    ]);

    expect(retry).toMatchObject(first);
    expect(independent.quantityAfter).toBe(11);
    expect(concurrent.every((result) => result.status === "fulfilled")).toBe(true);
    const concurrentResults = concurrent.map((result) => result.status === "fulfilled" ? result.value : null);
    expect(new Set(concurrentResults.map((result) => result?.movementId)).size).toBe(1);
    const inventory = (await db.collection("inventory").doc(first.inventoryItemId).get()).data();
    expect(inventory?.quantityOnHand).toBe(15);
    expect(inventory?.available).toBe(15);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-007")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-007-independent")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rec-007-concurrent")).toBe(1);
  });

  it("GOLDEN-EMU-RENT-001 create-and-checkout rental completes atomically", async () => {
    await seedProduct("golden-product-rent-001");
    await seedInventory("golden-rent-inv-001", {
      productId: "golden-product-rent-001",
      serialNumber: "GOLDEN-RENT-SN-001",
      quantityOnHand: 1,
      available: 1,
    });
    await seedPatient("golden-patient-rent-001");

    const result = await createAndCheckoutRentalWorkflow(
      {
        operationId: "golden-emu-rent-001",
        rentalId: "golden-rental-001",
        inventoryItemId: "golden-rent-inv-001",
        productId: "golden-product-rent-001",
        patientId: "golden-patient-rent-001",
        patientName: "Synthetic Rental Patient",
        serialNumber: "GOLDEN-RENT-SN-001",
        quantity: 1,
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    const rental = (await db.collection("rentals").doc("golden-rental-001").get()).data();
    expect(rental?.status).toBe("checked_out");
    expect(rental?.movementId).toBe(result.movementIds?.[0]);

    const inventory = (await db.collection("inventory").doc("golden-rent-inv-001").get()).data();
    expect(inventory).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      rentalId: "golden-rental-001",
      patientKey: "golden-patient-rent-001",
    });

    const equipment = await db
      .collection("patients")
      .doc("golden-patient-rent-001")
      .collection("equipment")
      .doc("golden-rent-inv-001")
      .get();
    expect(equipment.data()?.status).toBe("active");
    const timeline = await db.collection("patients").doc("golden-patient-rent-001").collection("timeline").doc("golden-emu-rent-001").get();
    expect(timeline.exists).toBe(true);
    const operation = await db.collection("domainWorkflowOperations").doc(`${actor.uid}_golden-emu-rent-001`).get();
    expect(operation.data()?.status).toBe("completed");
  });

  it("GOLDEN-EMU-RENT-002 failed rental transition leaves no partial state", async () => {
    await seedInventory("golden-rent-inv-002", { quantityOnHand: 1, available: 1 });

    await expect(
      createAndCheckoutRentalWorkflow(
        {
          operationId: "golden-emu-rent-002",
          rentalId: "golden-rental-002",
          inventoryItemId: "golden-rent-inv-002",
          patientId: "missing-golden-patient",
          quantity: 1,
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "not-found" });

    expect((await db.collection("rentals").doc("golden-rental-002").get()).exists).toBe(false);
    expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_golden-emu-rent-002`).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-002-movement")).toBe(0);
    const inventory = (await db.collection("inventory").doc("golden-rent-inv-002").get()).data();
    expect(inventory?.onRent).toBe(0);
    expect(inventory?.available).toBe(1);
  });

  it("GOLDEN-EMU-RENT-003 rental exchange commits rental, inventory, patient equipment, timeline, audit, and operation atomically", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-003");

    const result = await exchangeRentalWorkflow(
      {
        operationId: "golden-emu-rent-003",
        rentalId: fixture.rentalId,
        inventoryItemId: fixture.oldInventoryId,
        replacementInventoryItemId: fixture.replacementInventoryId,
        productId: fixture.productId,
        replacementProductId: fixture.productId,
        patientId: fixture.patientId,
        patientName: "Exchange Patient golden-rent-003",
        serialNumber: "golden-rent-003-OLD-SN",
        replacementSerialNumber: "golden-rent-003-NEW-SN",
        quantity: 1,
        reason: "Golden rental exchange success",
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.movementIds).toHaveLength(2);
    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental).toMatchObject({
      status: "checked_out",
      previousInventoryItemId: fixture.oldInventoryId,
      inventoryItemId: fixture.replacementInventoryId,
      itemId: fixture.replacementInventoryId,
      productId: fixture.productId,
      patientId: fixture.patientId,
      exchangeReturnMovementId: result.movementIds?.[0],
      exchangeCheckoutMovementId: result.movementIds?.[1],
    });

    const oldInventory = (await db.collection("inventory").doc(fixture.oldInventoryId).get()).data();
    expect(oldInventory).toMatchObject({
      status: "available",
      onRent: 0,
      available: 1,
      patientKey: "",
      patientName: "",
      rentalId: "",
      lastMovementId: result.movementIds?.[0],
    });
    const replacementInventory = (await db.collection("inventory").doc(fixture.replacementInventoryId).get()).data();
    expect(replacementInventory).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      patientKey: fixture.patientId,
      rentalId: fixture.rentalId,
      lastMovementId: result.movementIds?.[1],
    });

    const oldEquipment = await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get();
    expect(oldEquipment.data()).toMatchObject({
      inventoryId: fixture.oldInventoryId,
      status: "returned",
      movementId: result.movementIds?.[0],
    });
    const replacementEquipment = await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.replacementInventoryId).get();
    expect(replacementEquipment.data()).toMatchObject({
      inventoryId: fixture.replacementInventoryId,
      status: "active",
      rentalId: fixture.rentalId,
      replacesInventoryItemId: fixture.oldInventoryId,
      movementId: result.movementIds?.[1],
    });
    const timeline = await db.collection("patients").doc(fixture.patientId).collection("timeline").doc("golden-emu-rent-003").get();
    expect(timeline.data()).toMatchObject({
      type: "rental_exchanged",
      metadata: {
        rentalId: fixture.rentalId,
        oldInventoryItemId: fixture.oldInventoryId,
        replacementInventoryItemId: fixture.replacementInventoryId,
      },
    });
    const operation = await db.collection("domainWorkflowOperations").doc(`${actor.uid}_golden-emu-rent-003`).get();
    expect(operation.data()).toMatchObject({
      operationId: "golden-emu-rent-003",
      workflowType: "rental.exchange",
      status: "completed",
      movementIds: result.movementIds,
    });
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.exchange")).toHaveLength(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-003-return")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-003-checkout")).toBe(1);
  });

  it("GOLDEN-EMU-RENT-004 failed rental exchange rolls back completely", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-004", {
      replacementInventory: {
        status: "rental_out",
        onRent: 1,
        available: 0,
        patientKey: "other-patient",
        rentalId: "other-rental",
      },
    });

    await expect(
      exchangeRentalWorkflow(
        {
          operationId: "golden-emu-rent-004",
          rentalId: fixture.rentalId,
          inventoryItemId: fixture.oldInventoryId,
          replacementInventoryItemId: fixture.replacementInventoryId,
          productId: fixture.productId,
          replacementProductId: fixture.productId,
          patientId: fixture.patientId,
          serialNumber: "golden-rent-004-OLD-SN",
          replacementSerialNumber: "golden-rent-004-NEW-SN",
          quantity: 1,
          reason: "Golden rental exchange rollback",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental).toMatchObject({
      status: "checked_out",
      inventoryItemId: fixture.oldInventoryId,
      itemId: fixture.oldInventoryId,
      serialNumber: "golden-rent-004-OLD-SN",
    });
    const oldInventory = (await db.collection("inventory").doc(fixture.oldInventoryId).get()).data();
    expect(oldInventory).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      patientKey: fixture.patientId,
      rentalId: fixture.rentalId,
    });
    const replacementInventory = (await db.collection("inventory").doc(fixture.replacementInventoryId).get()).data();
    expect(replacementInventory).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      patientKey: "other-patient",
      rentalId: "other-rental",
    });
    const oldEquipment = await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get();
    expect(oldEquipment.data()?.status).toBe("active");
    const replacementEquipment = await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.replacementInventoryId).get();
    expect(replacementEquipment.exists).toBe(false);
    const timeline = await db.collection("patients").doc(fixture.patientId).collection("timeline").doc("golden-emu-rent-004").get();
    expect(timeline.exists).toBe(false);
    expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_golden-emu-rent-004`).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-004-return")).toBe(0);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-004-checkout")).toBe(0);
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.exchange")).toHaveLength(0);
  });

  it("GOLDEN-EMU-RENT-005 duplicate rental exchange operation is idempotent", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-005");
    const input = {
      operationId: "golden-emu-rent-005",
      rentalId: fixture.rentalId,
      inventoryItemId: fixture.oldInventoryId,
      replacementInventoryItemId: fixture.replacementInventoryId,
      productId: fixture.productId,
      replacementProductId: fixture.productId,
      patientId: fixture.patientId,
      serialNumber: "golden-rent-005-OLD-SN",
      replacementSerialNumber: "golden-rent-005-NEW-SN",
      quantity: 1,
      reason: "Golden rental exchange duplicate",
    };

    const first = await exchangeRentalWorkflow(input, actor, db);
    const retry = await exchangeRentalWorkflow(input, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(first.movementIds);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-005-return")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-005-checkout")).toBe(1);
    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental).toMatchObject({
      inventoryItemId: fixture.replacementInventoryId,
      exchangeReturnMovementId: first.movementIds?.[0],
      exchangeCheckoutMovementId: first.movementIds?.[1],
    });
  });

  it("GOLDEN-EMU-RENT-006 conflicting rental exchange operation ID fails closed", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-006");
    const conflictReplacementId = "golden-rent-006-conflict-replacement";
    await seedInventory(conflictReplacementId, {
      productId: fixture.productId,
      serialNumber: "golden-rent-006-CONFLICT-SN",
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "active",
    });
    const input = {
      operationId: "golden-emu-rent-006",
      rentalId: fixture.rentalId,
      inventoryItemId: fixture.oldInventoryId,
      replacementInventoryItemId: fixture.replacementInventoryId,
      productId: fixture.productId,
      replacementProductId: fixture.productId,
      patientId: fixture.patientId,
      serialNumber: "golden-rent-006-OLD-SN",
      replacementSerialNumber: "golden-rent-006-NEW-SN",
      quantity: 1,
      reason: "Golden rental exchange conflict",
    };

    const first = await exchangeRentalWorkflow(input, actor, db);
    await expect(
      exchangeRentalWorkflow(
        {
          ...input,
          replacementInventoryItemId: conflictReplacementId,
          replacementSerialNumber: "golden-rent-006-CONFLICT-SN",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental?.inventoryItemId).toBe(fixture.replacementInventoryId);
    expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(conflictReplacementId).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-006-return")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-006-checkout")).toBe(1);
    expect(first.movementIds).toEqual(rental?.exchangeReturnMovementId && rental?.exchangeCheckoutMovementId
      ? [rental.exchangeReturnMovementId, rental.exchangeCheckoutMovementId]
      : first.movementIds);
  });

  it("GOLDEN-EMU-RENT-007 concurrent duplicate rental exchange produces one logical exchange", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-007");
    const input = {
      operationId: "golden-emu-rent-007",
      rentalId: fixture.rentalId,
      inventoryItemId: fixture.oldInventoryId,
      replacementInventoryItemId: fixture.replacementInventoryId,
      productId: fixture.productId,
      replacementProductId: fixture.productId,
      patientId: fixture.patientId,
      serialNumber: "golden-rent-007-OLD-SN",
      replacementSerialNumber: "golden-rent-007-NEW-SN",
      quantity: 1,
      reason: "Golden rental exchange concurrent duplicate",
    };

    const settled = await Promise.allSettled([
      exchangeRentalWorkflow(input, actor, db),
      exchangeRentalWorkflow(input, actor, db),
    ]);

    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const results = settled.map((result) => result.status === "fulfilled" ? result.value : null);
    expect(results.some((result) => result?.status === "success")).toBe(true);
    expect(results.some((result) => result?.status === "duplicate_operation")).toBe(true);
    expect(new Set(results.flatMap((result) => result?.movementIds ?? [])).size).toBe(2);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-007-return")).toBe(1);
    expect(await countByOperation("inventoryTransactions", "golden-emu-rent-007-checkout")).toBe(1);
    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental).toMatchObject({
      inventoryItemId: fixture.replacementInventoryId,
      previousInventoryItemId: fixture.oldInventoryId,
    });
    const oldInventory = (await db.collection("inventory").doc(fixture.oldInventoryId).get()).data();
    const replacementInventory = (await db.collection("inventory").doc(fixture.replacementInventoryId).get()).data();
    expect(oldInventory).toMatchObject({ status: "available", onRent: 0, available: 1 });
    expect(replacementInventory).toMatchObject({ status: "rental_out", onRent: 1, available: 0 });
  });

  it("GOLDEN-EMU-RENT-CALL-001 unauthenticated exchange request is rejected", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-001");
    const operationId = "golden-emu-rent-call-001";

    await expect(
      invokeExchangeRentalCallable(exchangeCallableInput(fixture, operationId))
    ).rejects.toMatchObject({
      code: "unauthenticated",
      message: "You must be signed in to access inventory.",
    });

    await expectExchangeFixtureUnchanged(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CALL-002 unauthorized authenticated role is rejected", async () => {
    const unauthorizedUid = "golden-rent-call-002-viewer";
    await seedUser(unauthorizedUid, {
      role: "viewer",
      email: "golden.viewer@example.test",
    });
    const fixture = await seedExchangeRentalFixture("golden-rent-call-002");
    const operationId = "golden-emu-rent-call-002";

    await expect(
      invokeExchangeRentalCallable(
        exchangeCallableInput(fixture, operationId),
        { uid: unauthorizedUid, email: "golden.viewer@example.test", role: "viewer" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectExchangeFixtureUnchanged(fixture, operationId, unauthorizedUid);
  });

  it("GOLDEN-EMU-RENT-CALL-003 authorized rental exchange succeeds through callable boundary", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-003");
    const operationId = "golden-emu-rent-call-003";

    const result = await invokeExchangeRentalCallable(
      exchangeCallableInput(fixture, operationId),
      actor
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("rental.exchange");
    expect(result.movementIds).toHaveLength(2);
    const rental = (await db.collection("rentals").doc(fixture.rentalId).get()).data();
    expect(rental).toMatchObject({
      status: "checked_out",
      previousInventoryItemId: fixture.oldInventoryId,
      inventoryItemId: fixture.replacementInventoryId,
      exchangeReturnMovementId: result.movementIds?.[0],
      exchangeCheckoutMovementId: result.movementIds?.[1],
    });
    expect((await db.collection("inventory").doc(fixture.oldInventoryId).get()).data()).toMatchObject({
      status: "available",
      onRent: 0,
      available: 1,
      patientKey: "",
      rentalId: "",
    });
    expect((await db.collection("inventory").doc(fixture.replacementInventoryId).get()).data()).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      patientKey: fixture.patientId,
      rentalId: fixture.rentalId,
    });
    expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get()).data()?.status).toBe("returned");
    expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.replacementInventoryId).get()).data()).toMatchObject({
      status: "active",
      rentalId: fixture.rentalId,
      replacesInventoryItemId: fixture.oldInventoryId,
    });
    expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).data()?.type).toBe("rental_exchanged");
    expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).data()).toMatchObject({
      operationId,
      workflowType: "rental.exchange",
      status: "completed",
    });
    expect(await countByOperation("inventoryTransactions", `${operationId}-return`)).toBe(1);
    expect(await countByOperation("inventoryTransactions", `${operationId}-checkout`)).toBe(1);
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.exchange")).toHaveLength(1);
  });

  it("GOLDEN-EMU-RENT-CALL-004 disabled otherwise-authorized user is rejected", async () => {
    const disabledUid = "golden-rent-call-004-disabled";
    await seedUser(disabledUid, {
      role: "admin",
      disabled: true,
      email: "golden.disabled@example.test",
    });
    const fixture = await seedExchangeRentalFixture("golden-rent-call-004");
    const operationId = "golden-emu-rent-call-004";

    await expect(
      invokeExchangeRentalCallable(
        exchangeCallableInput(fixture, operationId),
        { uid: disabledUid, email: "golden.disabled@example.test", role: "admin" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectExchangeFixtureUnchanged(fixture, operationId, disabledUid);
  });

  it("GOLDEN-EMU-RENT-CALL-005 malformed exchange request fails closed", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-005");
    const operationId = "golden-emu-rent-call-005";

    await expect(
      invokeExchangeRentalCallable(
        exchangeCallableInput(fixture, operationId, { rentalId: "" }),
        actor
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "rentalId is not a safe document ID.",
    });

    await expectExchangeFixtureUnchanged(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CALL-006 duplicate callable retry produces one logical exchange", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-006");
    const operationId = "golden-emu-rent-call-006";
    const input = exchangeCallableInput(fixture, operationId);

    const first = await invokeExchangeRentalCallable(input, actor);
    const retry = await invokeExchangeRentalCallable(input, actor);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(first.movementIds);
    expect(await countByOperation("inventoryTransactions", `${operationId}-return`)).toBe(1);
    expect(await countByOperation("inventoryTransactions", `${operationId}-checkout`)).toBe(1);
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.exchange")).toHaveLength(1);
    expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(true);
  });

  it("GOLDEN-EMU-RENT-CALL-007 same operation ID with conflicting request fails closed", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-007");
    const conflictReplacementId = "golden-rent-call-007-conflict-replacement";
    await seedInventory(conflictReplacementId, {
      productId: fixture.productId,
      serialNumber: "golden-rent-call-007-CONFLICT-SN",
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "active",
    });
    const operationId = "golden-emu-rent-call-007";
    const input = exchangeCallableInput(fixture, operationId);
    const first = await invokeExchangeRentalCallable(input, actor);

    await expect(
      invokeExchangeRentalCallable(
        {
          ...input,
          replacementInventoryItemId: conflictReplacementId,
          replacementSerialNumber: "golden-rent-call-007-CONFLICT-SN",
        },
        actor
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This operationId was already used with different workflow data.",
    });

    expect(first.status).toBe("success");
    expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()?.inventoryItemId).toBe(fixture.replacementInventoryId);
    expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(conflictReplacementId).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", `${operationId}-return`)).toBe(1);
    expect(await countByOperation("inventoryTransactions", `${operationId}-checkout`)).toBe(1);
  });

  it("GOLDEN-EMU-RENT-CALL-008 rate-limited caller is rejected before domain mutation", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-call-008");
    const operationId = "golden-emu-rent-call-008";
    const limitedIp = "203.0.113.8";
    await seedGeneralRateLimitExhausted(limitedIp);

    await expect(
      invokeExchangeRentalCallable(
        exchangeCallableInput(fixture, operationId),
        actor,
        limitedIp
      )
    ).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Too many requests.",
    });

    await expectExchangeFixtureUnchanged(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-RET-001 successful rental return commits atomically", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-001");
    const operationId = "golden-emu-rent-ret-001";

    const result = await returnRentalWorkflow(
      returnWorkflowInput(fixture, operationId),
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("rental.return");
    expect(result.movementIds).toHaveLength(1);
    await expectReturnCommitted(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-RENT-RET-002 failed rental return rolls back completely", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-002", {
      rental: { status: "returned" },
    });
    const operationId = "golden-emu-rent-ret-002";

    await expect(
      returnRentalWorkflow(
        returnWorkflowInput(fixture, operationId),
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Invalid rental state transition: returned -> available.",
    });

    expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()).toMatchObject({
      status: "returned",
      inventoryItemId: fixture.oldInventoryId,
      patientId: fixture.patientId,
    });
    expect((await db.collection("inventory").doc(fixture.oldInventoryId).get()).data()).toMatchObject({
      status: "rental_out",
      onRent: 1,
      available: 0,
      patientKey: fixture.patientId,
      rentalId: fixture.rentalId,
    });
    expect((await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.oldInventoryId).get()).data()?.status).toBe("active");
    expect((await db.collection("patients").doc(fixture.patientId).collection("timeline").doc(operationId).get()).exists).toBe(false);
    expect((await db.collection("domainWorkflowOperations").doc(`${actor.uid}_${operationId}`).get()).exists).toBe(false);
    expect(await countByOperation("inventoryTransactions", `${operationId}-movement`)).toBe(0);
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.return")).toHaveLength(0);
  });

  it("GOLDEN-EMU-RENT-RET-003 duplicate return operation executes once", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-003");
    const operationId = "golden-emu-rent-ret-003";
    const input = returnWorkflowInput(fixture, operationId);

    const first = await returnRentalWorkflow(input, actor, db);
    const retry = await returnRentalWorkflow(input, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(first.movementIds);
    await expectReturnCommitted(fixture, operationId, first.movementIds?.[0]);
  });

  it("GOLDEN-EMU-RENT-RET-004 conflicting reuse of return operation ID fails closed", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-004");
    const operationId = "golden-emu-rent-ret-004";
    const input = returnWorkflowInput(fixture, operationId);
    const first = await returnRentalWorkflow(input, actor, db);

    await expect(
      returnRentalWorkflow(
        { ...input, reason: "Conflicting return reason" },
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This operationId was already used with different workflow data.",
    });

    await expectReturnCommitted(fixture, operationId, first.movementIds?.[0]);
  });

  it("GOLDEN-EMU-RENT-RET-CALL-001 unauthenticated return rejected", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-call-001");
    const operationId = "golden-emu-rent-ret-call-001";

    await expect(
      invokeReturnRentalCallable(returnWorkflowInput(fixture, operationId))
    ).rejects.toMatchObject({
      code: "unauthenticated",
      message: "You must be signed in to access inventory.",
    });

    await expectReturnFixtureCheckedOut(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-RET-CALL-002 unauthorized return role rejected", async () => {
    const unauthorizedUid = "golden-rent-ret-call-002-viewer";
    await seedUser(unauthorizedUid, { role: "viewer", email: "golden.return.viewer@example.test" });
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-call-002");
    const operationId = "golden-emu-rent-ret-call-002";

    await expect(
      invokeReturnRentalCallable(
        returnWorkflowInput(fixture, operationId),
        { uid: unauthorizedUid, email: "golden.return.viewer@example.test", role: "viewer" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectReturnFixtureCheckedOut(fixture, operationId, unauthorizedUid);
  });

  it("GOLDEN-EMU-RENT-RET-CALL-003 authorized return succeeds", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-call-003");
    const operationId = "golden-emu-rent-ret-call-003";

    const result = await invokeReturnRentalCallable(
      returnWorkflowInput(fixture, operationId),
      actor
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("rental.return");
    expect(result.movementIds).toHaveLength(1);
    await expectReturnCommitted(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-RENT-RET-CALL-004 malformed return request rejected", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-call-004");
    const operationId = "golden-emu-rent-ret-call-004";

    await expect(
      invokeReturnRentalCallable(
        returnWorkflowInput(fixture, operationId, { rentalId: "" }),
        actor
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "rentalId is not a safe document ID.",
    });

    await expectReturnFixtureCheckedOut(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-RET-CALL-005 rate-limited return rejected before domain mutation", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-ret-call-005");
    const operationId = "golden-emu-rent-ret-call-005";
    const limitedIp = "203.0.113.15";
    await seedGeneralRateLimitExhausted(limitedIp);

    await expect(
      invokeReturnRentalCallable(
        returnWorkflowInput(fixture, operationId),
        actor,
        limitedIp
      )
    ).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Too many requests.",
    });

    await expectReturnFixtureCheckedOut(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-001 valid rental cancellation commits atomically", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-001");
    const operationId = "golden-emu-rent-can-001";

    const result = await cancelRentalWorkflow(
      cancelWorkflowInput(fixture, operationId),
      actor,
      db
    );

    expect(result).toMatchObject({
      status: "success",
      workflowType: "rental.cancel",
      movementIds: [],
    });
    await expectCancelCommitted(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-002 invalid cancellation leaves state unchanged", async () => {
    const fixture = await seedExchangeRentalFixture("golden-rent-can-002");
    const operationId = "golden-emu-rent-can-002";

    await expect(
      cancelRentalWorkflow(
        { operationId, rentalId: fixture.rentalId, reason: "Invalid checked-out cancellation" },
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Invalid rental state transition: checked_out -> cancelled.",
    });

    await expectReturnFixtureCheckedOut(fixture, operationId);
    const audits = await db.collection("auditLogs").where("targetId", "==", fixture.rentalId).get();
    expect(audits.docs.filter((doc) => doc.data().action === "rental.cancel")).toHaveLength(0);
  });

  it("GOLDEN-EMU-RENT-CAN-003 duplicate cancellation operation is idempotent", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-003");
    const operationId = "golden-emu-rent-can-003";
    const input = cancelWorkflowInput(fixture, operationId);

    const first = await cancelRentalWorkflow(input, actor, db);
    const retry = await cancelRentalWorkflow(input, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual([]);
    await expectCancelCommitted(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-004 conflicting cancellation operation reuse fails closed", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-004");
    const operationId = "golden-emu-rent-can-004";
    const input = cancelWorkflowInput(fixture, operationId);

    await cancelRentalWorkflow(input, actor, db);
    await expect(
      cancelRentalWorkflow(
        { ...input, reason: "Conflicting cancellation reason" },
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This operationId was already used with different workflow data.",
    });

    await expectCancelCommitted(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-CALL-001 unauthenticated cancellation rejected", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-call-001");
    const operationId = "golden-emu-rent-can-call-001";

    await expect(
      invokeCancelRentalCallable(cancelWorkflowInput(fixture, operationId))
    ).rejects.toMatchObject({
      code: "unauthenticated",
      message: "You must be signed in to access inventory.",
    });

    await expectCancelFixtureAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-CALL-002 unauthorized cancellation role rejected", async () => {
    const unauthorizedUid = "golden-rent-can-call-002-viewer";
    await seedUser(unauthorizedUid, { role: "viewer", email: "golden.cancel.viewer@example.test" });
    const fixture = await seedCancelableRentalFixture("golden-rent-can-call-002");
    const operationId = "golden-emu-rent-can-call-002";

    await expect(
      invokeCancelRentalCallable(
        cancelWorkflowInput(fixture, operationId),
        { uid: unauthorizedUid, email: "golden.cancel.viewer@example.test", role: "viewer" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectCancelFixtureAvailable(fixture, operationId, unauthorizedUid);
  });

  it("GOLDEN-EMU-RENT-CAN-CALL-003 authorized cancellation succeeds", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-call-003");
    const operationId = "golden-emu-rent-can-call-003";

    const result = await invokeCancelRentalCallable(
      cancelWorkflowInput(fixture, operationId),
      actor
    );

    expect(result).toMatchObject({
      status: "success",
      workflowType: "rental.cancel",
      movementIds: [],
    });
    await expectCancelCommitted(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-CALL-004 malformed cancellation request rejected", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-call-004");
    const operationId = "golden-emu-rent-can-call-004";

    await expect(
      invokeCancelRentalCallable(
        cancelWorkflowInput(fixture, operationId, { rentalId: "" }),
        actor
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "rentalId is not a safe document ID.",
    });

    await expectCancelFixtureAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-RENT-CAN-CALL-005 rate-limited cancellation rejected before mutation", async () => {
    const fixture = await seedCancelableRentalFixture("golden-rent-can-call-005");
    const operationId = "golden-emu-rent-can-call-005";
    const limitedIp = "203.0.113.25";
    await seedGeneralRateLimitExhausted(limitedIp);

    await expect(
      invokeCancelRentalCallable(
        cancelWorkflowInput(fixture, operationId),
        actor,
        limitedIp
      )
    ).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Too many requests.",
    });

    await expectCancelFixtureAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-PAT-ASSIGN-001 successful patient-equipment assignment commits atomically", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-assign-001");
    const operationId = "golden-emu-pat-assign-001";

    const result = await patientEquipmentWorkflow(
      patientEquipmentInput(fixture, operationId, "assign"),
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("patient_equipment.assign");
    expect(result.movementIds).toHaveLength(1);
    await expectPatientEquipmentActive(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-ASSIGN-002 invalid patient-equipment assignment rolls back completely", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-assign-002", { assigned: true });
    const operationId = "golden-emu-pat-assign-002";

    await expect(
      patientEquipmentWorkflow(
        patientEquipmentInput(fixture, operationId, "assign"),
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Serialized asset is already assigned to a patient.",
    });

    await expectPatientEquipmentAssignedState(fixture, operationId);
  });

  it("GOLDEN-EMU-PAT-ASSIGN-003 duplicate assignment operation is idempotent", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-assign-003");
    const operationId = "golden-emu-pat-assign-003";
    const input = patientEquipmentInput(fixture, operationId, "assign");

    const first = await patientEquipmentWorkflow(input, actor, db);
    const retry = await patientEquipmentWorkflow(input, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(first.movementIds);
    await expectPatientEquipmentActive(fixture, operationId, first.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-ASSIGN-004 conflicting assignment operation ID fails closed", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-assign-004");
    const otherFixture = await seedPatientEquipmentFixture("golden-pat-assign-004-other");
    const operationId = "golden-emu-pat-assign-004";
    const input = patientEquipmentInput(fixture, operationId, "assign");
    const first = await patientEquipmentWorkflow(input, actor, db);

    await expect(
      patientEquipmentWorkflow(
        {
          ...input,
          patientId: otherFixture.patientId,
          inventoryItemId: otherFixture.inventoryId,
          patientName: otherFixture.patientName,
        },
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This operationId was already used with different workflow data.",
    });

    await expectPatientEquipmentActive(fixture, operationId, first.movementIds?.[0]);
    expect((await db.collection("patients").doc(otherFixture.patientId).collection("equipment").doc(otherFixture.inventoryId).get()).exists).toBe(false);
    expect((await db.collection("inventory").doc(otherFixture.inventoryId).get()).data()).toMatchObject({
      status: "active",
      onRent: 0,
      available: 1,
    });
  });

  it("GOLDEN-EMU-PAT-XFER-001 valid transfer commits atomically", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-xfer-001", { assigned: true });
    const operationId = "golden-emu-pat-xfer-001";

    const result = await patientEquipmentWorkflow(
      patientEquipmentInput(fixture, operationId, "transfer"),
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("patient_equipment.transfer");
    expect(result.movementIds).toHaveLength(1);
    await expectPatientEquipmentTransferred(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-XFER-002 failed transfer leaves original assignment intact", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-xfer-002", { assigned: true });
    const operationId = "golden-emu-pat-xfer-002";

    await expect(
      patientEquipmentWorkflow(
        patientEquipmentInput(fixture, operationId, "transfer", { toPatientId: "missing-target-patient" }),
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "not-found",
      message: "Destination patient was not found.",
    });

    await expectPatientEquipmentAssignedState(fixture, operationId);
    expect((await db.collection("patients").doc(fixture.toPatientId).collection("equipment").doc(fixture.inventoryId).get()).exists).toBe(false);
  });

  it("GOLDEN-EMU-PAT-CONC-001 concurrent assignment attempts create one active assignment", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-conc-001");
    const operationId = "golden-emu-pat-conc-001";
    const input = patientEquipmentInput(fixture, operationId, "assign");

    const settled = await Promise.allSettled([
      patientEquipmentWorkflow(input, actor, db),
      patientEquipmentWorkflow(input, actor, db),
    ]);

    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const results = settled.map((result) => result.status === "fulfilled" ? result.value : null);
    expect(results.some((result) => result?.status === "success")).toBe(true);
    expect(results.some((result) => result?.status === "duplicate_operation")).toBe(true);
    expect(new Set(results.flatMap((result) => result?.movementIds ?? [])).size).toBe(1);
    const activeAssignments = await db.collectionGroup("equipment").where("inventoryId", "==", fixture.inventoryId).where("status", "==", "active").get();
    expect(activeAssignments.size).toBe(1);
    await expectPatientEquipmentActive(fixture, operationId, results.find((result) => result?.movementIds?.[0])?.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-REM-001 successful removal closes assignment and restores equipment state", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-rem-001", { assigned: true });
    const operationId = "golden-emu-pat-rem-001";

    const result = await patientEquipmentWorkflow(
      patientEquipmentInput(fixture, operationId, "remove"),
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("patient_equipment.remove");
    expect(result.movementIds).toHaveLength(1);
    await expectPatientEquipmentRemoved(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-REM-002 duplicate removal is idempotent", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-rem-002", { assigned: true });
    const operationId = "golden-emu-pat-rem-002";
    const input = patientEquipmentInput(fixture, operationId, "remove");

    const first = await patientEquipmentWorkflow(input, actor, db);
    const retry = await patientEquipmentWorkflow(input, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(first.movementIds);
    await expectPatientEquipmentRemoved(fixture, operationId, first.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-REM-003 invalid removal leaves state unchanged", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-rem-003");
    const operationId = "golden-emu-pat-rem-003";

    await expect(
      patientEquipmentWorkflow(
        patientEquipmentInput(fixture, operationId, "remove"),
        actor,
        db
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Equipment assignment was not found.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-PAT-CALL-001 unauthenticated assignment rejected", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-001");
    const operationId = "golden-emu-pat-call-001";

    await expect(
      invokePatientEquipmentCallable(patientEquipmentInput(fixture, operationId, "assign"))
    ).rejects.toMatchObject({
      code: "unauthenticated",
      message: "You must be signed in to access inventory.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-PAT-CALL-002 unauthorized role rejected", async () => {
    const unauthorizedUid = "golden-pat-call-002-viewer";
    await seedUser(unauthorizedUid, { role: "viewer", email: "golden.patient.viewer@example.test" });
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-002");
    const operationId = "golden-emu-pat-call-002";

    await expect(
      invokePatientEquipmentCallable(
        patientEquipmentInput(fixture, operationId, "assign"),
        { uid: unauthorizedUid, email: "golden.patient.viewer@example.test", role: "viewer" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId, unauthorizedUid);
  });

  it("GOLDEN-EMU-PAT-CALL-003 authorized assignment succeeds", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-003");
    const operationId = "golden-emu-pat-call-003";

    const result = await invokePatientEquipmentCallable(
      patientEquipmentInput(fixture, operationId, "assign"),
      actor
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("patient_equipment.assign");
    expect(result.movementIds).toHaveLength(1);
    await expectPatientEquipmentActive(fixture, operationId, result.movementIds?.[0]);
  });

  it("GOLDEN-EMU-PAT-CALL-004 malformed assignment input rejected", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-004");
    const operationId = "golden-emu-pat-call-004";

    await expect(
      invokePatientEquipmentCallable(
        patientEquipmentInput(fixture, operationId, "assign", { inventoryItemId: "" }),
        actor
      )
    ).rejects.toMatchObject({
      code: "invalid-argument",
      message: "inventoryItemId is not a safe document ID.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-PAT-CALL-005 disabled otherwise-authorized user rejected", async () => {
    const disabledUid = "golden-pat-call-005-disabled";
    await seedUser(disabledUid, {
      role: "admin",
      disabled: true,
      email: "golden.patient.disabled@example.test",
    });
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-005");
    const operationId = "golden-emu-pat-call-005";

    await expect(
      invokePatientEquipmentCallable(
        patientEquipmentInput(fixture, operationId, "assign"),
        { uid: disabledUid, email: "golden.patient.disabled@example.test", role: "admin" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId, disabledUid);
  });

  it("GOLDEN-EMU-PAT-CALL-006 rate-limited request rejected before mutation", async () => {
    const fixture = await seedPatientEquipmentFixture("golden-pat-call-006");
    const operationId = "golden-emu-pat-call-006";
    const limitedIp = "203.0.113.36";
    await seedGeneralRateLimitExhausted(limitedIp);

    await expect(
      invokePatientEquipmentCallable(
        patientEquipmentInput(fixture, operationId, "assign"),
        actor,
        limitedIp
      )
    ).rejects.toMatchObject({
      code: "resource-exhausted",
      message: "Too many requests.",
    });

    await expectPatientEquipmentAvailable(fixture, operationId);
  });

  it("GOLDEN-EMU-AUTH-001 unauthenticated movement callable is rejected", async () => {
    await seedInventory("golden-auth-inv-001");

    await expect(
      invokeCreateMovementCallable({
        operationId: "golden-emu-auth-001",
        movementType: "receive",
        inventoryItemId: "golden-auth-inv-001",
        quantity: 1,
      })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("GOLDEN-EMU-AUTH-002 non-admin caller is rejected from admin-only movement", async () => {
    await seedInventory("golden-auth-inv-002");
    await seedUser("golden-billing-001", { role: "billing" });

    await expect(
      invokeCreateMovementCallable(
        {
          operationId: "golden-emu-auth-002",
          movementType: "hard_delete",
          inventoryItemId: "golden-auth-inv-002",
          quantity: 1,
        },
        { uid: "golden-billing-001", role: "billing" }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("GOLDEN-EMU-AUTH-003 authorized admin callable succeeds", async () => {
    await seedInventory("golden-auth-inv-003", { quantityOnHand: 2, available: 2 });

    const result = await invokeCreateMovementCallable(
      {
        operationId: "golden-emu-auth-003",
        movementType: "receive",
        inventoryItemId: "golden-auth-inv-003",
        quantity: 1,
        source: "inventory_page",
      },
      { uid: adminActor.uid, role: "admin" }
    ) as { status: string; quantityAfter?: number };

    expect(result.status).toBe("success");
    expect(result.quantityAfter).toBe(3);
  });

  it("GOLDEN-EMU-AUTH-004 disabled admin callable fails closed", async () => {
    await seedInventory("golden-auth-inv-004");
    await seedUser("golden-disabled-admin-001", {
      role: "admin",
      active: false,
      disabled: true,
    });

    await expect(
      invokeCreateMovementCallable(
        {
          operationId: "golden-emu-auth-004",
          movementType: "receive",
          inventoryItemId: "golden-auth-inv-004",
          quantity: 1,
        },
        { uid: "golden-disabled-admin-001", role: "admin" }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("GOLDEN-EMU-AUTH-005 technician inventory writer succeeds", async () => {
    const uid = "golden-technician-005";
    const inventoryId = "golden-auth-inv-005";

    await seedUser(uid, {
      role: "technician",
      email: "golden.technician@example.test",
    });

    await seedInventory(inventoryId, {
      quantityOnHand: 2,
      available: 2,
    });

    const result = await invokeCreateMovementCallable(
      {
        operationId: "golden-emu-auth-005",
        movementType: "receive",
        inventoryItemId: inventoryId,
        quantity: 1,
        source: "inventory_page",
      },
      {
        uid,
        role: "technician",
      },
    ) as { status: string; quantityAfter?: number };

    expect(result.status).toBe("success");
    expect(result.quantityAfter).toBe(3);
  });

  it("GOLDEN-EMU-AUTH-006 manager inventory writer succeeds", async () => {
    const uid = "golden-manager-006";
    const inventoryId = "golden-auth-inv-006";

    await seedUser(uid, {
      role: "manager",
      email: "golden.manager@example.test",
    });

    await seedInventory(inventoryId, {
      quantityOnHand: 2,
      available: 2,
    });

    const result = await invokeCreateMovementCallable(
      {
        operationId: "golden-emu-auth-006",
        movementType: "receive",
        inventoryItemId: inventoryId,
        quantity: 1,
        source: "inventory_page",
      },
      {
        uid,
        role: "manager",
      },
    ) as { status: string; quantityAfter?: number };

    expect(result.status).toBe("success");
    expect(result.quantityAfter).toBe(3);
  });

  it("GOLDEN-EMU-AUTH-007 billing remains denied ordinary inventory writes", async () => {
    const uid = "golden-billing-007";
    const inventoryId = "golden-auth-inv-007";

    await seedUser(uid, {
      role: "billing",
      email: "golden.billing@example.test",
    });

    await seedInventory(inventoryId, {
      quantityOnHand: 2,
      available: 2,
    });

    await expect(
      invokeCreateMovementCallable(
        {
          operationId: "golden-emu-auth-007",
          movementType: "receive",
          inventoryItemId: inventoryId,
          quantity: 1,
          source: "inventory_page",
        },
        {
          uid,
          role: "billing",
        },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    const inventory = await db
      .collection("inventory")
      .doc(inventoryId)
      .get();

    expect(inventory.data()?.quantityOnHand).toBe(2);
  });

  it("GOLDEN-EMU-AUTH-008 read-only remains denied ordinary inventory writes", async () => {
    const uid = "golden-read-only-008";
    const inventoryId = "golden-auth-inv-008";

    await seedUser(uid, {
      role: "read-only",
      email: "golden.readonly@example.test",
    });

    await seedInventory(inventoryId, {
      quantityOnHand: 2,
      available: 2,
    });

    await expect(
      invokeCreateMovementCallable(
        {
          operationId: "golden-emu-auth-008",
          movementType: "receive",
          inventoryItemId: inventoryId,
          quantity: 1,
          source: "inventory_page",
        },
        {
          uid,
          role: "read-only",
        },
      ),
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Insufficient permissions for inventory operations.",
    });

    const inventory = await db
      .collection("inventory")
      .doc(inventoryId)
      .get();

    expect(inventory.data()?.quantityOnHand).toBe(2);
  });

  it("GOLDEN-EMU-AUTH-009 technician remains denied admin-only hard delete", async () => {
    const uid = "golden-technician-009";
    const inventoryId = "golden-auth-inv-009";

    await seedUser(uid, {
      role: "technician",
      email: "golden.technician.admin-boundary@example.test",
    });

    await seedInventory(inventoryId, {
      quantityOnHand: 1,
      available: 1,
    });

    const result = await invokeCreateMovementCallable(
      {
        operationId: "golden-emu-auth-009",
        movementType: "hard_delete",
        inventoryItemId: inventoryId,
        quantity: 1,
        source: "inventory_page",
      },
      {
        uid,
        role: "technician",
      },
    ) as {
      status: string;
      message?: string;
    };

    expect(result.status).toBe("permission_denied");
    expect(result.message).toMatch(/Admin access is required/);

    const inventory = await db
      .collection("inventory")
      .doc(inventoryId)
      .get();

    expect(inventory.exists).toBe(true);
  });

  it("GOLDEN-EMU-CLEAN-001 unauthenticated cleanup rejected", async () => {
    await seedInventory("golden-clean-inv-001", { category: "Uncategorized" });

    await expect(
      invokeInventoryCleanupCallable({
        mode: "preview",
        operationId: "golden-emu-clean-001",
        action: "ASSIGN_CATEGORY",
        inventoryItemId: "golden-clean-inv-001",
        newValue: "Oxygen Equipment",
      })
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("GOLDEN-EMU-CLEAN-002 non-admin cleanup rejected", async () => {
    await seedInventory("golden-clean-inv-002", { category: "Uncategorized" });
    await seedUser("golden-clean-tank-002", { role: "tank", email: "golden.clean.tank@example.test" });
    await seedUser("golden-clean-disabled-admin-002", {
      role: "admin",
      email: "golden.clean.disabled@example.test",
      disabled: true,
    });

    const input = {
      mode: "preview",
      operationId: "golden-emu-clean-002",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-002",
      newValue: "Oxygen Equipment",
    };

    await expect(
      invokeInventoryCleanupCallable(
        input,
        actor
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Admin access is required for inventory cleanup.",
    });

    await expect(
      invokeInventoryCleanupCallable(
        { ...input, operationId: "golden-emu-clean-002-tank" },
        { uid: "golden-clean-tank-002", role: "tank", email: "golden.clean.tank@example.test" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Admin access is required for inventory cleanup.",
    });

    await expect(
      invokeInventoryCleanupCallable(
        { ...input, operationId: "golden-emu-clean-002-disabled" },
        { uid: "golden-clean-disabled-admin-002", role: "admin", email: "golden.clean.disabled@example.test" }
      )
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Admin access is required for inventory cleanup.",
    });
  });

  it("GOLDEN-EMU-CLEAN-003 admin category correction succeeds", async () => {
    await seedInventory("golden-clean-inv-003", {
      category: "Uncategorized",
      quantityOnHand: 4,
      available: 4,
      onRent: 0,
    });
    const input = {
      mode: "preview",
      operationId: "golden-emu-clean-003",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-003",
      newValue: "Oxygen Equipment",
    };
    const preview = await invokeInventoryCleanupCallable(input, adminActor);
    const result = await invokeInventoryCleanupCallable(
      { ...input, mode: "apply", previewToken: preview.previewToken },
      adminActor
    );

    expect(result.status).toBe("success");
    expect((await db.collection("inventory").doc("golden-clean-inv-003").get()).data()).toMatchObject({
      category: "Oxygen Equipment",
      quantityOnHand: 4,
      available: 4,
      onRent: 0,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-clean-003")).toBe(0);
  });

  it("GOLDEN-EMU-CLEAN-004 product relink changes grouping identity only", async () => {
    await seedProduct("golden-clean-product-004", {
      name: "Canonical Oxygen",
      category: "Oxygen Equipment",
      manufacturer: "Invacare",
      model: "Perfecto",
      sku: "CAN-004",
      hcpcs: "E1390",
    });
    await seedInventory("golden-clean-inv-004", {
      productId: "legacy-product",
      name: "Legacy Oxygen",
      quantityOnHand: 2,
      available: 2,
      onRent: 0,
    });
    const preview = await previewInventoryCleanup({
      mode: "preview",
      operationId: "golden-emu-clean-004",
      action: "RELINK_PRODUCT_ID",
      inventoryItemId: "golden-clean-inv-004",
      targetProductId: "golden-clean-product-004",
    }, db);
    const result = await applyInventoryCleanup({
      mode: "apply",
      operationId: "golden-emu-clean-004",
      action: "RELINK_PRODUCT_ID",
      inventoryItemId: "golden-clean-inv-004",
      targetProductId: "golden-clean-product-004",
      reason: "Golden product relink",
      previewToken: preview.previewToken,
    }, adminActor, db);

    expect(result.status).toBe("success");
    expect((await db.collection("inventory").doc("golden-clean-inv-004").get()).data()).toMatchObject({
      productId: "golden-clean-product-004",
      quantityOnHand: 2,
      available: 2,
      onRent: 0,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-clean-004")).toBe(0);
  });

  it("GOLDEN-EMU-CLEAN-005 duplicate serialized identifier correction blocked", async () => {
    await seedInventory("golden-clean-inv-005-a", { serial: "CLEAN-DUP-005", quantityOnHand: 1 });
    await seedInventory("golden-clean-inv-005-b", { serial: "OTHER-005", quantityOnHand: 1 });

    await expect(
      previewInventoryCleanup({
        mode: "preview",
        operationId: "golden-emu-clean-005",
        action: "CORRECT_SERIAL",
        inventoryItemId: "golden-clean-inv-005-b",
        newValue: "CLEAN-DUP-005",
      }, db)
    ).rejects.toMatchObject({ code: "failed-precondition" });

    expect((await db.collection("inventory").doc("golden-clean-inv-005-b").get()).data()?.serial).toBe("OTHER-005");
  });

  it("GOLDEN-EMU-CLEAN-006 cleanup retry is idempotent", async () => {
    await seedInventory("golden-clean-inv-006", { category: "Uncategorized" });
    const input = {
      mode: "apply" as const,
      operationId: "golden-emu-clean-006",
      action: "ASSIGN_CATEGORY" as const,
      inventoryItemId: "golden-clean-inv-006",
      newValue: "Oxygen Equipment",
    };
    const preview = await previewInventoryCleanup({ ...input, mode: "preview" }, db);
    const first = await applyInventoryCleanup({ ...input, previewToken: preview.previewToken }, adminActor, db);
    const retry = await applyInventoryCleanup({ ...input, previewToken: preview.previewToken }, adminActor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    const audits = await db.collection("auditLogs").where("targetId", "==", "golden-clean-inv-006").get();
    expect(audits.docs.filter((doc) => doc.data().action === "inventory.cleanup")).toHaveLength(1);
  });

  it("GOLDEN-EMU-CLEAN-007 conflicting operation ID fails closed", async () => {
    await seedInventory("golden-clean-inv-007", { category: "Uncategorized" });
    const preview = await previewInventoryCleanup({
      mode: "preview",
      operationId: "golden-emu-clean-007",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-007",
      newValue: "Oxygen Equipment",
    }, db);
    await applyInventoryCleanup({
      mode: "apply",
      operationId: "golden-emu-clean-007",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-007",
      newValue: "Oxygen Equipment",
      previewToken: preview.previewToken,
    }, adminActor, db);

    await expect(
      applyInventoryCleanup({
        mode: "apply",
        operationId: "golden-emu-clean-007",
        action: "ASSIGN_CATEGORY",
        inventoryItemId: "golden-clean-inv-007",
        newValue: "Respiratory",
        previewToken: preview.previewToken,
      }, adminActor, db)
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("GOLDEN-EMU-CLEAN-008 stale preview conflict rejected", async () => {
    await seedInventory("golden-clean-inv-008", { category: "Uncategorized" });
    const preview = await previewInventoryCleanup({
      mode: "preview",
      operationId: "golden-emu-clean-008",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-008",
      newValue: "Oxygen Equipment",
    }, db);
    await db.collection("inventory").doc("golden-clean-inv-008").update({ category: "Respiratory" });

    await expect(
      applyInventoryCleanup({
        mode: "apply",
        operationId: "golden-emu-clean-008",
        action: "ASSIGN_CATEGORY",
        inventoryItemId: "golden-clean-inv-008",
        newValue: "Oxygen Equipment",
        previewToken: preview.previewToken,
      }, adminActor, db)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection("inventory").doc("golden-clean-inv-008").get()).data()?.category).toBe("Respiratory");
  });

  it("GOLDEN-EMU-CLEAN-009 successful cleanup writes audit atomically", async () => {
    await seedInventory("golden-clean-inv-009", { category: "Uncategorized" });
    const preview = await previewInventoryCleanup({
      mode: "preview",
      operationId: "golden-emu-clean-009",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-009",
      newValue: "Oxygen Equipment",
    }, db);
    await applyInventoryCleanup({
      mode: "apply",
      operationId: "golden-emu-clean-009",
      action: "ASSIGN_CATEGORY",
      inventoryItemId: "golden-clean-inv-009",
      newValue: "Oxygen Equipment",
      previewToken: preview.previewToken,
    }, adminActor, db);

    const audits = await db.collection("auditLogs").where("targetId", "==", "golden-clean-inv-009").get();
    expect(audits.docs.filter((doc) => doc.data().action === "inventory.cleanup")).toHaveLength(1);
    expect((await db.collection("domainWorkflowOperations").doc(`${adminActor.uid}_golden-emu-clean-009`).get()).exists).toBe(true);
  });

  it("GOLDEN-EMU-CLEAN-010 failed cleanup leaves target unchanged", async () => {
    await seedInventory("golden-clean-inv-010", { serial: "SERIAL-010", quantityOnHand: 1, available: 1 });
    await expect(
      applyInventoryCleanup({
        mode: "apply",
        operationId: "golden-emu-clean-010",
        action: "CORRECT_SERIAL",
        inventoryItemId: "golden-clean-inv-010",
        newValue: "SERIAL-010B",
        previewToken: "stale-token",
        reason: "Golden failed correction",
        acknowledgement: "I understand this changes serialized asset identity.",
      }, adminActor, db)
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await db.collection("inventory").doc("golden-clean-inv-010").get()).data()).toMatchObject({
      serial: "SERIAL-010",
      quantityOnHand: 1,
      available: 1,
    });
    expect(await countByOperation("inventoryTransactions", "golden-emu-clean-010")).toBe(0);
  });

  it("GOLDEN-EMU-RULE-001 rejects unauthorized direct protected inventory writes", async () => {
    await rulesTestEnv!.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc(actor.uid).set({
        role: "staff",
        active: true,
        disabled: false,
        deleted: false,
      });
      await context.firestore().collection("inventory").doc("golden-rule-inv-001").set({
        name: "Golden rule inventory",
        quantityOnHand: 0,
        available: 0,
        onRent: 0,
        onTruck: 0,
        committed: 0,
        status: "available",
        lifecycleStatus: "active",
        isDeleted: false,
      });
    });

    const staffDb = rulesTestEnv!.authenticatedContext(actor.uid, { role: "staff" }).firestore();
    await assertFails(
      staffDb.collection("inventory").doc("golden-rule-inv-001").update({
        quantityOnHand: 7,
      })
    );
  });

  it("GOLDEN-EMU-RULE-002 allows staff safe inventory metadata create defaults", async () => {
    await rulesTestEnv!.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc(actor.uid).set({
        role: "staff",
        active: true,
        disabled: false,
        deleted: false,
      });
    });

    const staffDb = rulesTestEnv!.authenticatedContext(actor.uid, { role: "staff" }).firestore();
    await assertSucceeds(
      staffDb.collection("inventory").doc("golden-rule-inv-002").set({
        name: "Golden metadata item",
        quantityOnHand: 0,
        available: 0,
        onRent: 0,
        onTruck: 0,
        committed: 0,
        status: "available",
        lifecycleStatus: "active",
        isDeleted: false,
        notes: "Synthetic safe metadata",
      })
    );
  });

  it("GOLDEN-EMU-RULE-003 rejects client-created movement history", async () => {
    await rulesTestEnv!.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("users").doc(actor.uid).set({
        role: "staff",
        active: true,
        disabled: false,
        deleted: false,
      });
    });

    const staffDb = rulesTestEnv!.authenticatedContext(actor.uid, { role: "staff" }).firestore();
    await assertFails(
      staffDb.collection("inventoryTransactions").doc("golden-rule-tx-003").set({
        operationId: "golden-emu-rule-003",
        inventoryItemId: "golden-rule-inv-003",
        quantityBefore: 1,
        quantityAfter: 2,
        createdAt: new Date("2026-08-07T00:00:00.000Z"),
      })
    );
  });

  it("GOLDEN-EMU-CONC-001 concurrent duplicate movement produces one logical mutation", async () => {
    await seedInventory("golden-conc-inv-001", { quantityOnHand: 10, available: 10 });
    const input = {
      operationId: "golden-emu-conc-001",
      movementType: "receive" as const,
      inventoryItemId: "golden-conc-inv-001",
      quantity: 3,
      reason: "Golden concurrent receive",
      source: "scanner" as const,
    };

    const settled = await Promise.allSettled([
      createInventoryMovement(input, actor, db),
      createInventoryMovement(input, actor, db),
    ]);

    expect(settled.every((result) => result.status === "fulfilled")).toBe(true);
    const statuses = settled.map((result) =>
      result.status === "fulfilled" ? result.value.status : "rejected"
    );
    expect(statuses.sort()).toEqual(["duplicate_operation", "success"]);
    const inventory = (await db.collection("inventory").doc("golden-conc-inv-001").get()).data();
    expect(inventory?.quantityOnHand).toBe(13);
    expect(await countByOperation("inventoryTransactions", "golden-emu-conc-001")).toBe(1);
  });
});
