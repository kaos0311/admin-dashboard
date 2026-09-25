import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

export type ArchiveMovementRequest =
  Omit<InventoryMovementRequest, "operationId"> & {
    movementType: "archived";
    inventoryItemId: string;
  };

export type ArchiveRetryState = {
  operationId: string;
  request: Readonly<ArchiveMovementRequest>;
  outcomeUncertain: boolean;
};

export type ArchiveRetryResult =
  | {
      status: "completed";
      movement: InventoryMovementResult;
    }
  | {
      status: "retry_declined";
      error: unknown;
    };

export function createArchiveRetryState(
  request: ArchiveMovementRequest,
  operationId: string,
): ArchiveRetryState {
  const normalizedOperationId = operationId.trim();
  const normalizedInventoryItemId = request.inventoryItemId.trim();

  if (!normalizedOperationId) {
    throw new Error("Archive operation ID is required.");
  }

  if (!normalizedInventoryItemId) {
    throw new Error("Archive inventory item ID is required.");
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

export function markArchiveOutcomeUncertain(
  state: ArchiveRetryState,
): ArchiveRetryState {
  return {
    ...state,
    outcomeUncertain: true,
  };
}

export async function executeArchiveWithRetry(params: {
  state: ArchiveRetryState;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
}): Promise<ArchiveRetryResult> {
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
