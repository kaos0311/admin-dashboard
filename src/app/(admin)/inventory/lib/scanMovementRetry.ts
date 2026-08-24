import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

export type ScanMovementRequest = Omit<
  InventoryMovementRequest,
  "operationId"
>;

export type ScanMovementRetryResult =
  | {
      status: "completed";
      movement: InventoryMovementResult;
    }
  | {
      status: "retry_declined";
      error: unknown;
    };

export async function executeScanMovementWithRetry(params: {
  request: ScanMovementRequest;
  operationId: string;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
  shouldRetry: (error: unknown) => boolean;
}): Promise<ScanMovementRetryResult> {
  if (!params.operationId.trim()) {
    throw new Error("Scan movement operation ID is required.");
  }

  while (true) {
    try {
      const movement = await params.execute({
        ...params.request,
        operationId: params.operationId,
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
