import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

export type BatchMutationType =
  | "archived"
  | "discontinued";

export type BatchMutationRequest =
  Omit<InventoryMovementRequest, "operationId"> & {
    movementType: BatchMutationType;
    inventoryItemId: string;
  };

export type BatchMutationEntryStatus =
  | "pending"
  | "completed"
  | "uncertain"
  | "failed";

export type BatchMutationEntry = {
  itemId: string;
  operationId: string;
  request: Readonly<BatchMutationRequest>;
  status: BatchMutationEntryStatus;
  message?: string;
};

export type BatchMutationLedger = {
  batchId: string;
  movementType: BatchMutationType;
  entries: BatchMutationEntry[];
};

export type BatchMutationSummary = {
  total: number;
  pending: number;
  completed: number;
  uncertain: number;
  failed: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function createBatchMutationLedger(params: {
  batchId: string;
  movementType: BatchMutationType;
  requests: BatchMutationRequest[];
  operationIdForItem: (
    itemId: string,
    index: number,
  ) => string;
}): BatchMutationLedger {
  const batchId = params.batchId.trim();

  if (!batchId) {
    throw new Error("Batch mutation ID is required.");
  }

  const seenItemIds = new Set<string>();

  const entries = params.requests.flatMap(
    (request, index) => {
      const itemId =
        request.inventoryItemId.trim();

      if (!itemId || seenItemIds.has(itemId)) {
        return [];
      }

      if (request.movementType !== params.movementType) {
        throw new Error(
          "Batch mutation request type does not match the ledger type.",
        );
      }

      const operationId =
        params
          .operationIdForItem(itemId, index)
          .trim();

      if (!operationId) {
        throw new Error(
          `Operation ID is required for batch item ${itemId}.`,
        );
      }

      seenItemIds.add(itemId);

      return [
        {
          itemId,
          operationId,
          request: Object.freeze({
            ...request,
            inventoryItemId: itemId,
          }),
          status: "pending" as const,
        },
      ];
    },
  );

  if (!entries.length) {
    throw new Error(
      "A batch mutation requires at least one inventory item.",
    );
  }

  return {
    batchId,
    movementType: params.movementType,
    entries,
  };
}

export function summarizeBatchMutation(
  ledger: BatchMutationLedger,
): BatchMutationSummary {
  return ledger.entries.reduce<BatchMutationSummary>(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] += 1;
      return summary;
    },
    {
      total: 0,
      pending: 0,
      completed: 0,
      uncertain: 0,
      failed: 0,
    },
  );
}

export function getCompletedBatchItemIds(
  ledger: BatchMutationLedger,
): string[] {
  return ledger.entries
    .filter(
      (entry) => entry.status === "completed",
    )
    .map((entry) => entry.itemId);
}

export async function executeBatchMutationLedger(params: {
  ledger: BatchMutationLedger;
  execute: (
    request: InventoryMovementRequest,
  ) => Promise<InventoryMovementResult>;
  isRetryableError: (error: unknown) => boolean;
}): Promise<BatchMutationLedger> {
  const eligibleEntries =
    params.ledger.entries.filter(
      (entry) =>
        entry.status === "pending" ||
        entry.status === "uncertain",
    );

  if (!eligibleEntries.length) {
    return params.ledger;
  }

  const outcomes = await Promise.all(
    eligibleEntries.map(async (entry) => {
      try {
        const movement = await params.execute({
          ...entry.request,
          operationId: entry.operationId,
        });

        if (
          movement.status === "success" ||
          movement.status ===
            "duplicate_operation"
        ) {
          return {
            itemId: entry.itemId,
            status: "completed" as const,
            message: movement.message,
          };
        }

        return {
          itemId: entry.itemId,
          status: "failed" as const,
          message:
            movement.message ||
            `Movement returned ${movement.status}.`,
        };
      } catch (error: unknown) {
        if (params.isRetryableError(error)) {
          return {
            itemId: entry.itemId,
            status: "uncertain" as const,
            message: errorMessage(error),
          };
        }

        return {
          itemId: entry.itemId,
          status: "failed" as const,
          message: errorMessage(error),
        };
      }
    }),
  );

  const outcomeByItemId = new Map(
    outcomes.map((outcome) => [
      outcome.itemId,
      outcome,
    ]),
  );

  return {
    ...params.ledger,
    entries: params.ledger.entries.map(
      (entry) => {
        const outcome =
          outcomeByItemId.get(entry.itemId);

        if (!outcome) {
          return entry;
        }

        return {
          ...entry,
          status: outcome.status,
          message: outcome.message,
        };
      },
    ),
  };
}
