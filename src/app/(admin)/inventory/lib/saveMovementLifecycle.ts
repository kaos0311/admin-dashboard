import type { InventoryMovementRequest } from "@/lib/inventory/movements";

export type SaveMovementRequest = Omit<
  InventoryMovementRequest,
  "operationId"
>;

export type SaveMovementState = {
  fingerprint: string;
  stage: "target_resolved" | "pending" | "complete";
  operationId: string | null;
  request: SaveMovementRequest | null;
  context:
    | {
        kind: "existing";
        inventoryItemId: string;
      }
    | {
        kind: "new";
        inventoryItemId: string;
        action: "created" | "merged";
      };
};

export function buildSaveMovementFingerprint(params: {
  kind: "existing_adjustment" | "new_receive";
  inventoryItemId?: string;
  targetQuantityOnHand: number;
  productId: string;
  barcode: string;
  serialNumber: string;
  lotNumber: string;
}): string {
  return JSON.stringify([
    params.kind,
    params.inventoryItemId ?? "",
    params.targetQuantityOnHand,
    params.productId.trim(),
    params.barcode,
    params.serialNumber.trim(),
    params.lotNumber.trim(),
  ]);
}

export function reconcileSaveMovementState(
  state: SaveMovementState | null,
  fingerprint: string,
): SaveMovementState | null {
  if (!state) {
    return null;
  }

  return state.fingerprint === fingerprint ? state : null;
}

export function createResolvedNewSaveMovementState(params: {
  fingerprint: string;
  inventoryItemId: string;
  action: "created" | "merged";
}): SaveMovementState {
  return {
    fingerprint: params.fingerprint,
    stage: "target_resolved",
    operationId: null,
    request: null,
    context: {
      kind: "new",
      inventoryItemId: params.inventoryItemId,
      action: params.action,
    },
  };
}

export function armResolvedNewSaveMovementState(params: {
  state: SaveMovementState;
  operationId: string;
  request: SaveMovementRequest;
}): SaveMovementState {
  if (
    params.state.stage !== "target_resolved" ||
    params.state.context.kind !== "new"
  ) {
    throw new Error(
      "Only a resolved new-inventory Save can be armed for movement.",
    );
  }

  if (!params.operationId.trim()) {
    throw new Error("Save movement operation ID is required.");
  }

  return {
    ...params.state,
    stage: "pending",
    operationId: params.operationId,
    request: params.request,
  };
}

export function completeSaveMovementState(
  state: SaveMovementState,
): SaveMovementState {
  return {
    ...state,
    stage: "complete",
    operationId: null,
  };
}
