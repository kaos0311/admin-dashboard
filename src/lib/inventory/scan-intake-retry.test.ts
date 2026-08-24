import { describe, expect, it, vi } from "vitest";

import type {
  ReceiveScannedInventoryIntakeRequest,
  ReceiveScannedInventoryIntakeResponse,
} from "./receive-scanned-inventory-intake.types";

import {
  buildFrozenScanIntakeRequest,
  executeScanIntakeWithRetry,
  isRetryableScanIntakeCode,
  mapScanIntakeCallableErrorCode,
} from "./scan-intake-retry";

const BASE_REQUEST: ReceiveScannedInventoryIntakeRequest = {
  mode: "pending-scan",
  rawScan: "ABC-123",
  normalizedScan: "ABC-123",
  quantity: 1,
  locationId: "Main Location",
};

const SUCCESS: ReceiveScannedInventoryIntakeResponse = {
  ok: true,
  data: {
    status: "success",
    inventoryItemId: "inventory-1",
    movementId: "movement-1",
    quantityBefore: 0,
    quantityChange: 1,
    quantityAfter: 1,
    createdOrMerged: "created",
    mode: "pending-scan",
  },
};

describe("scan intake retry lifecycle", () => {
  it.each([
    ["functions/unavailable", "unavailable"],
    ["functions/deadline-exceeded", "deadline-exceeded"],
    ["functions/cancelled", "cancelled"],
    ["functions/aborted", "aborted"],
    ["functions/resource-exhausted", "resource-exhausted"],
  ])(
    "preserves retryable callable code %s",
    (input, expected) => {
      expect(
        mapScanIntakeCallableErrorCode(input),
      ).toBe(expected);

      expect(
        isRetryableScanIntakeCode(expected),
      ).toBe(true);
    },
  );

  it.each([
    ["functions/invalid-argument", "invalid-argument"],
    ["functions/permission-denied", "permission-denied"],
    ["functions/unauthenticated", "unauthorized"],
    ["functions/failed-precondition", "failed-precondition"],
    ["functions/not-found", "not-found"],
    ["functions/already-exists", "duplicate"],
    ["functions/internal", "internal"],
  ])(
    "preserves terminal callable code %s",
    (input, expected) => {
      expect(
        mapScanIntakeCallableErrorCode(input),
      ).toBe(expected);

      expect(
        isRetryableScanIntakeCode(expected),
      ).toBe(false);
    },
  );

  it("retries the exact frozen request with the same operation ID", async () => {
    const frozen = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "scan-intake-op-1",
    );

    const attempts: ReceiveScannedInventoryIntakeRequest[] = [];

    const execute = vi.fn(
      async (
        request: ReceiveScannedInventoryIntakeRequest,
      ): Promise<ReceiveScannedInventoryIntakeResponse> => {
        attempts.push(request);

        if (attempts.length === 1) {
          return {
            ok: false,
            code: "unavailable",
            message: "Connection interrupted.",
          };
        }

        return SUCCESS;
      },
    );

    const shouldRetry = vi.fn(() => true);

    const result = await executeScanIntakeWithRetry({
      request: frozen,
      execute,
      shouldRetry,
    });

    expect(result).toEqual(SUCCESS);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledOnce();

    expect(attempts[0]).toBe(frozen);
    expect(attempts[1]).toBe(frozen);
    expect(attempts[0]?.operationId).toBe(
      "scan-intake-op-1",
    );
  });

  it("stops after one attempt when retry is declined", async () => {
    const frozen = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "scan-intake-op-2",
    );

    const failure: ReceiveScannedInventoryIntakeResponse = {
      ok: false,
      code: "deadline-exceeded",
      message: "Deadline exceeded.",
    };

    const execute = vi.fn(async () => failure);
    const shouldRetry = vi.fn(() => false);

    const result = await executeScanIntakeWithRetry({
      request: frozen,
      execute,
      shouldRetry,
    });

    expect(result).toEqual(failure);
    expect(execute).toHaveBeenCalledOnce();
    expect(shouldRetry).toHaveBeenCalledOnce();
  });

  it("does not offer retry for a terminal response", async () => {
    const frozen = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "scan-intake-op-3",
    );

    const failure: ReceiveScannedInventoryIntakeResponse = {
      ok: false,
      code: "failed-precondition",
      message: "Request is invalid for current state.",
    };

    const execute = vi.fn(async () => failure);
    const shouldRetry = vi.fn(() => true);

    const result = await executeScanIntakeWithRetry({
      request: frozen,
      execute,
      shouldRetry,
    });

    expect(result).toEqual(failure);
    expect(execute).toHaveBeenCalledOnce();
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("does not offer retry after immediate success", async () => {
    const frozen = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "scan-intake-op-4",
    );

    const execute = vi.fn(async () => SUCCESS);
    const shouldRetry = vi.fn(() => true);

    const result = await executeScanIntakeWithRetry({
      request: frozen,
      execute,
      shouldRetry,
    });

    expect(result).toEqual(SUCCESS);
    expect(execute).toHaveBeenCalledOnce();
    expect(shouldRetry).not.toHaveBeenCalled();
  });

  it("requires a non-empty operation ID", () => {
    expect(() =>
      buildFrozenScanIntakeRequest(
        BASE_REQUEST,
        "   ",
      ),
    ).toThrow(
      "Scan intake operation ID is required.",
    );
  });

  it("keeps separate physical scans as separate logical operations", () => {
    const first = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "physical-intake-1",
    );

    const second = buildFrozenScanIntakeRequest(
      BASE_REQUEST,
      "physical-intake-2",
    );

    expect(first.operationId).toBe(
      "physical-intake-1",
    );

    expect(second.operationId).toBe(
      "physical-intake-2",
    );

    expect(first.operationId).not.toBe(
      second.operationId,
    );
  });
});
