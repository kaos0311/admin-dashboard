import { httpsCallable } from "firebase/functions";

import { functions } from "@/lib/firebase";

export type InventoryMovementType =
  | "receive"
  | "manual_adjustment"
  | "patient_assignment"
  | "rental_checkout"
  | "rental_return"
  | "warehouse_transfer"
  | "delivery_load"
  | "delivery_delivered"
  | "delivery_returned"
  | "retail_sale"
  | "damaged"
  | "lost"
  | "found"
  | "discontinued"
  | "archived"
  | "restored"
  | "deceased_patient_equipment_return"
  | "hard_delete";

export type MovementSource =
  | "inventory_page"
  | "scanner"
  | "rental"
  | "patient"
  | "delivery_fulfillment"
  | "deceased_pickup"
  | "reconciliation"
  | "system";

export type InventoryMovementRequest = {
  operationId: string;
  movementType: InventoryMovementType;
  inventoryItemId?: string;
  productId?: string;
  barcode?: string;
  serialNumber?: string;
  lotNumber?: string;
  quantity?: number;
  quantityDelta?: number;
  fromLocation?: string;
  fromBinLocation?: string;
  toLocation?: string;
  toBinLocation?: string;
  patientId?: string;
  patientName?: string;
  rentalId?: string;
  reason?: string;
  source?: MovementSource;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type InventoryMovementResult = {
  status:
    | "success"
    | "duplicate_operation"
    | "not_found"
    | "ambiguous"
    | "invalid"
    | "permission_denied";
  movementId?: string;
  operationId: string;
  inventoryItemId?: string;
  productId?: string;
  quantityBefore?: number;
  quantityDelta?: number;
  quantityAfter?: number;
  message?: string;
  matches?: Array<{
    inventoryItemId: string;
    productId: string;
    name: string;
    barcode: string;
    serialNumber: string;
    lotNumber: string;
  }>;
};

function generateOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function createInventoryOperationId(prefix = "inventory"): string {
  return `${prefix}-${generateOperationId()}`;
}

export async function createInventoryMovement(
  request: Omit<InventoryMovementRequest, "operationId"> & {
    operationId?: string;
  },
): Promise<InventoryMovementResult> {
  const callable = httpsCallable<
    InventoryMovementRequest,
    InventoryMovementResult
  >(functions, "createInventoryMovementCallable");

  const operationId = request.operationId ?? createInventoryOperationId();
  const result = await callable({
    ...request,
    operationId,
  });

  return result.data;
}
