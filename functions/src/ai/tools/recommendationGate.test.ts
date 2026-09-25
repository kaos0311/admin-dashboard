/**
 * Deterministic unit tests for the Jarvis recommendation gate.
 *
 * Proves that high-impact remediation recommendations are blocked when the
 * underlying defect is not VERIFIED with sufficient evidence, while diagnostic
 * recommendations and ordinary prose pass through unchanged.
 *
 * ALSO proves the live-test regressions:
 * - "Consider restoring insurancePatients" is blocked on UNKNOWN evidence
 * - "Consider importing missing insurancePatients" is blocked on UNKNOWN
 * - an empty collection (actualCount=0) alone cannot authorize restore/import
 * - restore/restored/importing/reimport/backfill variants are detected
 * - unrelated VERIFIED evidence cannot authorize remediation
 * - SAMPLED evidence cannot authorize remediation
 * - relevant VERIFIED defect may authorize appropriate remediation
 * - diagnostic verbs investigate/audit/verify remain allowed
 * - the unsafe recommendation itself is removed/downgraded, not just warned
 */

import { describe, expect, it } from "vitest";

import {
  applyRecommendationGate,
  type RecommendationGateInput,
} from "./recommendationGate";
import {
  canRecommendAction,
  type CollectionSampleSummary,
  countFromAggregate,
  countFromLimitedQuery,
  type Evidence,
  type JoinOutcome,
  type ValueJoinVerification,
} from "../types/reporting";

function makeSummary(
  collection: string,
  classification: "VERIFIED" | "SAMPLED" | "INFERRED" | "UNKNOWN" | "NOT_TESTED",
  aggregateCount?: number | null,
  missingFields: Record<string, number> = {},
  evidence?: Evidence[]
): CollectionSampleSummary {
  const report =
    aggregateCount !== undefined
      ? countFromAggregate(aggregateCount ?? 0, aggregateCount ?? 0)
      : countFromLimitedQuery(0, 1000);

  return {
    collection,
    count: report,
    statusCounts: {},
    missingKeyCounts: missingFields,
    fieldsObserved: ["id"],
    schemaCompleteness: "partial",
    classification,
    evidence: evidence ?? [
      {
        kind: aggregateCount !== undefined && aggregateCount !== null ? "aggregate_count" : "sampled_documents",
        reference: `${collection}: ${classification}`,
      },
    ],
  };
}

function makeValueJoin(
  overrides: Partial<ValueJoinVerification> = {}
): ValueJoinVerification {
  const outcome: JoinOutcome = overrides.outcome ?? "DEFECTS_FOUND";
  return {
    sourceCollection: "rentals",
    targetCollection: "patients",
    sourceKey: "patientId",
    targetKey: "patientId",
    sourceActualCount: 10,
    targetActualCount: 10,
    sourceCountMethod: "aggregate_count",
    targetCountMethod: "aggregate_count",
    sourceTestedCount: 10,
    targetTestedCount: 10,
    sourceRecordsWithKey: 10,
    sourceMissingKeyCount: outcome === "DEFECTS_FOUND" ? 1 : 0,
    targetRecordsWithKey: 10,
    targetMissingKeyCount: 0,
    uniqueTargetKeys: 10,
    duplicateTargetKeys: outcome === "AMBIGUOUS" ? 1 : 0,
    targetDuplicateKeyCount: outcome === "AMBIGUOUS" ? 2 : 0,
    ambiguityCount: outcome === "AMBIGUOUS" ? 1 : 0,
    exactUniqueMatches: outcome === "CLEAN" ? 10 : 9,
    ambiguousMatches: outcome === "AMBIGUOUS" ? 1 : 0,
    unmatched: outcome === "DEFECTS_FOUND" ? 1 : 0,
    notObservedInTargetSample: 0,
    unresolvedAgainstIncompleteTarget: 0,
    sourceScanComplete: true,
    targetVerificationComplete: true,
    coveragePercentage: outcome === "CLEAN" ? 100 : 90,
    sampleStatus: "complete",
    joinMethod: "complete_value_scan",
    joinComplete: true,
    targetLookupMethod: "document_id",
    targetUniqueKeysChecked: 10,
    targetVerificationRecordsRead: 10,
    targetVerificationQueryOperations: 0,
    targetDuplicateKeysStructurallyImpossible: true,
    outcome,
    normalization: "trim",
    classification: "VERIFIED",
    evidenceRef: "value-join:rentals.patientId->patients.patientId:complete_value_scan",
    evidence: [
      {
        kind: "value_join",
        reference: "value-join:rentals.patientId->patients.patientId:complete_value_scan",
      },
    ],
    leftCollection: "rentals",
    rightCollection: "patients",
    leftField: "patientId",
    rightField: "patientId",
    normalizeRule: "trim",
    recordsTestedLeft: 10,
    recordsTestedRight: 10,
    missingKeysLeft: outcome === "DEFECTS_FOUND" ? 1 : 0,
    missingKeysRight: 0,
    duplicateRightKeys: outcome === "AMBIGUOUS" ? 1 : 0,
    exactMatches: outcome === "CLEAN" ? 10 : 9,
    unmatchedLeft: outcome === "DEFECTS_FOUND" ? 1 : 0,
    unmatchedRight: 0,
    ...overrides,
  };
}

const baseInput: Omit<RecommendationGateInput, "answer"> = {
  summaries: [
    makeSummary("patientRecords", "VERIFIED", 5000),
    makeSummary("orders", "INFERRED", undefined, { patientName: 3 }),
    makeSummary("importJobs", "UNKNOWN"),
  ],
  contradictions: [],
  joins: [],
  evidence: [],
};

describe("recommendation gate", () => {
  it("allows re-import when defect is VERIFIED with sufficient evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the patient records.",
      summaries: [
        makeSummary("patientRecords", "VERIFIED", 5000, undefined, [
          { kind: "aggregate_count", reference: "patientRecords.count()=5000" },
          { kind: "import_metadata", reference: "job-1 destinationSummary" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Re-import the patient records.");
  });

  it("blocks re-import when defect is INFERRED", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the patient records.",
      summaries: [makeSummary("patientRecords", "INFERRED", undefined, { patientName: 3 })],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("not recommended yet because the underlying defect has not been verified");
    expect(result.gatedAnswer).toContain("Audit the source data");
  });

  it("blocks schema migration for UNKNOWN defect", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Migrate the schema to version 2.",
      summaries: [makeSummary("schemaMigration", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("schema_migration");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Migrating the schema is not recommended yet");
  });

  it("downgrades unsupported restore records recommendation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "You should restore the patient records.",
      summaries: [makeSummary("patientRestore", "INFERRED")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).not.toContain("You should restore the patient records.");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("downgrades unsupported backfill payer IDs recommendation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Backfill payer IDs for all insurance records.",
      summaries: [makeSummary("insuranceRecords", "INFERRED")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("data_repair");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Repairing data is not recommended yet");
  });

  it("allows diagnostic investigate payer linkage", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Investigate payer linkage between insurance records and orders.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Investigate payer linkage between insurance records and orders.");
  });

  it("leaves ordinary non-remediation prose unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "The sample suggests there are likely many records in the patient records collection.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("The sample suggests there are likely many records in the patient records collection.");
  });

  it("evaluates multiple recommendations independently", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Re-import the patient records. Repair the orders.",
      summaries: [
        makeSummary("patientRecords", "VERIFIED", 5000, undefined, [
          { kind: "import_metadata", reference: "job-1" },
        ]),
        makeSummary("orders", "VERIFIED", 100, { patientName: 3 }, [
          { kind: "aggregate_count", reference: "orders.count()=100" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.recommendations[1].action).toBe("data_repair");
    expect(result.recommendations[1].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Re-import the patient records.");
    expect(result.gatedAnswer).toContain("Repair the orders.");
  });

  it("blocks delete recommendation for non-VERIFIED defect", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Delete the duplicate inventory records.",
      summaries: [makeSummary("inventory", "INFERRED", undefined, { sku: 5 })],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("data_repair");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Repairing data is not recommended yet");
  });

  it("preserves PHI redaction after recommendation gating", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "SSN 123-45-6789 was found. Re-import the patient records.",
      summaries: [makeSummary("patientRecords", "INFERRED")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
    expect(result.gatedAnswer).toContain("123-45-6789");
  });

  it("allows VERIFIED data_repair with aggregate_count evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the orders with missing patient names.",
      summaries: [
        makeSummary("orders", "VERIFIED", 100, { patientName: 3 }, [
          { kind: "aggregate_count", reference: "orders.count()=100" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("data_repair");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Repair the orders with missing patient names.");
  });

  it("blocks restore recommendation when no relevant evidence is bound", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the backup.",
      summaries: [makeSummary("patientRecords", "VERIFIED", 5000)],
      evidence: [{ kind: "aggregate_count", reference: "patientRecords.count()=5000" }],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("handles empty answer gracefully", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("");
  });

  it("blocks re-import when only unrelated VERIFIED collection evidence exists", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the payer records.",
      summaries: [
        makeSummary("rentals", "VERIFIED", 1000, undefined, [
          { kind: "aggregate_count", reference: "rentals.count()=1000" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("blocks schema migration when only unrelated VERIFIED collection evidence exists", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Migrate the schema to version 2.",
      summaries: [
        makeSummary("rentals", "VERIFIED", 1000, undefined, [
          { kind: "aggregate_count", reference: "rentals.count()=1000" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("schema_migration");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Migrating the schema is not recommended yet");
  });

  it("returns UNKNOWN classification for unmatched recommendation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import everything.",
      summaries: [
        makeSummary("rentals", "VERIFIED", 1000),
        makeSummary("orders", "INFERRED"),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("allows relevant VERIFIED evidence to authorize permitted remediation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the affected patient import.",
      summaries: [
        makeSummary("patientRecords", "VERIFIED", 5000, undefined, [
          { kind: "aggregate_count", reference: "patientRecords.count()=5000" },
          { kind: "import_metadata", reference: "job-1 destinationSummary" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Re-import the affected patient import.");
  });

  it("blocks relevant INFERRED evidence even with required evidence kind", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the patient records.",
      summaries: [
        makeSummary("patientRecords", "INFERRED", undefined, { patientName: 3 }, [
          { kind: "import_metadata", reference: "job-1 destinationSummary" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("INFERRED");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("binds multiple recommendations independently to their own evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Re-import the patient records. Migrate the orders schema.",
      summaries: [
        makeSummary("patientRecords", "VERIFIED", 5000, undefined, [
          { kind: "import_metadata", reference: "job-1" },
        ]),
        makeSummary("orders", "VERIFIED", 100, undefined, [
          { kind: "schema_inspection", reference: "orders-v2" },
          { kind: "aggregate_count", reference: "orders.count()=100" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.recommendations[1].action).toBe("schema_migration");
    expect(result.recommendations[1].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Re-import the patient records.");
    expect(result.gatedAnswer).toContain("Migrate the orders schema.");
  });

  it("leaves diagnostic recommendations unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Investigate the rentals linkage. Verify the orders data.",
      summaries: [
        makeSummary("rentals", "VERIFIED", 1000),
        makeSummary("orders", "INFERRED"),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Investigate the rentals linkage. Verify the orders data.");
  });

  it("does not let unrelated join evidence authorize remediation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the payer records.",
      summaries: [makeSummary("payerRecords", "UNKNOWN")],
      joins: [makeValueJoin()],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
  });

  it("allows relevant remediation with a complete verified value-join defect", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the rentals patient linkage.",
      summaries: [],
      joins: [makeValueJoin()],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toBe("Repair the rentals patient linkage.");
  });

  it("blocks remediation for sampled value-join defects", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the rentals patient linkage.",
      summaries: [],
      joins: [
        makeValueJoin({
          classification: "SAMPLED",
          sampleStatus: "sampled",
          joinMethod: "limited_value_scan",
          joinComplete: false,
        }),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("SAMPLED");
  });

  it("does not fabricate a defect from a complete clean join", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the rentals patient linkage.",
      summaries: [],
      joins: [makeValueJoin({ outcome: "CLEAN" })],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
  });

  it("canRecommendAction allows VERIFIED value_join evidence for data repair", () => {
    const decision = canRecommendAction("data_repair", {
      summary: "rentals.patientId has unmatched patient references",
      classification: "VERIFIED",
      evidence: [
        {
          kind: "value_join",
          reference: "value-join:rentals.patientId->patients.patientId:complete_value_scan",
        },
      ],
    });

    expect(decision.allowed).toBe(true);
  });

  it("blocks 'Consider restoring insurancePatients' on UNKNOWN evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Consider restoring insurancePatients data if expected but currently empty.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN", undefined)],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).not.toContain("restoring insurancePatients");
  });

  it("blocks 'Consider importing missing insurancePatients' on UNKNOWN evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Consider importing missing insurancePatients data.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN", undefined)],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
    expect(result.gatedAnswer).not.toContain("importing missing insurancePatients");
  });

  it("does not let empty collection actualCount=0 authorize restore/import", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 0, undefined, [
          { kind: "aggregate_count", reference: "insurancePatients.count()=0" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("detects natural-language restore variants", () => {
    const variants = [
      "Restoring the records.",
      "We are restoring the records.",
      "Restored the records.",
      "Restore the records.",
    ];
    for (const variant of variants) {
      const input: RecommendationGateInput = {
        ...baseInput,
        answer: variant,
        summaries: [makeSummary("insurancePatients", "UNKNOWN")],
      };
      const result = applyRecommendationGate(input);
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].action).toBe("restore");
      expect(result.recommendations[0].allowed).toBe(false);
    }
  });

  it("detects natural-language import variants", () => {
    const variants = [
      "Importing the records.",
      "Re-import the records.",
      "Reimport the records.",
      "Re-importing the records.",
      "We should backfill the records.",
      "Rebuild the linkage.",
      "Repair the data.",
      "Migrating the schema.",
      "Add a new linkage key.",
    ];
    for (const variant of variants) {
      const input: RecommendationGateInput = {
        ...baseInput,
        answer: variant,
        summaries: [],
      };
      const result = applyRecommendationGate(input);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].allowed).toBe(false);
    }
  });

  it("does not let unrelated VERIFIED evidence authorize remediation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Import the insurancePatients records.",
      summaries: [
        makeSummary("rentals", "VERIFIED", 1000, undefined, [
          { kind: "aggregate_count", reference: "rentals.count()=1000" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("does not let SAMPLED evidence authorize remediation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Import the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "SAMPLED", undefined, { insuranceName: 1 }, [
          { kind: "sampled_documents", reference: "insurancePatients: sampled" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("SAMPLED");
  });

  it("allows relevant VERIFIED defect to authorize appropriate remediation", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Repair the insurancePatients records with missing insurance names.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 100, { insuranceName: 4 }, [
          { kind: "aggregate_count", reference: "insurancePatients.count()=100" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("data_repair");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Repair the insurancePatients records with missing insurance names.");
  });

  it("leaves diagnostic verbs investigate/audit/verify allowed", () => {
    const variants = [
      "Investigate the insurancePatients linkage.",
      "Audit the insurancePatients data.",
      "Verify the insurancePatients joins.",
    ];
    for (const variant of variants) {
      const input: RecommendationGateInput = {
        ...baseInput,
        answer: variant,
        summaries: [],
      };
      const result = applyRecommendationGate(input);
      expect(result.recommendations).toHaveLength(0);
      expect(result.gatedAnswer).toBe(variant);
    }
  });

  it("replaces the unsafe affirmative recommendation with a single negative-safety downgrade", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Consider importing or restoring insurancePatients data if expected but currently empty.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    // The affirmative recommendation verbatim is gone (only the negative-safety
    // downgrade remains).
    expect(result.gatedAnswer).not.toContain(
      "Consider importing or restoring insurancePatients data if expected but currently empty."
    );
    expect(result.gatedAnswer).not.toContain("if expected but currently empty.");
    // Exactly one consistent negative-safety sentence is emitted (no duplicate
    // generic gate warning). The downgrade intentionally names the action verb
    // (e.g. "Re-importing is not recommended yet"), so we must NOT assert that
    // the substring "import"/"restoring" is absent — that would be misleading.
    expect(result.gatedAnswer).toContain(
      "is not recommended yet because the underlying defect has not been verified."
    );
    expect(result.gatedAnswer).toContain(
      "Audit the source data and verify the defect before proceeding with remediation."
    );
    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(
      1
    );
  });

  it("allows restore when VERIFIED audit_logs evidence is present", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 5000, undefined, [
          { kind: "audit_logs", reference: "audit: insurancePatients deletion" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Restore the insurancePatients records.");
  });

  it("blocks re-import when VERIFIED evidence is audit_logs (wrong action binding)", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 5000, undefined, [
          { kind: "audit_logs", reference: "audit: insurancePatients deletion" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("import_metadata");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("blocks schema migration when VERIFIED evidence is audit_logs (wrong action binding)", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Migrate the insurancePatients schema.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 5000, undefined, [
          { kind: "audit_logs", reference: "audit: insurancePatients deletion" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("schema_migration");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("schema_inspection");
    expect(result.gatedAnswer).toContain("Migrating the schema is not recommended yet");
  });

  it("blocks restore when VERIFIED evidence is import_metadata (wrong action binding)", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 5000, undefined, [
          { kind: "import_metadata", reference: "job-1 destinationSummary" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("audit_logs");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).not.toContain("Restore the insurancePatients records.");
  });

  it("blocks restore when VERIFIED missing-field summary lacks audit_logs evidence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 100, { insuranceName: 4 }, [
          { kind: "aggregate_count", reference: "insurancePatients.count()=100" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("audit_logs");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("blocks restore when the only VERIFIED defect is a value-join/linkage defect", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore the rentals patient linkage.",
      summaries: [],
      joins: [makeValueJoin()],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("audit_logs");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("allows re-import when VERIFIED import_metadata evidence is present", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Re-import the insurancePatients records.",
      summaries: [
        makeSummary("insurancePatients", "VERIFIED", 5000, undefined, [
          { kind: "import_metadata", reference: "job-1 destinationSummary" },
        ]),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("re_import");
    expect(result.recommendations[0].allowed).toBe(true);
    expect(result.gatedAnswer).toContain("Re-import the insurancePatients records.");
  });

  // ==========================================================================
  // IDEMPOTENCY / DEDUPLICATION / NEGATIVE-LANGUAGE RECOGNITION
  // ==========================================================================

  it("emits exactly one downgrade for one unsafe restore sentence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore insurancePatients.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(1);
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).not.toContain("Restore insurancePatients.");
  });

  it("emits exactly one downgrade for three unsafe restore sentences on the same domain", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Restore insurancePatients. We should restore insurancePatients again. Restore insurancePatients now.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(1);
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("emits at most one downgrade per distinct action for restore + re-import same domain", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore insurancePatients. Re-import the insurancePatients data.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    const downgrades = (result.gatedAnswer.match(/is not recommended yet/g) ?? []);
    expect(downgrades.length).toBeLessThanOrEqual(2);
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).toContain("Re-importing is not recommended yet");
  });

  it("does not re-downgrade already-negative safety language", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Restoring is not recommended yet because the underlying defect has not been verified.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe(
      "Restoring is not recommended yet because the underlying defect has not been verified."
    );
  });

  it("does not re-downgrade do-not-restore safety language", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Do not restore the records until the defect is verified.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Do not restore the records until the defect is verified.");
  });

  it("passes evidence sentences mentioning restore/import without a downgrade", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "The restore operation was logged in the audit trail and the import job failed to produce records.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe(
      "The restore operation was logged in the audit trail and the import job failed to produce records."
    );
  });

  it("is idempotent: running applyRecommendationGate twice produces identical text", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Restore insurancePatients. Re-import the insurancePatients data. Restoring is not recommended yet because the underlying defect has not been verified.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const first = applyRecommendationGate(input);
    const second = applyRecommendationGate({
      ...input,
      answer: first.gatedAnswer,
    });

    expect(second.gatedAnswer).toBe(first.gatedAnswer);
  });

  it("removes the affirmative original sentence", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore insurancePatients immediately.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.gatedAnswer).not.toContain("Restore insurancePatients immediately.");
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("keeps recommendation metadata accurate even when display text is emitted once", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Restore insurancePatients. Restore insurancePatients now. Restore insurancePatients again.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(1);
    expect(result.recommendations.length).toBe(3);
    result.recommendations.forEach((rec) => {
      expect(rec.action).toBe("restore");
      expect(rec.allowed).toBe(false);
    });
  });

  it("does not dedupe unrelated actions globally", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore insurancePatients. Migrate the schema to version 2.",
      summaries: [
        makeSummary("insurancePatients", "UNKNOWN"),
        makeSummary("schemaMigration", "UNKNOWN"),
      ],
    };

    const result = applyRecommendationGate(input);

    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).toContain("Migrating the schema is not recommended yet");
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
  });


  // =========================================================================
  // DIAGNOSTIC-MENTION REGRESSION: high-impact verbs used as the SUBJECT of
  // diagnostic work (audit/query/verify/inspect/review/monitor/search) must NOT
  // be treated as remediation proposals, but TRUE affirmative instructions
  // ("Audit the records and then restore them") still are.
  // =========================================================================

  it("leaves 'audit logs for restore events' unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Audit logs for restore events.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Audit logs for restore events.");
  });

  it("leaves 'query import/restore history' unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Query import/restore history.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Query import/restore history.");
  });

  it("leaves 'verify whether restore occurred' unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Verify whether restore occurred.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Verify whether restore occurred.");
  });

  it("leaves 'investigate failed imports' unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Investigate failed imports.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe("Investigate failed imports.");
  });

  it("leaves the live audit-log sentence unchanged", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Run a targeted audit log query for insurancePatients import or restore events to confirm whether a restore was performed.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(0);
    expect(result.gatedAnswer).toBe(
      "Run a targeted audit log query for insurancePatients import or restore events to confirm whether a restore was performed."
    );
  });

  it("gates 'Audit the records and then restore them'", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Audit the records and then restore them.",
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
    expect(result.gatedAnswer).not.toContain("restore them");
  });

  it("still gates a direct affirmative restore", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer: "Restore insurancePatients.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("existing negative restore warning + diagnostic restore mention => one warning total", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Restoring is not recommended yet because the underlying defect has not been verified. Audit logs for restore events.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(
      1
    );
    expect(result.gatedAnswer).toContain("Audit logs for restore events.");
  });

  it("applying the gate twice remains identical", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Run a targeted audit log query for insurancePatients import or restore events. Restore insurancePatients.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const first = applyRecommendationGate(input);
    const second = applyRecommendationGate({
      ...input,
      answer: first.gatedAnswer,
    });

    expect(second.gatedAnswer).toBe(first.gatedAnswer);
  });

  it("metadata stays accurate when a diagnostic mention coexists with a gate", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Run a targeted audit log query for insurancePatients import or restore events. Restore insurancePatients.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
    expect(result.gatedAnswer).toContain(
      "Run a targeted audit log query for insurancePatients import or restore events."
    );
    expect(result.gatedAnswer).toContain("Restoring is not recommended yet");
  });

  it("live response: diagnostic sentence + existing negative warning + direct restore emits exactly one downgrade", () => {
    const input: RecommendationGateInput = {
      ...baseInput,
      answer:
        "Run a targeted audit log query for insurancePatients import or restore events to confirm whether a restore was performed. " +
        "Restoring is not recommended yet because the underlying defect has not been verified. " +
        "Restore insurancePatients.",
      summaries: [makeSummary("insurancePatients", "UNKNOWN")],
    };

    const result = applyRecommendationGate(input);

    expect(result.gatedAnswer).toContain(
      "Run a targeted audit log query for insurancePatients import or restore events to confirm whether a restore was performed."
    );
    expect((result.gatedAnswer.match(/is not recommended yet/g) ?? []).length).toBe(
      1
    );
    expect(result.gatedAnswer).not.toContain("Restore insurancePatients.");
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].action).toBe("restore");
    expect(result.recommendations[0].allowed).toBe(false);
    expect(result.recommendations[0].reason).toContain("UNKNOWN");
  });

});
