import { describe, expect, it } from "vitest";

import {
  selectValueJoinDefinitions,
  verifyDefaultValueJoins,
  verifyValueJoinDefinition,
} from "./joinVerifier";

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

function mockDb(collections: Record<string, Array<Record<string, unknown>>>) {
  const limits: Record<string, number[]> = {};
  const countCalls: Record<string, number> = {};
  const scanCalls: Record<string, number> = {};

  return {
    limits,
    countCalls,
    scanCalls,
    db: {
      collection: (collectionName: string) => {
        const records = collections[collectionName] ?? [];
        return {
          select: () => ({
            limit: (limit: number) => {
              scanCalls[collectionName] = (scanCalls[collectionName] ?? 0) + 1;
              limits[collectionName] = [
                ...(limits[collectionName] ?? []),
                limit,
              ];
              return {
                get: async () => ({
                  docs: records
                    .slice(0, limit)
                    .map((record, index) => doc(`${collectionName}-${index}`, record)),
                }),
              };
            },
          }),
          count: () => ({
            get: async () => {
              countCalls[collectionName] = (countCalls[collectionName] ?? 0) + 1;
              return { data: () => ({ count: records.length }) };
            },
          }),
        };
      },
    },
  };
}

const definition = {
  sourceCollection: "rentals",
  sourceKey: "patientId",
  targetCollection: "patients",
  targetKey: "patientId",
  scanLimit: 3,
};

describe("joinVerifier Firestore scan completeness", () => {
  it("marks fewer documents than scan limit complete", async () => {
    const { db, limits } = mockDb({
      rentals: [{ patientId: "PAT-001" }, { patientId: "PAT-002" }],
      patients: [{ patientId: "PAT-001" }, { patientId: "PAT-002" }],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(limits.rentals).toEqual([4]);
    expect(limits.patients).toEqual([4]);
    expect(result.sourceTestedCount).toBe(2);
    expect(result.targetTestedCount).toBe(2);
    expect(result.joinComplete).toBe(true);
    expect(result.classification).toBe("VERIFIED");
  });

  it("marks exactly scan limit complete because the sentinel query was exhausted", async () => {
    const { db } = mockDb({
      rentals: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
      ],
      patients: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
      ],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetTestedCount).toBe(3);
    expect(result.joinComplete).toBe(true);
    expect(result.classification).toBe("VERIFIED");
  });

  it("marks more documents than scan limit incomplete", async () => {
    const { db } = mockDb({
      rentals: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
        { patientId: "PAT-004" },
      ],
      patients: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
        { patientId: "PAT-004" },
      ],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetTestedCount).toBe(3);
    expect(result.joinComplete).toBe(false);
    expect(result.classification).toBe("SAMPLED");
  });

  it("does not use aggregate count equality to prove completeness", async () => {
    const { db } = mockDb({
      rentals: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
        { patientId: "PAT-004" },
      ],
      patients: [{ patientId: "PAT-001" }],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceActualCount).toBe(4);
    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetActualCount).toBe(1);
    expect(result.targetTestedCount).toBe(1);
    expect(result.joinComplete).toBe(false);
    expect(result.classification).toBe("SAMPLED");
  });
});

describe("joinVerifier request-local reuse and routing", () => {
  it("selects no joins for ordinary count questions", () => {
    expect(selectValueJoinDefinitions("Audit inventory counts")).toEqual([]);
    expect(selectValueJoinDefinitions("Analyze rental status counts")).toEqual([]);
  });

  it("selects only the requested supported relationship", () => {
    expect(selectValueJoinDefinitions("Verify rentals link to patients by patientId").map((d) => d.sourceCollection))
      .toEqual(["rentals"]);
    expect(selectValueJoinDefinitions("Find orphaned patientAuthorizations").map((d) => d.sourceCollection))
      .toEqual(["patientAuthorizations"]);
  });

  it("selects both supported relationships when both are requested", () => {
    expect(selectValueJoinDefinitions("Verify rental and authorization linkage to patients").map((d) => d.sourceCollection))
      .toEqual(["patientAuthorizations", "rentals"]);
  });

  it("reuses the patients scan and aggregate count across both joins", async () => {
    const { db, scanCalls, countCalls } = mockDb({
      rentals: [{ patientId: "PAT-001" }],
      patientAuthorizations: [{ patientId: "PAT-001" }],
      patients: [{ patientId: "PAT-001" }],
    });

    const results = await verifyDefaultValueJoins(db as never);

    expect(results).toHaveLength(2);
    expect(scanCalls.patients).toBe(1);
    expect(countCalls.patients).toBe(1);
    expect(scanCalls.rentals).toBe(1);
    expect(scanCalls.patientAuthorizations).toBe(1);
    expect(countCalls.rentals).toBe(1);
    expect(countCalls.patientAuthorizations).toBe(1);
  });
});
