/**
 * Deterministic unit tests for the Jarvis recommendation gate.
 *
 * Proves that high-impact remediation recommendations are blocked when the
 * underlying defect is not VERIFIED with sufficient evidence, while diagnostic
 * recommendations and ordinary prose pass through unchanged.
 */

import { describe, expect, it } from "vitest";

import {
  applyRecommendationGate,
  type RecommendationGateInput,
} from "./recommendationGate";
import {
  countFromAggregate,
  countFromLimitedQuery,
  type CollectionSampleSummary,
  type Evidence,
} from "../types/reporting";

function makeSummary(
  collection: string,
  classification: "VERIFIED" | "INFERRED" | "UNKNOWN" | "NOT_TESTED",
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
        makeSummary("orders", "VERIFIED", 100, undefined, [
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
      summaries: [makeSummary("orders", "VERIFIED", 100)],
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
});
