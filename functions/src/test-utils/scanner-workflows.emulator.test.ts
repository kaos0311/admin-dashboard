import { beforeEach, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import {
  clearEmulatorData,
  getEmulatorProjectId,
  validateEmulatorSafety,
} from "./emulator-setup";
import { equipmentCheckInByBarcodeCallable } from "../domainWorkflows/domainWorkflowFunctions";
import { equipmentCheckInByBarcodeWorkflow } from "../domainWorkflows/scannerCheckInWorkflowService";
import { createInventoryMovementCallable } from "../inventory/movementFunctions";
import { createInventoryMovement, type MovementActor } from "../inventory/movementService";

validateEmulatorSafety();

if (!getApps().length) {
  initializeApp({ projectId: getEmulatorProjectId() });
}

const db = getFirestore();

const actor: MovementActor = {
  uid: "scanner-staff-001",
  email: "scanner-staff@test.example.com",
  role: "staff",
};

type CallableAuthContext = {
  uid: string;
  role: string;
  email?: string;
};

function callableRequest(data: Record<string, unknown>, authContext?: CallableAuthContext, ip = "127.0.0.1") {
  return {
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
      headers: { "x-forwarded-for": ip },
    },
  };
}

async function invokeEquipmentCheckInCallable(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
  ip?: string
) {
  const callable = equipmentCheckInByBarcodeCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  return callable.run(callableRequest(data, authContext, ip));
}

async function invokeCreateMovementCallable(
  data: Record<string, unknown>,
  authContext?: CallableAuthContext,
  ip?: string
) {
  const callable = createInventoryMovementCallable as unknown as {
    run: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  return callable.run(callableRequest(data, authContext, ip));
}

async function seedInventory(id: string, overrides: Record<string, unknown> = {}) {
  await db.collection("inventory").doc(id).set({
    name: "Scanner Test Item",
    productId: `product-${id}`,
    barcode: `SCAN-${id}`,
    serial: `SERIAL-${id}`,
    sku: `SKU-${id}`,
    quantityOnHand: 1,
    committed: 0,
    onRent: 0,
    onTruck: 0,
    available: 1,
    status: "available",
    lifecycleStatus: "active",
    isDeleted: false,
    createdAt: Timestamp.now(),
    ...overrides,
  });
}

async function seedRentalFixture(prefix: string, options: { includePatientEquipment?: boolean } = {}) {
  const inventoryId = `${prefix}-inventory`;
  const rentalId = `${prefix}-rental`;
  const patientId = `${prefix}-patient`;

  await seedInventory(inventoryId, {
    barcode: `CHECKIN-${prefix}`,
    serial: `SER-${prefix}`,
    quantityOnHand: 1,
    onRent: 1,
    available: 0,
    status: "rental_out",
    rentalId,
    patientKey: patientId,
    patientName: "Scanner Patient",
  });
  await db.collection("patients").doc(patientId).set({
    fullName: "Scanner Patient",
    status: "active",
  });
  if (options.includePatientEquipment) {
    await db.collection("patients").doc(patientId).collection("equipment").doc(inventoryId).set({
      inventoryId,
      productId: `product-${inventoryId}`,
      rentalId,
      serialNumber: `SER-${prefix}`,
      status: "active",
    });
  }
  await db.collection("rentals").doc(rentalId).set({
    inventoryItemId: inventoryId,
    itemId: inventoryId,
    productId: `product-${inventoryId}`,
    patientId,
    patientName: "Scanner Patient",
    serialNumber: `SER-${prefix}`,
    quantity: 1,
    status: "checked_out",
  });

  return { inventoryId, rentalId, patientId, barcode: `CHECKIN-${prefix}` };
}

async function seedPatientAssignmentFixture(prefix: string) {
  const inventoryId = `${prefix}-inventory`;
  const patientId = `${prefix}-patient`;

  await seedInventory(inventoryId, {
    barcode: `PAT-CHECKIN-${prefix}`,
    serial: `PAT-SER-${prefix}`,
    quantityOnHand: 1,
    onRent: 1,
    available: 0,
    status: "assigned",
    patientKey: patientId,
    patientName: "Assigned Patient",
  });
  await db.collection("patients").doc(patientId).set({
    fullName: "Assigned Patient",
    status: "active",
  });
  await db.collection("patients").doc(patientId).collection("equipment").doc(inventoryId).set({
    inventoryId,
    productId: `product-${inventoryId}`,
    serialNumber: `PAT-SER-${prefix}`,
    status: "active",
  });

  return { inventoryId, patientId, barcode: `PAT-CHECKIN-${prefix}` };
}

beforeEach(async () => {
  await clearEmulatorData();
});

describe("scanner equipment check-in workflow", () => {
  it("returns an active rental through the canonical rental workflow", async () => {
    const fixture = await seedRentalFixture("rental-success");

    const result = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-rental-return-001",
        barcode: fixture.barcode,
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("rental.return");

    const inventory = (await db.collection("inventory").doc(fixture.inventoryId).get()).data();
    expect(inventory).toMatchObject({
      status: "available",
      onRent: 0,
      available: 1,
      patientKey: "",
      patientId: "",
      rentalId: "",
      assignedTo: "",
    });
    expect((await db.collection("rentals").doc(fixture.rentalId).get()).data()?.status).toBe("available");

    const retry = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-rental-return-001",
        barcode: fixture.barcode,
      },
      actor,
      db
    );
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementIds).toEqual(result.movementIds);

    const repeatedScan = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-rental-return-002",
        barcode: fixture.barcode,
      },
      actor,
      db
    );
    expect(repeatedScan).toMatchObject({
      status: "success",
      code: "already_in_warehouse",
      movementIds: [],
    });
    expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
    });
  });

  it("returns active patient equipment through the canonical patient workflow", async () => {
    const fixture = await seedPatientAssignmentFixture("patient-success");

    const result = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-patient-return-001",
        barcode: fixture.barcode,
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect(result.workflowType).toBe("patient_equipment.return_to_warehouse");

    const inventory = (await db.collection("inventory").doc(fixture.inventoryId).get()).data();
    expect(inventory).toMatchObject({
      status: "available",
      onRent: 0,
      available: 1,
      patientKey: "",
      patientId: "",
      rentalId: "",
      assignedTo: "",
    });
    expect(
      (await db.collection("patients").doc(fixture.patientId).collection("equipment").doc(fixture.inventoryId).get()).data()?.status
    ).toBe("returned");

    const repeatedScan = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-patient-return-002",
        barcode: fixture.barcode,
      },
      actor,
      db
    );
    expect(repeatedScan).toMatchObject({
      status: "success",
      code: "already_in_warehouse",
      movementIds: [],
    });
    expect((await db.collection("inventory").doc(fixture.inventoryId).get()).data()).toMatchObject({
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
    });
  });

  it("rejects conflicting active rental and patient ownership", async () => {
    const fixture = await seedRentalFixture("ambiguous");
    await db.collection("patients").doc("other-patient").set({ fullName: "Other", status: "active" });
    await db.collection("patients").doc("other-patient").collection("equipment").doc(fixture.inventoryId).set({
      inventoryId: fixture.inventoryId,
      status: "active",
    });

    await expect(
      equipmentCheckInByBarcodeWorkflow(
        {
          operationId: "scanner-ambiguous-001",
          barcode: fixture.barcode,
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("returns already-in-warehouse for explicit warehouse custody without adding stock", async () => {
    await seedInventory("available-inventory", {
      barcode: "WAREHOUSE-ALREADY",
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "available",
    });

    const result = await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-warehouse-001",
        barcode: "WAREHOUSE-ALREADY",
      },
      actor,
      db
    );

    expect(result).toMatchObject({
      status: "success",
      code: "already_in_warehouse",
      movementIds: [],
    });
    expect((await db.collection("inventory").doc("available-inventory").get()).data()).toMatchObject({
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "available",
    });
    expect(
      (await db.collection("inventoryTransactions").where("inventoryItemId", "==", "available-inventory").get()).empty
    ).toBe(true);
  });

  it("rejects orphan legacy ownership without provable warehouse custody", async () => {
    await seedInventory("orphan-inventory", {
      barcode: "NO-OWNER",
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "assigned",
      patientKey: "",
      rentalId: "",
    });

    await expect(
      equipmentCheckInByBarcodeWorkflow(
        {
          operationId: "scanner-no-owner-001",
          barcode: "NO-OWNER",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects check-in callable callers without inventory write authority", async () => {
    await seedInventory("checkin-permission", {
      barcode: "CHECKIN-PERMISSION",
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "available",
    });

    await expect(
      invokeEquipmentCheckInCallable(
        {
          operationId: "scanner-checkin-permission-001",
          barcode: "CHECKIN-PERMISSION",
        },
        { uid: "scanner-billing-001", role: "billing" },
        "127.0.0.11"
      )
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect((await db.collection("inventory").doc("checkin-permission").get()).data()).toMatchObject({
      quantityOnHand: 1,
      onRent: 0,
      available: 1,
      status: "available",
    });
  });

  it("rejects conflicting operation reuse for a different scanned asset", async () => {
    const first = await seedPatientAssignmentFixture("conflict-a");
    const second = await seedPatientAssignmentFixture("conflict-b");

    await equipmentCheckInByBarcodeWorkflow(
      {
        operationId: "scanner-conflict-001",
        barcode: first.barcode,
      },
      actor,
      db
    );

    await expect(
      equipmentCheckInByBarcodeWorkflow(
        {
          operationId: "scanner-conflict-001",
          barcode: second.barcode,
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });
});

describe("scanner retail sale movement", () => {
  it("decrements quantity once and returns duplicate on replay", async () => {
    await seedInventory("retail-quantity", {
      barcode: "RETAIL-QTY",
      quantityOnHand: 5,
      available: 5,
    });

    const request = {
      operationId: "scanner-retail-001",
      movementType: "retail_sale" as const,
      barcode: "RETAIL-QTY",
      quantity: 2,
      source: "scanner" as const,
      reason: "Retail sale test.",
    };

    const first = await createInventoryMovement(request, actor, db);
    const retry = await createInventoryMovement(request, actor, db);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("duplicate_operation");
    expect(retry.movementId).toBe(first.movementId);
    expect((await db.collection("inventory").doc("retail-quantity").get()).data()).toMatchObject({
      quantityOnHand: 3,
      available: 3,
    });
  });

  it("rejects insufficient stock and rented serialized assets", async () => {
    await seedInventory("retail-low", {
      barcode: "RETAIL-LOW",
      quantityOnHand: 1,
      available: 1,
    });
    await expect(
      createInventoryMovement(
        {
          operationId: "scanner-retail-low-001",
          movementType: "retail_sale",
          barcode: "RETAIL-LOW",
          quantity: 2,
          source: "scanner",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });

    await seedInventory("retail-rented-serialized", {
      barcode: "RETAIL-RENTED-SERIAL",
      serial: "RETAIL-RENTED-SERIAL",
      isSerialized: true,
      quantityOnHand: 1,
      onRent: 1,
      available: 0,
      status: "rental_out",
    });
    await expect(
      createInventoryMovement(
        {
          operationId: "scanner-retail-rented-001",
          movementType: "retail_sale",
          barcode: "RETAIL-RENTED-SERIAL",
          quantity: 1,
          source: "scanner",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("marks serialized sale inactive and prevents a second sale", async () => {
    await seedInventory("retail-serialized", {
      barcode: "RETAIL-SERIAL",
      serial: "RETAIL-SERIAL",
      isSerialized: true,
      quantityOnHand: 1,
      available: 1,
      status: "available",
      lifecycleStatus: "active",
    });

    const result = await createInventoryMovement(
      {
        operationId: "scanner-retail-serial-001",
        movementType: "retail_sale",
        barcode: "RETAIL-SERIAL",
        quantity: 1,
        source: "scanner",
      },
      actor,
      db
    );

    expect(result.status).toBe("success");
    expect((await db.collection("inventory").doc("retail-serialized").get()).data()).toMatchObject({
      quantityOnHand: 0,
      available: 0,
      status: "inactive",
      lifecycleStatus: "retired",
    });

    await expect(
      createInventoryMovement(
        {
          operationId: "scanner-retail-serial-002",
          movementType: "retail_sale",
          barcode: "RETAIL-SERIAL",
          quantity: 1,
          source: "scanner",
        },
        actor,
        db
      )
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects retail sale callable callers without inventory write authority", async () => {
    await seedInventory("retail-permission", {
      barcode: "RETAIL-PERMISSION",
      quantityOnHand: 3,
      available: 3,
    });

    await expect(
      invokeCreateMovementCallable(
        {
          operationId: "scanner-retail-permission-001",
          movementType: "retail_sale",
          barcode: "RETAIL-PERMISSION",
          quantity: 1,
          source: "scanner",
        },
        { uid: "scanner-billing-002", role: "billing" },
        "127.0.0.12"
      )
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect((await db.collection("inventory").doc("retail-permission").get()).data()).toMatchObject({
      quantityOnHand: 3,
      available: 3,
    });
  });
});
