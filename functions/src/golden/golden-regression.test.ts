import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

import {
  assertAdmin,
  assertOperationId,
  assertTransition,
  claimWorkflowOperation,
  RENTAL_TRANSITIONS,
  type WorkflowResult,
} from "../domainWorkflows/shared.js";
import type { MovementActor } from "../inventory/movementService.js";

type FakeSnapshot = {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

type FakeRef = {
  path: string;
};

function fakeSnapshot(data?: Record<string, unknown>): FakeSnapshot {
  return {
    exists: data !== undefined,
    data: () => data,
  };
}

function createFakeDatabase() {
  return {
    collection: (collectionName: string) => ({
      doc: (docId: string): FakeRef => ({ path: `${collectionName}/${docId}` }),
    }),
  };
}

function createFakeTransaction(seed: Record<string, Record<string, unknown>> = {}) {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];

  return {
    writes,
    get: async (ref: FakeRef) => fakeSnapshot(seed[ref.path]),
    set: (ref: FakeRef, data: Record<string, unknown>) => {
      writes.push({ path: ref.path, data });
    },
  };
}

function expectHttpsError(error: unknown, code: string, messagePattern: RegExp) {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toMatch(messagePattern);
}

const actor: MovementActor = {
  uid: "golden-actor-001",
  email: "golden.actor@example.test",
  role: "admin",
};

describe("AHM Golden Regression Suite - Functions invariants", () => {
  it("GOLDEN-DOM-001 rejects malformed workflow operation IDs", () => {
    expect(() => assertOperationId("golden-op-001")).not.toThrow();

    for (const invalidOperationId of ["", "short", "bad/id", "."].values()) {
      expect(() => assertOperationId(invalidOperationId)).toThrow(HttpsError);
    }
  });

  it("GOLDEN-IDEMP-002 returns a stable duplicate result for the same operation fingerprint", async () => {
    const storedResult: WorkflowResult = {
      status: "success",
      operationId: "golden-op-002",
      workflowType: "rental-checkout",
      movementIds: ["movement-golden-001"],
      rentalId: "rental-golden-001",
    };
    const database = createFakeDatabase();
    const transaction = createFakeTransaction({
      "domainWorkflowOperations/golden-actor-001_golden-op-002": {
        requestFingerprint: JSON.stringify({ rentalId: "rental-golden-001" }),
        result: storedResult,
        movementIds: ["movement-golden-001"],
      },
    });

    const claimed = await claimWorkflowOperation({
      transaction: transaction as never,
      database: database as never,
      operationId: "golden-op-002",
      workflowType: "rental-checkout",
      actor,
      fingerprint: { rentalId: "rental-golden-001" },
    });

    expect(claimed.duplicate).toBe(true);
    if (claimed.duplicate) {
      expect(claimed.result).toMatchObject({
        status: "duplicate_operation",
        code: "duplicate_operation",
        operationId: "golden-op-002",
        workflowType: "rental-checkout",
        movementIds: ["movement-golden-001"],
      });
    }
    expect(transaction.writes).toHaveLength(0);
  });

  it("GOLDEN-IDEMP-003 rejects conflicting reuse of a workflow operation ID", async () => {
    const database = createFakeDatabase();
    const transaction = createFakeTransaction({
      "domainWorkflowOperations/golden-actor-001_golden-op-003": {
        requestFingerprint: JSON.stringify({ rentalId: "rental-golden-001" }),
      },
    });

    await expect(
      claimWorkflowOperation({
        transaction: transaction as never,
        database: database as never,
        operationId: "golden-op-003",
        workflowType: "rental-checkout",
        actor,
        fingerprint: { rentalId: "rental-golden-002" },
      })
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This operationId was already used with different workflow data.",
    });
    expect(transaction.writes).toHaveLength(0);
  });

  it("GOLDEN-AUTH-003 preserves the Functions admin actor boundary", () => {
    expect(() => assertAdmin({ ...actor, role: "admin" })).not.toThrow();
    expect(() => assertAdmin({ ...actor, role: "tank" })).not.toThrow();

    try {
      assertAdmin({ ...actor, role: "staff" });
      throw new Error("Expected staff actor to be denied.");
    } catch (error) {
      expectHttpsError(error, "permission-denied", /Admin access is required/);
    }
  });

  it("GOLDEN-DOM-002 rejects invalid rental state transitions", () => {
    expect(() =>
      assertTransition(RENTAL_TRANSITIONS, "draft", "active", "rental")
    ).not.toThrow();

    try {
      assertTransition(RENTAL_TRANSITIONS, "returned", "checked_out", "rental");
      throw new Error("Expected invalid rental transition to be denied.");
    } catch (error) {
      expectHttpsError(error, "failed-precondition", /Invalid rental state transition/);
    }
  });
});
