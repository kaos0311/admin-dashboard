import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  InventoryMovementRequest,
  InventoryMovementResult,
} from "@/lib/inventory/movements";

import {
  createBatchMutationLedger,
  executeBatchMutationLedger,
  getCompletedBatchItemIds,
  hasResumableBatchMutationWork,
  summarizeBatchMutation,
  type BatchMutationRequest,
} from "./batchMutationLifecycle";

function archiveRequest(
  itemId: string,
): BatchMutationRequest {
  return {
    movementType: "archived",
    inventoryItemId: itemId,
    quantity: 1,
    reason: "Batch inventory archive.",
    source: "inventory_page",
  };
}

describe("inventory batch mutation lifecycle", () => {
  it("treats pending-only batch work as resumable", () => {
    expect(
      hasResumableBatchMutationWork({
        total: 1,
        pending: 1,
        completed: 0,
        uncertain: 0,
        failed: 0,
      }),
    ).toBe(true);
  });

  it("treats uncertain-only batch work as resumable", () => {
    expect(
      hasResumableBatchMutationWork({
        total: 1,
        pending: 0,
        completed: 0,
        uncertain: 1,
        failed: 0,
      }),
    ).toBe(true);
  });

  it("treats pending and uncertain batch work as resumable", () => {
    expect(
      hasResumableBatchMutationWork({
        total: 2,
        pending: 1,
        completed: 0,
        uncertain: 1,
        failed: 0,
      }),
    ).toBe(true);
  });

  it("does not resume completed or failed-only batch work", () => {
    expect(
      hasResumableBatchMutationWork({
        total: 2,
        pending: 0,
        completed: 1,
        uncertain: 0,
        failed: 1,
      }),
    ).toBe(false);
  });
  it("creates one stable frozen operation per unique item", () => {
    const ledger = createBatchMutationLedger({
      batchId: " batch-1 ",
      movementType: "archived",
      requests: [
        archiveRequest("item-a"),
        archiveRequest("item-b"),
        archiveRequest("item-a"),
      ],
      operationIdForItem: (itemId) =>
        ` op-${itemId} `,
    });

    expect(ledger.batchId).toBe("batch-1");
    expect(ledger.entries).toHaveLength(2);

    expect(
      ledger.entries.map(
        (entry) => entry.operationId,
      ),
    ).toEqual([
      "op-item-a",
      "op-item-b",
    ]);

    expect(
      ledger.entries.every(
        (entry) =>
          Object.isFrozen(entry.request),
      ),
    ).toBe(true);
  });

  it("classifies success and duplicate_operation as completed", async () => {
    const ledger = createBatchMutationLedger({
      batchId: "batch-2",
      movementType: "archived",
      requests: [
        archiveRequest("item-a"),
        archiveRequest("item-b"),
      ],
      operationIdForItem: (itemId) =>
        `op-${itemId}`,
    });

    const execute = vi.fn(
      async (
        request: InventoryMovementRequest,
      ): Promise<InventoryMovementResult> => ({
        status:
          request.inventoryItemId === "item-a"
            ? "success"
            : "duplicate_operation",
        operationId: request.operationId,
        inventoryItemId:
          request.inventoryItemId,
      }),
    );

    const result =
      await executeBatchMutationLedger({
        ledger,
        execute,
        isRetryableError: () => false,
      });

    expect(
      summarizeBatchMutation(result),
    ).toEqual({
      total: 2,
      pending: 0,
      completed: 2,
      uncertain: 0,
      failed: 0,
    });

    expect(
      getCompletedBatchItemIds(result),
    ).toEqual(["item-a", "item-b"]);
  });

  it("separates retryable uncertainty from terminal failure", async () => {
    const ledger = createBatchMutationLedger({
      batchId: "batch-3",
      movementType: "archived",
      requests: [
        archiveRequest("uncertain"),
        archiveRequest("failed"),
      ],
      operationIdForItem: (itemId) =>
        `op-${itemId}`,
    });

    const retryable =
      new Error("response lost");

    const terminal =
      new Error("permission denied");

    const result =
      await executeBatchMutationLedger({
        ledger,
        execute: vi.fn(
          async (
            request: InventoryMovementRequest,
          ): Promise<InventoryMovementResult> => {
          if (
            request.inventoryItemId ===
            "uncertain"
          ) {
            throw retryable;
          }

          throw terminal;
        }),
        isRetryableError: (error) =>
          error === retryable,
      });

    expect(
      summarizeBatchMutation(result),
    ).toEqual({
      total: 2,
      pending: 0,
      completed: 0,
      uncertain: 1,
      failed: 1,
    });
  });

  it("retries only uncertain entries with the same operation ID", async () => {
    const ledger = createBatchMutationLedger({
      batchId: "batch-4",
      movementType: "archived",
      requests: [
        archiveRequest("done"),
        archiveRequest("uncertain"),
        archiveRequest("failed"),
      ],
      operationIdForItem: (itemId) =>
        `stable-${itemId}`,
    });

    const retryable =
      new Error("timeout");

    const firstCalls:
      InventoryMovementRequest[] = [];

    const first =
      await executeBatchMutationLedger({
        ledger,
        execute: vi.fn(
          async (
            request: InventoryMovementRequest,
          ): Promise<InventoryMovementResult> => {
          firstCalls.push(request);

          if (
            request.inventoryItemId ===
            "uncertain"
          ) {
            throw retryable;
          }

          if (
            request.inventoryItemId ===
            "failed"
          ) {
            return {
              status: "permission_denied",
              operationId:
                request.operationId,
            };
          }

          return {
            status: "success",
            operationId:
              request.operationId,
          };
        }),
        isRetryableError: (error) =>
          error === retryable,
      });

    expect(
      summarizeBatchMutation(first),
    ).toEqual({
      total: 3,
      pending: 0,
      completed: 1,
      uncertain: 1,
      failed: 1,
    });

    const retryCalls:
      InventoryMovementRequest[] = [];

    const second =
      await executeBatchMutationLedger({
        ledger: first,
        execute: vi.fn(
          async (
            request: InventoryMovementRequest,
          ): Promise<InventoryMovementResult> => {
          retryCalls.push(request);

          return {
            status: "duplicate_operation",
            operationId:
              request.operationId,
          };
        }),
        isRetryableError: () => false,
      });

    expect(retryCalls).toEqual([
      {
        ...archiveRequest("uncertain"),
        operationId:
          "stable-uncertain",
      },
    ]);

    expect(
      summarizeBatchMutation(second),
    ).toEqual({
      total: 3,
      pending: 0,
      completed: 2,
      uncertain: 0,
      failed: 1,
    });

    expect(
      firstCalls.find(
        (request) =>
          request.inventoryItemId ===
          "uncertain",
      )?.operationId,
    ).toBe("stable-uncertain");

    expect(
      retryCalls[0]?.operationId,
    ).toBe("stable-uncertain");
  });

  it("does not rerun already completed or failed entries", async () => {
    const ledger = createBatchMutationLedger({
      batchId: "batch-5",
      movementType: "archived",
      requests: [
        archiveRequest("completed"),
        archiveRequest("failed"),
      ],
      operationIdForItem: (itemId) =>
        `op-${itemId}`,
    });

    ledger.entries[0] = {
      ...ledger.entries[0],
      status: "completed",
    };

    ledger.entries[1] = {
      ...ledger.entries[1],
      status: "failed",
    };

    const execute = vi.fn();

    const result =
      await executeBatchMutationLedger({
        ledger,
        execute,
        isRetryableError: () => false,
      });

    expect(execute).not.toHaveBeenCalled();
    expect(result).toBe(ledger);
  });

  it("rejects mixed mutation types in one ledger", () => {
    expect(() =>
      createBatchMutationLedger({
        batchId: "batch-6",
        movementType: "archived",
        requests: [
          {
            movementType:
              "discontinued",
            inventoryItemId:
              "item-a",
            quantity: 1,
          },
        ],
        operationIdForItem: () =>
          "op-item-a",
      }),
    ).toThrow(
      "Batch mutation request type does not match the ledger type.",
    );
  });
});
