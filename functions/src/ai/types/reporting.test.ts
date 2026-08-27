/**
 * Deterministic unit tests for the Jarvis reporting contract.
 *
 * Covers every fixture category required by the reporting-accuracy audit:
 *   1. 1000-record query cap labeling
 *   2. true counts > 1000 (aggregate)
 *   3. partial schemas
 *   4. missing linkage fields
 *   5. successful joins
 *   6. failed joins
 *   7. duplicate/ambiguous joins
 *   8. contradictory counts
 *   9. unsupported inference / claim strength
 *   10. PHI redaction (Sentinel behavior preserved)
 *
 * Pure logic + pattern scanning only. No Firebase network access.
 */

import { describe, expect, it } from "vitest";

import {
  canRecommendAction,
  countFromAggregate,
  countFromLimitedQuery,
  evaluateClaimLanguage,
  findCountContradictions,
  notTestedJoin,
  normalizeKeyValue,
  summarizeSample,
  verifyJoin,
} from "./reporting";
import { redactPhi, scanTextForPhi } from "../phiSafety";

const CAP = 1000;

// ---------------------------------------------------------------------------
// 1 + 2. Sample vs actual
// ---------------------------------------------------------------------------

describe("sample vs actual count", () => {
  it("labels a capped 1000-doc limited query as sampled with unknown actual", () => {
    const docs = Array.from({ length: CAP }, (_, i) => ({ id: `d${i}` }));
    const summary = summarizeSample("patients", docs, CAP);

    expect(summary.count.sampledCount).toBe(1000);
    expect(summary.count.actualCount).toBeNull();
    expect(summary.count.method).toBe("limited_query");
    expect(summary.classification).toBe("UNKNOWN");
    expect(summary.evidence.some((e) => e.kind === "aggregate_count")).toBe(
      false
    );
  });

  it("reports an aggregate count when a true count() was executed (>1000)", () => {
    const docs = Array.from({ length: CAP }, (_, i) => ({ id: `d${i}` }));
    const summary = summarizeSample("patients", docs, CAP, {
      aggregateCount: 96234,
    });

    expect(summary.count.actualCount).toBe(96234);
    expect(summary.count.sampledCount).toBe(1000);
    expect(summary.count.method).toBe("aggregate_count");
    expect(summary.count.limit).toBeNull();
    expect(summary.classification).toBe("VERIFIED");
    expect(summary.evidence[0].kind).toBe("aggregate_count");
  });

  it("never fabricates actualCount from countFromLimitedQuery", () => {
    const report = countFromLimitedQuery(1000, 1000);
    expect(report.actualCount).toBeNull();
    expect(report.limit).toBe(1000);
  });

  it("countFromAggregate keeps sample size distinct from actual size", () => {
    const report = countFromAggregate(5000, 1000);
    expect(report.actualCount).toBe(5000);
    expect(report.sampledCount).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// 3. Partial schemas
// ---------------------------------------------------------------------------

describe("partial schema discovery", () => {
  it("counts missing required fields without inventing values", () => {
    const docs = [
      { patientName: "A", dob: "1980-01-01", phone: "" },
      { patientName: "B" },
      { patientName: "C", dob: null, phone: "555-123-4567" },
    ];
    const summary = summarizeSample(
      "patients",
      docs,
      10,
      { requiredFields: ["patientName", "dob", "phone"] }
    );

    expect(summary.missingKeyCounts.dob).toBe(2);
    expect(summary.missingKeyCounts.phone).toBe(2); // "" and absent count; valid value does not
    expect(summary.missingKeyCounts.patientName).toBeUndefined();
  });

  it("marks schemaCompleteness=partial when documents lack observed fields", () => {
    const docs = [{ a: 1 }, { a: 1, b: 2 }];
    const summary = summarizeSample("orders", docs, 10);
    expect(summary.schemaCompleteness).toBe("partial");
  });

  it("marks schemaCompleteness=partial when sample < aggregate", () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({ a: i }));
    const summary = summarizeSample("orders", docs, 100, {
      aggregateCount: 900,
    });
    expect(summary.schemaCompleteness).toBe("partial");
  });
});

// ---------------------------------------------------------------------------
// 4-7. Join verification
// ---------------------------------------------------------------------------

describe("join verification", () => {
  const left = {
    collection: "patients",
    field: "patientName",
    values: ["Alice Smith", "Bob Jones", "Carol White"],
  };
  const right = {
    collection: "orders",
    field: "patientName",
    values: ["alice smith", "BOB  JONES", "Dan Brown"],
  };

  it("matches normalized keys and reports unmatched on both sides", () => {
    const result = verifyJoin(left, right);

    expect(result.recordsTestedLeft).toBe(3);
    expect(result.recordsTestedRight).toBe(3);
    expect(result.exactMatches).toBe(2);
    expect(result.unmatchedLeft).toBe(1); // Carol White
    expect(result.unmatchedRight).toBe(1); // Dan Brown
    expect(result.normalizeRule).toContain("lowercase");
    // Matches exist but sides have unmatched rows -> INFERRED, never VERIFIED
    expect(result.classification).toBe("INFERRED");
  });

  it("classifies a fully clean join as VERIFIED", () => {
    const result = verifyJoin(
      { ...left, values: ["Alice Smith", "Bob Jones"] },
      { ...right, values: ["alice smith", "bob jones"] }
    );
    expect(result.exactMatches).toBe(2);
    expect(result.unmatchedLeft).toBe(0);
    expect(result.unmatchedRight).toBe(0);
    expect(result.classification).toBe("VERIFIED");
  });

  it("reports failed joins with zero matches as UNKNOWN, not confirmed", () => {
    const result = verifyJoin(
      left,
      { ...right, values: ["Xavier X", "Yolanda Y"] }
    );
    expect(result.exactMatches).toBe(0);
    expect(result.unmatchedLeft).toBe(3);
    expect(result.classification).toBe("UNKNOWN");
  });

  it("flags ambiguous/duplicate right-side matches", () => {
    const result = verifyJoin(
      { ...left, values: ["Alice Smith"] },
      { ...right, values: ["alice smith", "Alice Smith"] }
    );
    expect(result.exactMatches).toBe(1);
    expect(result.ambiguousMatches).toBe(1);
    expect(result.duplicateRightKeys).toBe(1);
    expect(result.classification).toBe("INFERRED"); // dupes block VERIFIED
  });

  it("counts missing linkage fields separately from unmatched", () => {
    const result = verifyJoin(
      { ...left, values: ["Alice Smith", null, ""] },
      { ...right, values: [undefined, "alice smith"] }
    );
    expect(result.missingKeysLeft).toBe(2);
    expect(result.missingKeysRight).toBe(1);
    expect(result.exactMatches).toBe(1);
    expect(result.classification).toBe("INFERRED"); // missing keys block VERIFIED
  });

  it("normalizes case, trim, and internal whitespace identically", () => {
    expect(normalizeKeyValue("  ALICE   smith ")).toBe("alice smith");
    expect(normalizeKeyValue("alice smith")).toBe(
      normalizeKeyValue("ALICE\tSMITH")
    );
  });

  it("untested joins are NOT_TESTED with zero evidence", () => {
    const result = notTestedJoin("patients", "orders", "patientName", "name");
    expect(result.classification).toBe("NOT_TESTED");
    expect(result.recordsTestedLeft).toBe(0);
    expect(result.evidence).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Contradictory counts
// ---------------------------------------------------------------------------

describe("internal consistency", () => {
  it("detects PRESENT 962 vs MISSING 962 style contradictions", () => {
    const contradictions = findCountContradictions([
      { entity: "wipRecords", value: 962, section: "landingAudit:PRESENT" },
      { entity: "WipRecords ", value: 0, section: "handoff:MISSING" },
    ]);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].entity).toBe("wiprecords");
    expect(contradictions[0].values).toEqual([962, 0]);
  });

  it("passes consistent claims", () => {
    const contradictions = findCountContradictions([
      { entity: "orders", value: 42, section: "summary" },
      { entity: "orders", value: 42, section: "csv" },
    ]);
    expect(contradictions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Claim strength + recommendation gating
// ---------------------------------------------------------------------------

describe("conclusion strength", () => {
  it("rejects confirmed/proven regardless of evidence source", () => {
    const result = evaluateClaimLanguage("The join is confirmed and proven.", {
      hasAggregateEvidence: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining(["confirmed", "proven"]));
    expect(result.suggestions).toEqual(
      expect.arrayContaining(["suggests", "likely", "sample indicates"])
    );
  });

  it("rejects actual/complete wording without aggregate evidence", () => {
    const result = evaluateClaimLanguage(
      "actual count is 962, complete analysis",
      { hasAggregateEvidence: false }
    );
    expect(result.allowed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining(["actual", "complete"])
    );
  });

  it("permits actual/complete only with aggregate-grade evidence", () => {
    const result = evaluateClaimLanguage("Actual count is 962.", {
      hasAggregateEvidence: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("accepts hedged language always", () => {
    const result = evaluateClaimLanguage(
      "The sample suggests a likely gap.",
      { hasAggregateEvidence: false }
    );
    expect(result.allowed).toBe(true);
  });
});

describe("recommendation gating", () => {
  it("blocks re-import advice for INFERRED defects", () => {
    const decision = canRecommendAction("re_import", {
      summary: "rows missing",
      classification: "INFERRED",
      evidence: [{ kind: "import_metadata", reference: "job-1" }],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("INFERRED");
  });

  it("allows re-import advice for VERIFIED defects with import evidence", () => {
    const decision = canRecommendAction("re_import", {
      summary: "written=0 while totalRows=962",
      classification: "VERIFIED",
      evidence: [
        { kind: "import_metadata", reference: "job-1 destinationSummary" },
        { kind: "aggregate_count", reference: "orders.count()=962" },
      ],
    });
    expect(decision.allowed).toBe(true);
  });

  it("blocks VERIFIED defects lacking the required evidence kind", () => {
    const decision = canRecommendAction("restore", {
      summary: "bad data",
      classification: "VERIFIED",
      evidence: [{ kind: "sampled_documents", reference: "x" }],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("audit_logs");
  });
});

// ---------------------------------------------------------------------------
// 10. PHI redaction (Sentinel regression guards)
// ---------------------------------------------------------------------------

describe("PHI Sentinel", () => {
  it("redacts SSN, DOB, phone, email, insurance, MRN patterns", () => {
    const text =
      "SSN 123-45-6789 DOB: 01/02/1980 call (555) 123-4567 email a@b.com Policy #ABC123XYZ9 MRN A-1234";
    const findings = scanTextForPhi(text, "test");

    const types = findings.map((f) => f.type);
    expect(types).toContain("SSN");
    expect(types).toContain("DOB");
    expect(types).toContain("Phone Number");
    expect(types).toContain("Email Address");
    expect(types).toContain("Insurance Identifier");
    expect(types).toContain("Medical Record Identifier");

    const redacted = redactPhi(text);
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).not.toContain("a@b.com");
    expect(redacted).not.toContain("ABC123XYZ9");
    expect(redacted).toContain("***REDACTED_PHI***");
  });

  it("returns no findings for clean operational text", () => {
    expect(scanTextForPhi("Inventory low: sku W-123 qty 4", "note")).toEqual(
      []
    );
  });

  it("keeps finding previews partially redacted", () => {
    const findings = scanTextForPhi("SSN 123-45-6789", "preview");
    expect(findings[0].preview).toMatch(/\*\*\*REDACTED\*\*\*/);
    expect(findings[0].severity).toBe("critical");
  });
});