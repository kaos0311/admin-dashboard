import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

export type DiscontinueMovementRequest =
  Omit<InventoryMovementRequest, "operationId"> & {
    movementType: "discontinued";
    inventoryItemId: string;
  };

export type DiscontinueRetryState = {
  operationId: string;
  request: Readonly<DiscontinueMovementRequest>;
  outcomeUncertain: boolean;
};

export type DiscontinueRetryResult =
  | {
      status: "completed";
      movement: InventoryMovementResult;
    }
  | {
      status: "retry_declined";
      error: unknown;
    };

export function createDiscontinueRetryState(
  request: DiscontinueMovementRequest,
  operationId: string,
): DiscontinueRetryState {
  const normalizedOperationId = operationId.trim();
  const normalizedInventoryItemId = request.inventoryItemId.trim();

  if (!normalizedOperationId) {
    throw new Error("Discontinue operation ID is required.");
  }

  if (!normalizedInventoryItemId) {
    throw new Error("Discontinue inventory item ID is required.");
  }

  const frozenRequest = Object.freeze({
    ...request,
    inventoryItemId: normalizedInventoryItemId,
  });

  return {
    operationId: normalizedOperationId,
    request: frozenRequest,
    outcomeUncertain: false,
  };
}

export function markDiscontinueOutcomeUncertain(
  state: DiscontinueRetryState,
): DiscontinueRetryState {
  return {
    ...state,
    outcomeUncertain: true,
  };
}

export async function executeDiscontinueWithRetry(params: {
  state: DiscontinueRetryState;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
}): Promise<DiscontinueRetryResult> {
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
