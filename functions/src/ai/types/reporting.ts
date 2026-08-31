/**
 * Jarvis Reporting Contract
 *
 * Mechanical enforcement of reporting accuracy requirements identified in the
 * Jarvis reporting-accuracy audit (branch ai-development):
 *
 *  1. SAMPLE VS ACTUAL  — a limited query may never be labeled an actual count.
 *     actualCount stays null unless a true Firestore aggregate count ran.
 *  2. CLASSIFICATION    — every conclusion carries VERIFIED / INFERRED /
 *     UNKNOWN / NOT_TESTED.
 *  3. JOIN VERIFICATION — cross-collection joins compare normalized key values
 *     and report tested / matched / unmatched / missing / ambiguous counts.
 *  4. CONSISTENCY       — contradictory count claims are detectable.
 *  5. EVIDENCE          — conclusions carry machine-checkable evidence refs.
 *  6. CLAIM STRENGTH    — absolute language requires aggregate-grade evidence.
 *  7. RECOMMENDATION GATING — high-impact actions require a VERIFIED defect.
 *
 * Pure logic only: no Firebase imports, fully unit-testable.
 */

export type EvidenceKind =
  | "aggregate_count"
  | "sampled_documents"
  | "schema_inspection"
  | "audit_logs"
  | "code_inspection"
  | "import_metadata"
  | "value_join";

export type Classification =
  | "VERIFIED"
  | "SAMPLED"
  | "INFERRED"
  | "UNKNOWN"
  | "NOT_TESTED";

export interface Evidence {
  kind: EvidenceKind;
  /** Provenance string, e.g. "patients.count() aggregate @2025-01-01". */
  reference: string;
}

// ---------------------------------------------------------------------------
// 1. Counts
// ---------------------------------------------------------------------------

export type CountMethod = "aggregate_count" | "limited_query";

export interface CountReport {
  /** Documents actually retrieved/observed by the query. */
  sampledCount: number;
  /** True collection size; null unless a Firestore aggregate count ran. */
  actualCount: number | null;
  method: CountMethod;
  /** Query limit applied, or null for aggregates. */
  limit: number | null;
}

function clampInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function countFromAggregate(
  actualCount: number,
  sampledCount?: number
): CountReport {
  const actual = clampInt(actualCount);
  return {
    sampledCount:
      typeof sampledCount === "number" ? clampInt(sampledCount) : actual,
    actualCount: actual,
    method: "aggregate_count",
    limit: null,
  };
}

export function countFromLimitedQuery(
  sampledCount: number,
  limit: number
): CountReport {
  return {
    sampledCount: clampInt(sampledCount),
    actualCount: null,
    method: "limited_query",
    limit: clampInt(limit),
  };
}

export function isCompleteCount(report: CountReport): boolean {
  return report.method === "aggregate_count" && report.actualCount !== null;
}

// ---------------------------------------------------------------------------
// Sample summaries (schema discovery + per-collection counts)
// ---------------------------------------------------------------------------

export interface SampleSummaryOptions {
  /** Fields every document in this collection is expected to carry. */
  requiredFields?: string[];
  /** Result of a true aggregate count, when one was executed. */
  aggregateCount?: number | null;
}

export interface CollectionSampleSummary {
  collection: string;
  count: CountReport;
  statusCounts: Record<string, number>;
  missingKeyCounts: Record<string, number>;
  fieldsObserved: string[];
  schemaCompleteness: "full" | "partial";
  classification: Classification;
  evidence: Evidence[];
}

/** Mirrors askAdminAi.getStatusValue so summaries stay consistent. */
export function getStatusValue(data: Record<string, unknown>): string {
  const value =
    data.status ||
    data.hospiceStatus ||
    data.patientStatus ||
    data.lifecycleStatus ||
    data.importStatus ||
    data.parseStatus ||
    "unknown";
  return String(value || "unknown").toLowerCase().trim() || "unknown";
}

export function summarizeSample(
  collectionName: string,
  docs: Array<Record<string, unknown>>,
  limit: number,
  options: SampleSummaryOptions = {}
): CollectionSampleSummary {
  const statusCounts: Record<string, number> = {};
  const missingKeyCounts: Record<string, number> = {};
  const fieldSet = new Set<string>();

  for (const doc of docs) {
    const status = getStatusValue(doc);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    for (const key of Object.keys(doc)) fieldSet.add(key);

    for (const field of options.requiredFields ?? []) {
      const value = doc[field];
      if (value === null || value === undefined || value === "") {
        missingKeyCounts[field] = (missingKeyCounts[field] ?? 0) + 1;
      }
    }
  }

  const fieldsObserved = Array.from(fieldSet).sort();
  const aggregate = options.aggregateCount ?? null;
  const docsMissingSomeObservedField =
    docs.length > 0 &&
    docs.some((doc) => fieldsObserved.some((field) => !(field in doc)));
  const sampleBelowActual = aggregate !== null && docs.length < aggregate;

  const evidence: Evidence[] = [
    {
      kind: "sampled_documents",
      reference: `${collectionName}: limit(${limit}) returned ${docs.length} doc(s)`,
    },
  ];
  if (aggregate !== null) {
    evidence.unshift({
      kind: "aggregate_count",
      reference: `${collectionName}.count() aggregate = ${aggregate}`,
    });
  }

  return {
    collection: collectionName,
    count:
      aggregate !== null
        ? countFromAggregate(aggregate, docs.length)
        : countFromLimitedQuery(docs.length, limit),
    statusCounts,
    missingKeyCounts,
    fieldsObserved,
    schemaCompleteness:
      docs.length === 0 || docsMissingSomeObservedField || sampleBelowActual
        ? "partial"
        : "full",
    classification: aggregate !== null ? "VERIFIED" : "UNKNOWN",
    evidence,
  };
}

// ---------------------------------------------------------------------------
// 3. Join verification
// ---------------------------------------------------------------------------

export interface JoinPair {
  leftCollection: string;
  leftField: string;
  rightCollection: string;
  rightField: string;
}

export const KEY_NORMALIZE_RULE = "trim";

export function normalizeKeyValue(value: unknown): string {
  return String(value ?? "").trim();
}

export interface JoinSide {
  collection: string;
  field: string;
  /** Raw key values; null/undefined/"" count as missing keys. */
  values: Array<string | number | null | undefined>;
}

export interface JoinVerification {
  leftCollection: string;
  rightCollection: string;
  leftField: string;
  rightField: string;
  normalizeRule: string;
  recordsTestedLeft: number;
  recordsTestedRight: number;
  missingKeysLeft: number;
  missingKeysRight: number;
  duplicateLeftKeys: number;
  duplicateRightKeys: number;
  /** Left rows with at least one right-side match. */
  exactMatches: number;
  /** Left rows whose right-side key frequency is greater than 1. */
  ambiguousMatches: number;
  unmatchedLeft: number;
  unmatchedRight: number;
  classification: Classification;
  evidence: Evidence[];
}

export type JoinCountMethod = "aggregate_count" | "limited_query" | "unavailable";
export type JoinScanMethod =
  | "complete_value_scan"
  | "limited_value_scan"
  | "exact_target_key_lookup";
export type JoinOutcome = "CLEAN" | "DEFECTS_FOUND" | "AMBIGUOUS" | "UNKNOWN";
export type TargetLookupMethod =
  | "none"
  | "document_id"
  | "field_equality";

export interface TargetKeyVerificationInput {
  complete: boolean;
  method: TargetLookupMethod;
  matchCountsBySourceKey: Map<string, number>;
  recordsRead: number;
  queryOperations: number;
  duplicateKeysStructurallyImpossible: boolean;
}

export interface ValueJoinVerification {
  sourceCollection: string;
  targetCollection: string;
  sourceKey: string;
  targetKey: string;
  sourceActualCount: number | null;
  targetActualCount: number | null;
  sourceCountMethod: JoinCountMethod;
  targetCountMethod: JoinCountMethod;
  sourceTestedCount: number;
  targetTestedCount: number;
  sourceRecordsWithKey: number;
  sourceMissingKeyCount: number;
  targetRecordsWithKey: number;
  targetMissingKeyCount: number;
  uniqueTargetKeys: number;
  duplicateTargetKeys: number;
  targetDuplicateKeyCount: number;
  ambiguityCount: number;
  exactUniqueMatches: number;
  ambiguousMatches: number;
  unmatched: number;
  notObservedInTargetSample: number;
  unresolvedAgainstIncompleteTarget: number;
  sourceScanComplete: boolean;
  targetVerificationComplete: boolean;
  coveragePercentage: number;
  sampleStatus: "complete" | "sampled" | "not_tested";
  joinMethod: JoinScanMethod;
  joinComplete: boolean;
  targetLookupMethod: TargetLookupMethod;
  targetUniqueKeysChecked: number;
  targetVerificationRecordsRead: number;
  targetVerificationQueryOperations: number;
  targetDuplicateKeysStructurallyImpossible: boolean;
  outcome: JoinOutcome;
  normalization: typeof KEY_NORMALIZE_RULE;
  classification: Classification;
  evidenceRef: string;
  evidence: Evidence[];
  leftCollection: string;
  rightCollection: string;
  leftField: string;
  rightField: string;
  normalizeRule: string;
  recordsTestedLeft: number;
  recordsTestedRight: number;
  missingKeysLeft: number;
  missingKeysRight: number;
  duplicateRightKeys: number;
  exactMatches: number;
  unmatchedLeft: number;
  unmatchedRight: number;
}

function isMissingKey(value: string | number | null | undefined): boolean {
  return (
    value === null || value === undefined || String(value).trim() === ""
  );
}

export function verifyJoin(
  left: JoinSide,
  right: JoinSide,
  evidence: Evidence[] = []
): JoinVerification {
  const rightFreq = new Map<string, number>();
  let missingKeysRight = 0;

  for (const value of right.values) {
    if (isMissingKey(value)) {
      missingKeysRight += 1;
      continue;
    }
    const key = normalizeKeyValue(value);
    rightFreq.set(key, (rightFreq.get(key) ?? 0) + 1);
  }

  const matchedRight = new Map<string, number>();
  const leftFreq = new Map<string, number>();
  let missingKeysLeft = 0;
  let exactMatches = 0;
  let ambiguousMatches = 0;
  let unmatchedLeft = 0;

  for (const value of left.values) {
    if (isMissingKey(value)) {
      missingKeysLeft += 1;
      continue;
    }
    const key = normalizeKeyValue(value);
    leftFreq.set(key, (leftFreq.get(key) ?? 0) + 1);

    const freq = rightFreq.get(key);
    if (!freq) {
      unmatchedLeft += 1;
      continue;
    }
    exactMatches += 1;
    matchedRight.set(key, (matchedRight.get(key) ?? 0) + 1);
    if (freq > 1) ambiguousMatches += 1;
  }

  let unmatchedRight = 0;
  for (const [key, freq] of rightFreq) {
    if (!matchedRight.has(key)) unmatchedRight += freq;
  }

  const duplicateLeftKeys = Array.from(leftFreq.values()).filter(
    (n) => n > 1
  ).length;
  const duplicateRightKeys = Array.from(rightFreq.values()).filter(
    (n) => n > 1
  ).length;

  const testedNonMissingLeft = left.values.length - missingKeysLeft;

  let classification: Classification;
  if (testedNonMissingLeft === 0 || rightFreq.size === 0) {
    classification = "UNKNOWN";
  } else if (
    unmatchedLeft === 0 &&
    unmatchedRight === 0 &&
    ambiguousMatches === 0 &&
    missingKeysLeft === 0 &&
    missingKeysRight === 0 &&
    duplicateLeftKeys === 0 &&
    duplicateRightKeys === 0
  ) {
    classification = "VERIFIED";
  } else if (exactMatches > 0) {
    classification = "INFERRED";
  } else {
    classification = "UNKNOWN";
  }

  return {
    leftCollection: left.collection,
    rightCollection: right.collection,
    leftField: left.field,
    rightField: right.field,
    normalizeRule: KEY_NORMALIZE_RULE,
    recordsTestedLeft: left.values.length,
    recordsTestedRight: right.values.length,
    missingKeysLeft,
    missingKeysRight,
    duplicateLeftKeys,
    duplicateRightKeys,
    exactMatches,
    ambiguousMatches,
    unmatchedLeft,
    unmatchedRight,
    classification,
    evidence: [
      ...evidence,
      {
        kind: "sampled_documents",
        reference: `join ${left.collection}.${left.field} -> ${right.collection}.${right.field}: tested L=${left.values.length}/R=${right.values.length}`,
      },
    ],
  };
}

export function notTestedJoin(
  leftCollection: string,
  rightCollection: string,
  leftField: string,
  rightField: string
): JoinVerification {
  return {
    leftCollection,
    rightCollection,
    leftField,
    rightField,
    normalizeRule: KEY_NORMALIZE_RULE,
    recordsTestedLeft: 0,
    recordsTestedRight: 0,
    missingKeysLeft: 0,
    missingKeysRight: 0,
    duplicateLeftKeys: 0,
    duplicateRightKeys: 0,
    exactMatches: 0,
    ambiguousMatches: 0,
    unmatchedLeft: 0,
    unmatchedRight: 0,
    classification: "NOT_TESTED",
    evidence: [],
  };
}

export interface ValueJoinSideInput {
  collection: string;
  key: string;
  values: unknown[];
  actualCount: number | null;
  countMethod: JoinCountMethod;
  complete: boolean;
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

export function verifyValueJoin(
  source: ValueJoinSideInput,
  target: ValueJoinSideInput,
  targetVerification?: TargetKeyVerificationInput
): ValueJoinVerification {
  const targetFreq = new Map<string, number>();
  let targetMissingKeyCount = 0;
  let targetRecordsWithKey = 0;

  for (const value of target.values) {
    if (isMissingKey(value as string | number | null | undefined)) {
      targetMissingKeyCount += 1;
      continue;
    }
    targetRecordsWithKey += 1;
    const key = normalizeKeyValue(value);
    targetFreq.set(key, (targetFreq.get(key) ?? 0) + 1);
  }

  let sourceMissingKeyCount = 0;
  let sourceRecordsWithKey = 0;
  let exactUniqueMatches = 0;
  let ambiguousMatches = 0;
  let unmatched = 0;
  let notObservedInTargetSample = 0;
  let unresolvedAgainstIncompleteTarget = 0;

  for (const value of source.values) {
    if (isMissingKey(value as string | number | null | undefined)) {
      sourceMissingKeyCount += 1;
      continue;
    }
    sourceRecordsWithKey += 1;
    const normalized = normalizeKeyValue(value);
    const exactTargetMatches =
      targetVerification?.matchCountsBySourceKey.get(normalized);
    const targetMatches = exactTargetMatches ?? targetFreq.get(normalized) ?? 0;
    if (targetMatches === 1) {
      exactUniqueMatches += 1;
    } else if (targetMatches > 1) {
      ambiguousMatches += 1;
    } else if (targetVerification?.complete || target.complete) {
      unmatched += 1;
    } else {
      notObservedInTargetSample += 1;
      unresolvedAgainstIncompleteTarget += 1;
    }
  }

  const verifiedDuplicateCounts = targetVerification
    ? Array.from(targetVerification.matchCountsBySourceKey.values()).filter(
        (count) => count > 1
      )
    : [];
  const duplicateTargetKeys = targetVerification
    ? verifiedDuplicateCounts.length
    : Array.from(targetFreq.values()).filter((count) => count > 1).length;
  const targetDuplicateKeyCount = targetVerification
    ? verifiedDuplicateCounts.reduce((sum, count) => sum + count, 0)
    : Array.from(targetFreq.values()).reduce(
      (sum, count) => sum + (count > 1 ? count : 0),
    0
    );
  const sourceScanComplete = source.complete;
  const targetVerificationComplete =
    targetVerification?.complete ?? target.complete;
  const joinComplete = sourceScanComplete && targetVerificationComplete;
  const targetTestedCount = targetVerification
    ? targetVerification.matchCountsBySourceKey.size
    : target.values.length;
  const sampleStatus =
    source.values.length === 0 && targetTestedCount === 0
      ? "not_tested"
      : joinComplete
        ? "complete"
        : "sampled";
  const joinMethod: JoinScanMethod = targetVerification
    ? "exact_target_key_lookup"
    : joinComplete
      ? "complete_value_scan"
      : "limited_value_scan";
  let outcome: JoinOutcome;
  if (sampleStatus === "not_tested") {
    outcome = "UNKNOWN";
  } else if (ambiguousMatches > 0 || duplicateTargetKeys > 0) {
    outcome = "AMBIGUOUS";
  } else if (!joinComplete) {
    outcome = "UNKNOWN";
  } else if (
    sourceMissingKeyCount > 0 ||
    targetMissingKeyCount > 0 ||
    unmatched > 0
  ) {
    outcome = "DEFECTS_FOUND";
  } else if (
    sourceRecordsWithKey > 0 &&
    exactUniqueMatches === sourceRecordsWithKey
  ) {
    outcome = "CLEAN";
  } else {
    outcome = "UNKNOWN";
  }

  let classification: Classification;
  if (sampleStatus === "not_tested") {
    classification = "NOT_TESTED";
  } else if (!joinComplete) {
    classification = "SAMPLED";
  } else if (outcome !== "UNKNOWN") {
    classification = "VERIFIED";
  } else {
    classification = "UNKNOWN";
  }

  const evidenceRef = `value-join:${source.collection}.${source.key}->${target.collection}.${target.key}:${joinMethod}`;
  const evidence: Evidence[] = [
    {
      kind: "value_join",
      reference: evidenceRef,
    },
  ];

  return {
    sourceCollection: source.collection,
    targetCollection: target.collection,
    sourceKey: source.key,
    targetKey: target.key,
    sourceActualCount: source.actualCount,
    targetActualCount: target.actualCount,
    sourceCountMethod: source.countMethod,
    targetCountMethod: target.countMethod,
    sourceTestedCount: source.values.length,
    targetTestedCount,
    sourceRecordsWithKey,
    sourceMissingKeyCount,
    targetRecordsWithKey,
    targetMissingKeyCount,
    uniqueTargetKeys: targetFreq.size,
    duplicateTargetKeys,
    targetDuplicateKeyCount,
    ambiguityCount: ambiguousMatches,
    exactUniqueMatches,
    ambiguousMatches,
    unmatched,
    notObservedInTargetSample,
    unresolvedAgainstIncompleteTarget,
    sourceScanComplete,
    targetVerificationComplete,
    coveragePercentage: percent(exactUniqueMatches, sourceRecordsWithKey),
    sampleStatus,
    joinMethod,
    joinComplete,
    targetLookupMethod: targetVerification?.method ?? "none",
    targetUniqueKeysChecked: targetVerification
      ? targetVerification.matchCountsBySourceKey.size
      : 0,
    targetVerificationRecordsRead: targetVerification?.recordsRead ?? 0,
    targetVerificationQueryOperations: targetVerification?.queryOperations ?? 0,
    targetDuplicateKeysStructurallyImpossible:
      targetVerification?.duplicateKeysStructurallyImpossible ?? false,
    outcome,
    normalization: KEY_NORMALIZE_RULE,
    classification,
    evidenceRef,
    evidence,
    leftCollection: source.collection,
    rightCollection: target.collection,
    leftField: source.key,
    rightField: target.key,
    normalizeRule: KEY_NORMALIZE_RULE,
    recordsTestedLeft: source.values.length,
    recordsTestedRight: targetTestedCount,
    missingKeysLeft: sourceMissingKeyCount,
    missingKeysRight: targetMissingKeyCount,
    duplicateRightKeys: duplicateTargetKeys,
    exactMatches: exactUniqueMatches,
    unmatchedLeft: unmatched,
    unmatchedRight: 0,
  };
}

// ---------------------------------------------------------------------------
// 4. Contradiction detection
// ---------------------------------------------------------------------------

export interface CountClaim {
  /** Entity the count refers to; compared after trim/lowercase. */
  entity: string;
  value: number;
  /** Report section or source that produced the claim. */
  section: string;
}

export interface CountContradiction {
  entity: string;
  sections: [string, string];
  values: [number, number];
}

export function findCountContradictions(
  claims: CountClaim[]
): CountContradiction[] {
  const byEntity = new Map<string, CountClaim[]>();
  for (const claim of claims) {
    const key = claim.entity.trim().toLowerCase();
    const bucket = byEntity.get(key) ?? [];
    bucket.push(claim);
    byEntity.set(key, bucket);
  }

  const contradictions: CountContradiction[] = [];
  for (const [entity, bucket] of byEntity) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (bucket[i].value !== bucket[j].value) {
          contradictions.push({
            entity,
            sections: [bucket[i].section, bucket[j].section],
            values: [bucket[i].value, bucket[j].value],
          });
        }
      }
    }
  }
  return contradictions;
}

// ---------------------------------------------------------------------------
// 6. Conclusion strength (claim language)
// ---------------------------------------------------------------------------

export const SUGGESTED_HEDGES = [
  "suggests",
  "likely",
  "sample indicates",
] as const;

const STRONG_TERM_PATTERN =
  /\b(confirmed|proven|proved|conclusive|conclusively|definitive|definitively)\b/gi;
const ACTUAL_PATTERN = /\b(actual|actually)\b/gi;
const COMPLETE_PATTERN = /\b(complete|completely|entire)\b/gi;

export interface ClaimLanguageResult {
  allowed: boolean;
  violations: string[];
  suggestions: string[];
}

export function evaluateClaimLanguage(
  text: string,
  options: { hasAggregateEvidence: boolean }
): ClaimLanguageResult {
  const violations: string[] = [];

  const strong = text.match(STRONG_TERM_PATTERN) ?? [];
  const actual = text.match(ACTUAL_PATTERN) ?? [];
  const complete = text.match(COMPLETE_PATTERN) ?? [];

  if (strong.length > 0) violations.push(...strong.map((t) => t.toLowerCase()));
  if (!options.hasAggregateEvidence) {
    violations.push(...actual.map((t) => t.toLowerCase()));
    violations.push(...complete.map((t) => t.toLowerCase()));
  }

  return {
    allowed: violations.length === 0,
    violations: Array.from(new Set(violations)),
    suggestions: violations.length > 0 ? [...SUGGESTED_HEDGES] : [],
  };
}

// ---------------------------------------------------------------------------
// 7. Recommendation gating
// ---------------------------------------------------------------------------

export type HighImpactAction =
  | "schema_migration"
  | "restore"
  | "re_import"
  | "new_linkage_key"
  | "data_repair";

const REQUIRED_EVIDENCE_KINDS: Record<HighImpactAction, EvidenceKind[]> = {
  schema_migration: ["schema_inspection", "aggregate_count"],
  restore: ["audit_logs"],
  re_import: ["import_metadata"],
  new_linkage_key: ["sampled_documents"],
  data_repair: ["aggregate_count", "value_join"],
};

export interface DefectClaim {
  summary: string;
  classification: Classification;
  evidence: Evidence[];
}

export function canRecommendAction(
  action: HighImpactAction,
  defect: DefectClaim
): { allowed: boolean; reason: string } {
  if (defect.classification !== "VERIFIED") {
    return {
      allowed: false,
      reason: `Defect is classified ${defect.classification}; recommending "${action}" requires VERIFIED.`,
    };
  }
  const requiredKinds = REQUIRED_EVIDENCE_KINDS[action];
  const satisfied = requiredKinds.some((kind) =>
    defect.evidence.some((item) => item.kind === kind)
  );
  return satisfied
    ? { allowed: true, reason: "VERIFIED defect with sufficient evidence." }
    : {
        allowed: false,
        reason: `VERIFIED defect lacks required evidence kinds (${requiredKinds.join(" | ")}) for "${action}".`,
      };
}
