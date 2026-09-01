/**
 * Recommendation gate for Jarvis AI responses.
 *
 * This protects against unsafe recommendations such as "restore", "re-import",
 * "repair", "schema migration", or "new linkage key" when the underlying
 * evidence does not actually support the remediation.
 *
 * Gate rules:
 * - High-impact actions are only recommended when a VERIFIED defect has been
 *   detected AND the defect carries evidence appropriate to the proposed
 *   action (see canRecommendAction()) — a bare classification is never enough.
 * - Empty or low collection counts are NOT verified defects.
 * - SAMPLED / INFERRED / UNKNOWN evidence blocks the recommendation.
 * - When an unsafe recommendation is blocked, the offending sentence is
 *   REPLACED with a single, consistent negative-safety downgrade (the raw
 *   affirmative recommendation is not left in the response).
 * - Diagnostic verbs (investigate / audit / verify) are never blocked, unless
 *   the same sentence also proposes a high-impact action.
 * - The gate is IDEMPOTENT: multiple affirmative sentences for the SAME
 *   blocked action+domain emit ONE downgrade, and already-negative safety
 *   language ("Restoring is not recommended yet...") is never re-classified as
 *   a proposed action. Evidence sentences that merely mention restore/import
 *   in a blocked/past context are ignored.
 */

import {
  canRecommendAction,
  type CollectionSampleSummary,
  type CountContradiction,
  type DefectClaim,
  type Evidence,
  type HighImpactAction,
  type JoinVerification,
  type ValueJoinVerification,
} from "../types/reporting";

const HIGH_IMPACT_RULES: Array<{ regex: RegExp; action: HighImpactAction }> = [
  { regex: /\brestor(?:e|es|ed|ing)?\b/i, action: "restore" },
  { regex: /\b(?:re-?)?import(?:s|ed|ing)?\b/i, action: "re_import" },
  { regex: /\bdelet(?:e|es|ed|ing)\b/i, action: "data_repair" },
  { regex: /\brepair(?:s|ed|ing)?\b/i, action: "data_repair" },
  { regex: /\bmigrat(?:e|es|ed|ing|ion|ions)\b/i, action: "schema_migration" },
  { regex: /\bschema\s+chang(?:e|es|ed|ing)?\b/i, action: "schema_migration" },
  { regex: /\bnew\s+linkage\s+keys?\b/i, action: "new_linkage_key" },
  {
    regex:
      /\b(add|adding|create|creating)\s+(a\s+)?(new\s+)?linkage\s+keys?\b/i,
    action: "new_linkage_key",
  },
  { regex: /\bchange\s+linkage\b/i, action: "new_linkage_key" },
  { regex: /\bnormaliz(?:e|es|ed|ing)\b/i, action: "data_repair" },
  { regex: /\brewrit(?:e|es|ing|ten)\b/i, action: "data_repair" },
  { regex: /\bmass\s+updat(?:e|es|ed|ing)\b/i, action: "data_repair" },
  { regex: /\bbackfill(?:s|ed|ing)?\b/i, action: "data_repair" },
  { regex: /\boverwrit(?:e|es|ing|ten)\b/i, action: "data_repair" },
  { regex: /\brebuild(?:s|ed|ing)?\b/i, action: "data_repair" },
  { regex: /\bdata\s+repair\b/i, action: "data_repair" },
  { regex: /\brepair\s+data\b/i, action: "data_repair" },
];

const DIAGNOSTIC_RULES = [
  /\binvestigat(?:e|es|ed|ing)\b/i,
  /\baudit(?:s|ed|ing)?\b/i,
  /\bverif(?:y|ies|ied|ying)\b/i,
];

const ACTION_VERBS: Record<HighImpactAction, string> = {
  restore: "Restoring",
  re_import: "Re-importing",
  schema_migration: "Migrating the schema",
  new_linkage_key: "Adding linkage keys",
  data_repair: "Repairing data",
};

/**
 * Phrases that mark a sentence as already-negative safety language. These are
 * NOT affirmative recommendations and must pass through unchanged. When such a
 * phrase is present, we must not treat the sentence as a proposed high-impact
 * action and must not emit another downgrade.
 */
const NEGATIVE_LANGUAGE_PATTERNS = [
  /\bnot\s+recommended\b/i,
  /\bdo\s+not\s+(?:restore|import|re-?import|repair|migrat(?:e|ing)|delet(?:e|ing|ed|es)?|backfill(?:ing|ed)?|overwrit(?:e|ing|ten)|rebuild(?:ing|ed)?|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|add(?:ing)?)\b/i,
  /\bshould\s+not\s+(?:restore|import|re-?import|repair|migrat(?:e|ing)|delet(?:e|ing|ed|es)?|backfill(?:ing|ed)?|overwrit(?:e|ing|ten)|rebuild(?:ing|ed)?|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|add(?:ing)?)\b/i,
  /\bcannot\s+recommend\b/i,
  /\bcan'?t\s+recommend\b/i,
  /\bnot\s+authorized\b/i,
  /\bnot\s+allowed\b/i,
  /\bblocked\b/i,
  /\brecommend(?:s|ed)?\s+against\b/i,
  /\badvise\s+against\b/i,
];

/**
 * Evidence sentences merely mention restore/import/etc. in a blocked context
 * (a past operation, a report, an event log, an attempted build) rather than
 * proposing a NEW high-impact action. These must not create warnings.
 */
const EVIDENCE_MENTION_PATTERNS = [
  // "<verb> operation/job/process/attempt/log/event/record/report/summary..."
  /\b(?:restore|re-?import|repair|migrat(?:e|ing|ed|ion)|backfill(?:ing|ed)?|rebuild(?:ing|ed)?|overwrit(?:e|ing|ten)|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|import(?:ing|ed)?|delet(?:e|ing|ed|es)?)\s+(?:operation|job|process|attempt|log|event|record|report|summary|metadata|evidence|action|step|task|history|run|routine)\b/i,
  // "the <verb> was/were/is/are/has/had/have/been/appears/seems/got ..."
  /\b(?:the|a|an|this|that|some|any)\s+(?:restore|re-?import|repair|migrat(?:e|ing|ed|ion)|backfill(?:ing|ed)?|rebuild(?:ing|ed)?|overwrit(?:e|ing|ten)|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|import(?:ing|ed)?|delet(?:e|ing|ed|es)?)\s+(?:was|were|is|are|has|had|have|been|appears?|seems?|got)\b/i,
  // "<verb> of/for ..."
  /\b(?:restore|re-?import|repair|migrat(?:e|ing|ed|ion)|backfill(?:ing|ed)?|rebuild(?:ing|ed)?|overwrit(?:e|ing|ten)|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|import(?:ing|ed)?|delet(?:e|ing|ed|es)?)\s+(?:of|for)\b/i,
  // "<verb> was/were/had/has/been ..."
  /\b(?:restore|restoring|restored|import|importing|imported|re-?import(?:ing|ed)?|repair|repairing|repaired|migrat(?:e|ing|ed|ion)?|backfill(?:ing|ed)?|rebuild(?:ing|ed)?|overwrit(?:e|ing|ten)|normaliz(?:e|ing|ed)|rewrit(?:e|ing|ten)|delet(?:e|ing|ed))\s+(?:was|were|had|has|been)\b/i,
];

export interface RecommendationGateInput {
  answer: string;
  summaries: CollectionSampleSummary[];
  contradictions: CountContradiction[];
  joins: Array<JoinVerification | ValueJoinVerification>;
  evidence: Evidence[];
}

export interface GateResult {
  gatedAnswer: string;
  recommendations: Array<{
    action: HighImpactAction;
    allowed: boolean;
    reason: string;
  }>;
}

function findProposedAction(text: string): HighImpactAction | undefined {
  for (const rule of HIGH_IMPACT_RULES) {
    if (rule.regex.test(text)) return rule.action;
  }
  return undefined;
}

/** True when the sentence already uses negative/un-recommended safety language. */
function hasNegativeLanguage(text: string): boolean {
  return NEGATIVE_LANGUAGE_PATTERNS.some((pattern) => pattern.test(text));
}

/** True when the sentence merely mentions a high-impact verb as evidence. */
function isEvidenceMention(text: string): boolean {
  return EVIDENCE_MENTION_PATTERNS.some((pattern) => pattern.test(text));
}

function splitCollectionName(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function findRelevantSummary(
  text: string,
  summaries: CollectionSampleSummary[]
): CollectionSampleSummary | undefined {
  const lower = text.toLowerCase();
  let best: CollectionSampleSummary | undefined;
  let bestScore = 0;

  for (const summary of summaries) {
    const words = splitCollectionName(summary.collection);
    const score = words.reduce(
      (acc, word) => acc + (lower.includes(word) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = summary;
    }
  }

  return bestScore > 0 ? best : undefined;
}

function isValueJoin(
  join: JoinVerification | ValueJoinVerification
): join is ValueJoinVerification {
  return "sourceCollection" in join;
}

/** Only a join with an actual defect may authorize remediation. A clean join
 *  is never a defect. */
function joinHasDefect(join: ValueJoinVerification): boolean {
  return join.outcome === "DEFECTS_FOUND" || join.outcome === "AMBIGUOUS";
}

function findRelevantJoinDefect(
  action: HighImpactAction,
  joins: Array<JoinVerification | ValueJoinVerification>,
  text: string
): ValueJoinVerification | undefined {
  const lower = text.toLowerCase();
  let best: ValueJoinVerification | undefined;
  let bestScore = 0;

  for (const join of joins) {
    if (!isValueJoin(join) || !joinHasDefect(join)) continue;
    const words = [
      ...splitCollectionName(join.sourceCollection),
      ...splitCollectionName(join.targetCollection),
      ...splitCollectionName(join.sourceKey),
      ...splitCollectionName(join.targetKey),
      "join",
      "linkage",
    ];
    const score = words.reduce(
      (acc, word) => acc + (lower.includes(word) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = join;
    }
  }

  return bestScore > 0 ? best : undefined;
}

const DEFECT_STATUS_KEYS = [
  "failed",
  "error",
  "error_count",
  "invalid",
  "rejected",
];

/** A summary only constitutes verified defect evidence when it shows a real
 *  record-level defect signal: confirmed missing required fields, failed /
 *  errored statuses, or remediation-record evidence (import/join/schema/audit).
 *  An empty or low count alone (e.g. actualCount=0) is NOT a verified defect,
 *  because it does not prove records should exist. */
function summaryIndicatesDefect(summary: CollectionSampleSummary): boolean {
  const hasMissingFields = Object.values(summary.missingKeyCounts).some(
    (count) => count > 0
  );
  if (hasMissingFields) return true;

  const hasFailureStatus = Object.keys(summary.statusCounts).some((status) =>
    DEFECT_STATUS_KEYS.some((key) => status.includes(key))
  );
  if (hasFailureStatus) return true;

  // Remediation-record evidence (import job summary, value-join defect, schema
  // inspection, audit log) is a real defect signal; a bare count is not.
  return summary.evidence.some(
    (evidence) =>
      evidence.kind === "import_metadata" ||
      evidence.kind === "value_join" ||
      evidence.kind === "schema_inspection" ||
      evidence.kind === "audit_logs"
  );
}

function buildDefectClaim(
  action: HighImpactAction,
  text: string,
  summaries: CollectionSampleSummary[],
  contradictions: CountContradiction[],
  joins: Array<JoinVerification | ValueJoinVerification>,
  evidence: Evidence[]
): DefectClaim {
  const relevant = findRelevantSummary(text, summaries);

  if (!relevant) {
    const relatedJoin = findRelevantJoinDefect(action, joins, text);
    if (relatedJoin) {
      return {
        summary: `Related join defect evidence: ${relatedJoin.sourceCollection}.${relatedJoin.sourceKey} -> ${relatedJoin.targetCollection}.${relatedJoin.targetKey}: ${relatedJoin.outcome}`,
        classification: relatedJoin.classification,
        evidence: relatedJoin.evidence,
      };
    }
    return {
      summary: `No matching collection evidence for "${text}".`,
      classification: "UNKNOWN",
      evidence,
    };
  }

  // A summary must demonstrate an actual defect signal before it can be used
  // as evidence whatsoever. Merely reporting a count (even zero) is not a
  // defect and must yield UNKNOWN.
  if (!summaryIndicatesDefect(relevant)) {
    const missingFields =
      Object.keys(relevant.missingKeyCounts).join(", ") || "none";
    return {
      summary: `${relevant.collection}: ${relevant.classification} — ${relevant.count.sampledCount} sampled, missing fields: ${missingFields}`,
      classification: "UNKNOWN",
      evidence: relevant.evidence,
    };
  }

  const missingFields =
    Object.keys(relevant.missingKeyCounts).join(", ") || "none";

  const statusSummaries = Object.entries(relevant.statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");

  const contradiction = contradictions.find((c) =>
    text.toLowerCase().includes(c.entity.toLowerCase())
  );

  // The summary genuinely indicates a defect, but only the summary's OWN
  // classification decides whether it is VERIFIED. INFERRED / SAMPLED /
  // UNKNOWN evidence never authorizes remediation.
  return {
    summary: `${relevant.collection}: ${relevant.classification} — ${relevant.count.sampledCount} sampled, missing fields: ${missingFields}${statusSummaries ? `, statuses: ${statusSummaries}` : ""}${
      contradiction ? `, count contradiction: ${contradiction.entity}` : ""
    }`,
    classification: relevant.classification,
    evidence: relevant.evidence,
  };
}

function buildDowngradedSentence(action: HighImpactAction): string {
  const verb = ACTION_VERBS[action] ?? "Remediating";
  return `${verb} is not recommended yet because the underlying defect has not been verified. Audit the source data and verify the defect before proceeding with remediation.`;
}

function isDiagnosticOnly(text: string): boolean {
  const hasDiagnostic = DIAGNOSTIC_RULES.some((r) => r.test(text));
  const hasHighImpact = HIGH_IMPACT_RULES.some((r) => r.regex.test(text));
  return hasDiagnostic && !hasHighImpact;
}

/**
 * Derive a stable domain token from a sentence. This is used to build the
 * deduplication key so multiple sentences targeting the same collection/domain
 * collapse into a single downgrade, while genuinely distinct actions/domains
 * still produce their own downgrade.
 */
function deriveDomainToken(
  text: string,
  summaries: CollectionSampleSummary[]
): string {
  const relevant = findRelevantSummary(text, summaries);
  if (relevant) return relevant.collection.toLowerCase();

  const lower = text.toLowerCase();
  // Extract a plausible camelCase/collection-like token ("insurancePatients").
  const camel = lower.match(/[a-z]+(?:[A-Z][a-z]+)+/);
  if (camel) return camel[0].toLowerCase();

  // Fall back to the longest meaningful word in the sentence.
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  return words.sort((a, b) => b.length - a.length)[0] ?? "unknown";
}

/** Stable deduplication key: action + relevant domain/evidenceRef. */
function buildDedupeKey(
  action: HighImpactAction,
  text: string,
  summaries: CollectionSampleSummary[],
  joins: Array<JoinVerification | ValueJoinVerification>
): string {
  const domain = deriveDomainToken(text, summaries);
  const join = findRelevantJoinDefect(action, joins, text);
  const evidenceRef = join ? join.evidenceRef : action;
  return `${action}::${domain}::${evidenceRef}`;
}

export function applyRecommendationGate(
  input: RecommendationGateInput
): GateResult {
  const recommendations: GateResult["recommendations"] = [];

  // Split into sentences so we can replace only unsafe ones.
  const parts = input.answer.split(/(?<=[.!?])\s+/);

  const gatedParts: string[] = [];
  // Track the first occurrence of each blocked dedupe key. On subsequent
  // occurrences we suppress the duplicated downgrade text but still record the
  // accurate recommendation metadata for each original blocked sentence.
  const seenBlocked = new Set<string>();

  for (const part of parts) {
    const text = part.trim();
    if (!text) {
      gatedParts.push(part);
      continue;
    }

    const action = findProposedAction(text);
    if (!action) {
      gatedParts.push(part);
      continue;
    }

    // Diagnostic verbs are allowed only when no high-impact action is also
    // proposed in the same sentence.
    if (isDiagnosticOnly(text)) {
      gatedParts.push(part);
      continue;
    }

    // ALREADY-NEGATIVE SAFETY LANGUAGE: "Restoring is not recommended yet..."
    // is itself a negative-safety downgrade, not an affirmative recommendation.
    // It must pass through unchanged and must NOT trigger a new downgrade.
    if (hasNegativeLanguage(text)) {
      gatedParts.push(part);
      continue;
    }

    // EVIDENCE MENTION: a sentence that merely references restore/import in a
    // blocked/past context (an operation, a log, an attempted job) is not a
    // proposed action. Pass through unchanged, no new warning.
    if (isEvidenceMention(text)) {
      gatedParts.push(part);
      continue;
    }

    const defect = buildDefectClaim(
      action,
      text,
      input.summaries,
      input.contradictions,
      input.joins,
      input.evidence
    );

    const decision = canRecommendAction(action, defect);

    recommendations.push({
      action,
      allowed: decision.allowed,
      reason: decision.reason,
    });

    if (decision.allowed) {
      gatedParts.push(part);
      continue;
    }

    // REPLACE the unsafe sentence with a single consistent negative-safety
    // downgrade. The raw affirmative recommendation is removed; the specific
    // reason is carried in the metadata (recommendations) rather than appended
    // to the model-facing text, so no duplicate generic gate warning appears.
    //
    // IDEMPOTENCY: multiple affirmative sentences for the SAME blocked
    // action+domain produce only ONE downgrade, not one per sentence.
    const dedupeKey = buildDedupeKey(
      action,
      text,
      input.summaries,
      input.joins
    );

    if (seenBlocked.has(dedupeKey)) {
      // Duplicate blocked recommendation for the same action+domain: suppress
      // the extra downgrade text, but keep the (already-recorded) metadata.
      continue;
    }
    seenBlocked.add(dedupeKey);
    gatedParts.push(buildDowngradedSentence(action));
  }

  return {
    gatedAnswer: gatedParts.join(" ").trim(),
    recommendations,
  };
}
