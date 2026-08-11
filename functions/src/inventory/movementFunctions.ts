import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceCallableRateLimit } from "../security/rateLimit.js";
import { requireStaffOrAdmin } from "./auth";
import {
  type CreateMovementInput,
  createInventoryMovement,
  type InventoryMovementType,
  type MovementSource,
  reconcileInventory,
  reverseInventoryMovement,
} from "./movementService.js";

const MOVEMENT_TYPES = new Set<InventoryMovementType>([
  "receive",
  "manual_adjustment",
  "patient_assignment",
  "rental_checkout",
  "rental_return",
  "warehouse_transfer",
  "delivery_load",
  "delivery_delivered",
  "delivery_returned",
  "damaged",
  "lost",
  "found",
  "discontinued",
  "archived",
  "restored",
  "deceased_patient_equipment_return",
  "hard_delete",
]);

const MOVEMENT_SOURCES = new Set<MovementSource>([
  "inventory_page",
  "scanner",
  "rental",
  "patient",
  "delivery_fulfillment",
  "deceased_pickup",
  "reconciliation",
  "system",
]);

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseMovementInput(data: unknown): CreateMovementInput {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request body is required.");
  }

  const source = data as Record<string, unknown>;
  const movementType = cleanString(source.movementType) as InventoryMovementType;
  if (!MOVEMENT_TYPES.has(movementType)) {
    throw new HttpsError("invalid-argument", "Invalid movementType.");
  }

  const movementSource = cleanString(source.source) as MovementSource | undefined;
  if (movementSource && !MOVEMENT_SOURCES.has(movementSource)) {
    throw new HttpsError("invalid-argument", "Invalid movement source.");
  }

  const metadata =
    source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
      ? (source.metadata as Record<string, unknown>)
      : undefined;

  return {
    operationId: cleanString(source.operationId) ?? "",
    movementType,
    inventoryItemId: cleanString(source.inventoryItemId),
    productId: cleanString(source.productId),
    barcode: cleanString(source.barcode),
    serialNumber: cleanString(source.serialNumber),
    lotNumber: cleanString(source.lotNumber),
    quantity: cleanNumber(source.quantity),
    quantityDelta: cleanNumber(source.quantityDelta),
    fromLocation: cleanString(source.fromLocation),
    toLocation: cleanString(source.toLocation),
    patientId: cleanString(source.patientId),
    patientName: cleanString(source.patientName),
    rentalId: cleanString(source.rentalId),
    reason: cleanString(source.reason),
    source: movementSource,
    correlationId: cleanString(source.correlationId),
    metadata,
  };
}

export const createInventoryMovementCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);
    const input = parseMovementInput(request.data);
    return createInventoryMovement(input, actor);
  }
);

export const reverseInventoryMovementCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 10,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "general");
    const actor = await requireStaffOrAdmin(request);
    const data = request.data as Record<string, unknown> | undefined;

    return reverseInventoryMovement({
      operationId: cleanString(data?.operationId) ?? "",
      movementId: cleanString(data?.movementId) ?? "",
      reason: cleanString(data?.reason) ?? "No reason provided.",
      source: "inventory_page",
      actor,
    });
  }
);

export const reconcileInventoryCallable = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    maxInstances: 2,
  },
  async (request) => {
    await enforceCallableRateLimit(request, "admin");
    const actor = await requireStaffOrAdmin(request);
    if (actor.role !== "admin" && actor.role !== "tank") {
      throw new HttpsError("permission-denied", "Admin access is required.");
    }

    const data = request.data as Record<string, unknown> | undefined;
    const dryRun = data?.dryRun !== false;
    const repair = data?.repair === true;

    return reconcileInventory({
      dryRun,
      repair,
      actor,
    });
  }
);
