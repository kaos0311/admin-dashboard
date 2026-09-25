import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

export type HardDeleteMovementRequest = Omit<
  InventoryMovementRequest,
  "operationId"
> & {
  movementType: "hard_delete";
  inventoryItemId: string;
};

export type HardDeleteRetryState = {
  operationId: string;
  request: Readonly<HardDeleteMovementRequest>;
  outcomeUncertain: boolean;
};

export type HardDeleteRetryResult =
  | {
      status: "completed";
      movement: InventoryMovementResult;
    }
  | {
      status: "retry_declined";
      error: unknown;
    };

export function createHardDeleteRetryState(
  request: HardDeleteMovementRequest,
  operationId: string,
): HardDeleteRetryState {
  const normalizedOperationId = operationId.trim();
  const normalizedInventoryItemId = request.inventoryItemId.trim();

  if (!normalizedOperationId) {
    throw new Error("Hard-delete operation ID is required.");
  }

  if (!normalizedInventoryItemId) {
    throw new Error("Hard-delete inventory item ID is required.");
  }

  return {
    operationId: normalizedOperationId,
    request: Object.freeze({
      ...request,
      inventoryItemId: normalizedInventoryItemId,
    }),
    outcomeUncertain: false,
  };
}

export function markHardDeleteOutcomeUncertain(
  state: HardDeleteRetryState,
): HardDeleteRetryState {
  if (state.outcomeUncertain) {
    return state;
  }

  return {
    ...state,
    outcomeUncertain: true,
  };
}

export async function executeHardDeleteWithRetry(params: {
  state: HardDeleteRetryState;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
}): Promise<HardDeleteRetryResult> {
  while (true) {
    try {
      const movement = await params.execute({
        ...params.state.request,
        operationId: params.state.operationId,
      });

      return {
        status: "completed",
        movement,
      };
    } catch (error: unknown) {
      if (!params.isRetryableError(error)) {
        throw error;
      }

      if (!params.shouldRetry(error)) {
        return {
          status: "retry_declined",
          error,
        };
      }
    }
  }
}