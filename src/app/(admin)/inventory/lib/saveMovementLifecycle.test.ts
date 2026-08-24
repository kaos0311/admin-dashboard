import { describe, expect, it } from "vitest";

import {
  armResolvedNewSaveMovementState,
  buildSaveMovementFingerprint,
  completeSaveMovementState,
  createResolvedNewSaveMovementState,
  reconcileSaveMovementState,
  type SaveMovementState,
} from "./saveMovementLifecycle";

const BASE_FINGERPRINT_INPUT = {
  kind: "existing_adjustment" as const,
  inventoryItemId: "inventory-1",
  targetQuantityOnHand: 12,
  productId: "product-1",
  barcode: "1234567890123",
  serialNumber: "SERIAL-1",
  lotNumber: "LOT-1",
};

describe("inventory Save movement lifecycle", () => {
  it("produces the same fingerprint for the same logical movement", () => {
    const first = buildSaveMovementFingerprint(
      BASE_FINGERPRINT_INPUT,
    );

    const second = buildSaveMovementFingerprint({
      ...BASE_FINGERPRINT_INPUT,
    });

    expect(second).toBe(first);
  });

  it.each([
    ["inventory item", { inventoryItemId: "inventory-2" }],
    ["target quantity", { targetQuantityOnHand: 13 }],
    ["product", { productId: "product-2" }],
    ["barcode", { barcode: "9999999999999" }],
    ["serial", { serialNumber: "SERIAL-2" }],
    ["lot", { lotNumber: "LOT-2" }],
  ])(
    "changes the fingerprint when %s changes",
    (_label, change) => {
      const original = buildSaveMovementFingerprint(
        BASE_FINGERPRINT_INPUT,
      );

      const changed = buildSaveMovementFingerprint({
        ...BASE_FINGERPRINT_INPUT,
        ...change,
      });

      expect(changed).not.toBe(original);
    },
  );

  it("reuses the exact pending state when the fingerprint matches", () => {
    const state: SaveMovementState = {
      fingerprint: "same-fingerprint",
      stage: "pending",
      operationId: "inventory-save-op-1",
      request: {
        movementType: "manual_adjustment",
        inventoryItemId: "inventory-1",
        quantity: 2,
        quantityDelta: 2,
      },
      context: {
        kind: "existing",
        inventoryItemId: "inventory-1",
      },
    };

    expect(
      reconcileSaveMovementState(
        state,
        "same-fingerprint",
      ),
    ).toBe(state);
  });

  it("invalidates pending state when movement-defining data changes", () => {
    const state: SaveMovementState = {
      fingerprint: "old-fingerprint",
      stage: "pending",
      operationId: "inventory-save-op-1",
      request: {
        movementType: "manual_adjustment",
        inventoryItemId: "inventory-1",
        quantity: 2,
        quantityDelta: 2,
      },
      context: {
        kind: "existing",
        inventoryItemId: "inventory-1",
      },
    };

    expect(
      reconcileSaveMovementState(
        state,
        "new-fingerprint",
      ),
    ).toBeNull();
  });

  it("preserves the resolved new inventory target before movement is armed", () => {
    const state = createResolvedNewSaveMovementState({
      fingerprint: "new-save",
      inventoryItemId: "resolved-inventory-42",
      action: "created",
    });

    expect(state).toEqual({
      fingerprint: "new-save",
      stage: "target_resolved",
      operationId: null,
      request: null,
      context: {
        kind: "new",
        inventoryItemId: "resolved-inventory-42",
        action: "created",
      },
    });
  });

  it("arms a resolved target with one operation ID and frozen request", () => {
    const resolved = createResolvedNewSaveMovementState({
      fingerprint: "new-save",
      inventoryItemId: "resolved-inventory-42",
      action: "merged",
    });

    const armed = armResolvedNewSaveMovementState({
      state: resolved,
      operationId: "inventory-save-op-99",
      request: {
        movementType: "receive",
        inventoryItemId: "resolved-inventory-42",
        productId: "product-7",
        barcode: "123",
        serialNumber: "SERIAL",
        lotNumber: "LOT",
        quantity: 5,
        source: "inventory_page",
      },
    });

    expect(armed.stage).toBe("pending");
    expect(armed.operationId).toBe(
      "inventory-save-op-99",
    );
    expect(armed.context).toEqual(resolved.context);
    expect(armed.request).toEqual({
      movementType: "receive",
      inventoryItemId: "resolved-inventory-42",
      productId: "product-7",
      barcode: "123",
      serialNumber: "SERIAL",
      lotNumber: "LOT",
      quantity: 5,
      source: "inventory_page",
    });

    expect(resolved.stage).toBe("target_resolved");
    expect(resolved.operationId).toBeNull();
  });

  it("refuses to arm a Save that is not in target_resolved state", () => {
    const pending: SaveMovementState = {
      fingerprint: "new-save",
      stage: "pending",
      operationId: "existing-operation",
      request: {
        movementType: "receive",
        inventoryItemId: "inventory-1",
        quantity: 1,
      },
      context: {
        kind: "new",
        inventoryItemId: "inventory-1",
        action: "created",
      },
    };

    expect(() =>
      armResolvedNewSaveMovementState({
        state: pending,
        operationId: "new-operation",
        request: {
          movementType: "receive",
          inventoryItemId: "inventory-1",
          quantity: 1,
        },
      }),
    ).toThrow(
      "Only a resolved new-inventory Save can be armed for movement.",
    );
  });

  it("marks a definitive movement complete and clears its operation ID", () => {
    const pending: SaveMovementState = {
      fingerprint: "existing-save",
      stage: "pending",
      operationId: "inventory-save-op-1",
      request: {
        movementType: "manual_adjustment",
        inventoryItemId: "inventory-1",
        quantity: 3,
        quantityDelta: -3,
      },
      context: {
        kind: "existing",
        inventoryItemId: "inventory-1",
      },
    };

    const complete =
      completeSaveMovementState(pending);

    expect(complete.stage).toBe("complete");
    expect(complete.operationId).toBeNull();

    // Keep the frozen request so a later non-movement failure
    // cannot reconstruct a different logical operation.
    expect(complete.request).toEqual(
      pending.request,
    );

    expect(pending.stage).toBe("pending");
    expect(pending.operationId).toBe(
      "inventory-save-op-1",
    );
  });
});
