import { describe, expect, it, vi } from "vitest";

import { resolveManualUpsertOperation } from "./manualUpsertOperationLifecycle";

describe("manual upsert operation lifecycle", () => {
  it("reuses the same operation id for the same manual save fingerprint", () => {
    const createOperationId = vi.fn(() => "manual-upsert-op-2");
    const current = {
      fingerprint: "same-save-fingerprint",
      operationId: "manual-upsert-op-1",
    };

    const resolved = resolveManualUpsertOperation({
      current,
      fingerprint: "same-save-fingerprint",
      createOperationId,
    });

    expect(resolved).toBe(current);
    expect(createOperationId).not.toHaveBeenCalled();
  });

  it("creates a new operation id after a changed manual save fingerprint", () => {
    const createOperationId = vi.fn(() => "manual-upsert-op-2");

    const resolved = resolveManualUpsertOperation({
      current: {
        fingerprint: "old-save-fingerprint",
        operationId: "manual-upsert-op-1",
      },
      fingerprint: "new-save-fingerprint",
      createOperationId,
    });

    expect(resolved).toEqual({
      fingerprint: "new-save-fingerprint",
      operationId: "manual-upsert-op-2",
    });
    expect(createOperationId).toHaveBeenCalledTimes(1);
  });

  it("creates a new operation id after a definitive result clears pending state", () => {
    const createOperationId = vi.fn(() => "manual-upsert-op-3");

    const resolved = resolveManualUpsertOperation({
      current: null,
      fingerprint: "same-save-fingerprint",
      createOperationId,
    });

    expect(resolved).toEqual({
      fingerprint: "same-save-fingerprint",
      operationId: "manual-upsert-op-3",
    });
  });
});
