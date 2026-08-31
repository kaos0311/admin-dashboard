import { describe, expect, it } from "vitest";

import {
  selectValueJoinDefinitions,
  verifyDefaultValueJoins,
  verifyValueJoinDefinition,
} from "./joinVerifier";

function doc(id: string, data: Record<string, unknown>) {
  const { __id: _id, ...stored } = data;
  return { id, exists: true, data: () => stored };
}

function missingDoc(id: string) {
  return { id, exists: false, data: () => ({}) };
}

function recordId(collectionName: string, record: Record<string, unknown>, index: number) {
  return typeof record.__id === "string" ? record.__id : `${collectionName}-${index}`;
}

function mockDb(collections: Record<string, Array<Record<string, unknown>>>) {
  const limits: Record<string, number[]> = {};
  const countCalls: Record<string, number> = {};
  const scanCalls: Record<string, number> = {};
  const docReads: string[] = [];
  const whereCalls: Array<{ collectionName: string; field: string; values: unknown[] }> = [];

  return {
    limits,
    countCalls,
    scanCalls,
    docReads,
    whereCalls,
    db: {
      collection: (collectionName: string) => {
        const records = collections[collectionName] ?? [];
        return {
          doc: (id: string) => ({ collectionName, id }),
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
                    .map((record, index) =>
                      doc(recordId(collectionName, record, index), record)
                    ),
                }),
              };
            },
          }),
          where: (field: string, op: string, values: unknown[]) => {
            whereCalls.push({ collectionName, field, values });
            return {
              get: async () => ({
                docs: op === "in"
                  ? records
                      .filter((record) => values.includes(record[field]))
                      .map((record, index) =>
                        doc(recordId(collectionName, record, index), record)
                      )
                  : [],
              }),
            };
          },
          count: () => ({
            get: async () => {
              countCalls[collectionName] = (countCalls[collectionName] ?? 0) + 1;
              return { data: () => ({ count: records.length }) };
            },
          }),
        };
      },
      getAll: async (...refs: Array<{ collectionName: string; id: string }>) =>
        refs.map((ref) => {
          docReads.push(`${ref.collectionName}/${ref.id}`);
          const records = collections[ref.collectionName] ?? [];
          const found = records.find((record, index) =>
            recordId(ref.collectionName, record, index) === ref.id
          );
          return found ? doc(ref.id, found) : missingDoc(ref.id);
        }),
    },
  };
}

const definition = {
  sourceCollection: "rentals",
  sourceKey: "patientId",
  targetCollection: "patients",
  targetKey: "id",
  scanLimit: 3,
  targetLookup: "document_id_from_safe_patient_id" as const,
};

describe("joinVerifier Firestore scan completeness", () => {
  it("marks fewer documents than scan limit complete", async () => {
    const { db, limits } = mockDb({
      rentals: [{ patientId: "PAT-001" }, { patientId: "PAT-002" }],
      patients: [{ __id: "pat-001", patientId: "PAT-001" }, { __id: "pat-002", patientId: "PAT-002" }],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(limits.rentals).toEqual([4]);
    expect(limits.patients).toBeUndefined();
    expect(result.sourceTestedCount).toBe(2);
    expect(result.targetTestedCount).toBe(2);
    expect(result.targetVerificationRecordsRead).toBe(2);
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
        { __id: "pat-001", patientId: "PAT-001" },
        { __id: "pat-002", patientId: "PAT-002" },
        { __id: "pat-003", patientId: "PAT-003" },
      ],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetTestedCount).toBe(3);
    expect(result.targetVerificationRecordsRead).toBe(3);
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
        { __id: "pat-001", patientId: "PAT-001" },
        { __id: "pat-002", patientId: "PAT-002" },
        { __id: "pat-003", patientId: "PAT-003" },
        { __id: "pat-004", patientId: "PAT-004" },
      ],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetTestedCount).toBe(3);
    expect(result.targetVerificationRecordsRead).toBe(3);
    expect(result.targetVerificationComplete).toBe(true);
    expect(result.joinComplete).toBe(false);
    expect(result.classification).toBe("SAMPLED");
    expect(result.outcome).toBe("UNKNOWN");
  });

  it("does not use aggregate count equality to prove completeness", async () => {
    const { db } = mockDb({
      rentals: [
        { patientId: "PAT-001" },
        { patientId: "PAT-002" },
        { patientId: "PAT-003" },
        { patientId: "PAT-004" },
      ],
      patients: [{ __id: "pat-001", patientId: "PAT-001" }],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(result.sourceActualCount).toBe(4);
    expect(result.sourceTestedCount).toBe(3);
    expect(result.targetActualCount).toBe(1);
    expect(result.targetTestedCount).toBe(3);
    expect(result.joinComplete).toBe(false);
    expect(result.classification).toBe("SAMPLED");
  });

  it("uses exact document-ID reads for sampled source patient IDs", async () => {
    const { db, docReads } = mockDb({
      rentals: [
        { patientId: "PAT-001" },
        { patientId: "PAT-MISSING" },
        { patientId: "PAT-001" },
      ],
      patients: [{ __id: "pat-001", patientId: "PAT-001" }],
    });

    const result = await verifyValueJoinDefinition(db as never, definition);

    expect(docReads).toEqual(["patients/pat-001", "patients/pat-missing"]);
    expect(result.exactUniqueMatches).toBe(2);
    expect(result.unmatched).toBe(1);
    expect(result.targetUniqueKeysChecked).toBe(2);
    expect(result.targetDuplicateKeysStructurallyImpossible).toBe(true);
    expect(result.outcome).toBe("DEFECTS_FOUND");
  });

  it("supports field equality lookup ambiguity when target IDs are not canonical", async () => {
    const { db, whereCalls } = mockDb({
      rentals: [{ patientId: "PAT-DUP" }],
      patients: [
        { __id: "patient-a", patientId: "PAT-DUP" },
        { __id: "patient-b", patientId: "PAT-DUP" },
      ],
    });

    const result = await verifyValueJoinDefinition(db as never, {
      ...definition,
      targetKey: "patientId",
      targetLookup: "field_equality",
    });

    expect(whereCalls).toEqual([
      { collectionName: "patients", field: "patientId", values: ["PAT-DUP"] },
    ]);
    expect(result.ambiguousMatches).toBe(1);
    expect(result.outcome).toBe("AMBIGUOUS");
    expect(result.targetDuplicateKeysStructurallyImpossible).toBe(false);
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
    const { db, scanCalls, countCalls, docReads } = mockDb({
      rentals: [{ patientId: "PAT-001" }],
      patientAuthorizations: [{ patientId: "PAT-001" }],
      patients: [{ __id: "pat-001", patientId: "PAT-001" }],
    });

    const results = await verifyDefaultValueJoins(db as never);

    expect(results).toHaveLength(2);
    expect(scanCalls.patients).toBeUndefined();
    expect(countCalls.patients).toBe(1);
    expect(scanCalls.rentals).toBe(1);
    expect(scanCalls.patientAuthorizations).toBe(1);
    expect(countCalls.rentals).toBe(1);
    expect(countCalls.patientAuthorizations).toBe(1);
    expect(docReads).toEqual(["patients/pat-001"]);
  });
});
