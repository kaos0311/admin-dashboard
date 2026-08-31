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

export function applyRecommendationGate(
  input: RecommendationGateInput
): GateResult {
  const recommendations: GateResult["recommendations"] = [];

  // Split into sentences so we can replace only unsafe ones.
  const parts = input.answer.split(/(?<=[.!?])\s+/);

  const gatedParts = parts.map((part) => {
    const text = part.trim();
    if (!text) return part;

    const action = findProposedAction(text);
    if (!action) return part;

    // Diagnostic verbs are allowed only when no high-impact action is also
    // proposed in the same sentence.
    if (isDiagnosticOnly(text)) return part;

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

    if (decision.allowed) return part;

    // REPLACE the unsafe sentence with a single consistent negative-safety
    // downgrade. The raw affirmative recommendation is removed; the specific
    // reason is carried in the metadata (recommendations) rather than appended
    // to the model-facing text, so no duplicate generic gate warning appears.
    return buildDowngradedSentence(action);
  });

  return {
    gatedAnswer: gatedParts.join(" ").trim(),
    recommendations,
  };
}
