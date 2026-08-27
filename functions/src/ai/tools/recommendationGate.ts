/**
 * Deterministic recommendation gate for Jarvis AI responses.
 *
 * After the model produces output, this module scans for high-impact
 * remediation recommendations and enforces the canRecommendAction() policy
 * using the strongest available defect evidence from the operations context.
 *
 * Diagnostic recommendations (investigate, inspect, audit, verify, monitor,
 * review) are never blocked.
 *
 * Pure logic only: no Firebase imports, fully unit-testable.
 */

import {
  canRecommendAction,
  type CollectionSampleSummary,
  type CountContradiction,
  type DefectClaim,
  type Evidence,
  type HighImpactAction,
  type JoinVerification,
} from "../types/reporting";

const HIGH_IMPACT_RULES: Array<{ regex: RegExp; action: HighImpactAction }> = [
  { regex: /\brestore(s|d)?\b/i, action: "restore" },
  { regex: /\bre-?import(s|ed)?\b/i, action: "re_import" },
  { regex: /\breimport(s|ed)?\b/i, action: "re_import" },
  { regex: /\bdelete(s|d)?\b/i, action: "data_repair" },
  { regex: /\brepair(s|ed)?\b/i, action: "data_repair" },
  { regex: /\bmigrate(s|d)?\b/i, action: "schema_migration" },
  { regex: /\bschema\s+change\b/i, action: "schema_migration" },
  { regex: /\badd(ing)?\s+(a\s+)?(new\s+)?linkage\b/i, action: "new_linkage_key" },
  { regex: /\bchange\s+linkage\b/i, action: "new_linkage_key" },
  { regex: /\bnormalize(s|d)?\b/i, action: "data_repair" },
  { regex: /\brewrite(s|d)?\b/i, action: "data_repair" },
  { regex: /\bmass\s+update(s|d)?\b/i, action: "data_repair" },
  { regex: /\bbackfill(s|ed)?\b/i, action: "data_repair" },
  { regex: /\boverwrite(s|d)?\b/i, action: "data_repair" },
  { regex: /\brebuild(s|d)?\b/i, action: "data_repair" },
];

const DIAGNOSTIC_RULES = [
  /\binvestigate\b/i,
  /\binspect\b/i,
  /\baudit\b/i,
  /\bverify\b/i,
  /\bmonitor\b/i,
  /\breview\b/i,
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
  joins: JoinVerification[];
  evidence: Evidence[];
}

export interface GatedRecommendation {
  original: string;
  action: HighImpactAction | null;
  allowed: boolean;
  reason: string;
}

export interface RecommendationGateResult {
  gatedAnswer: string;
  recommendations: GatedRecommendation[];
}

function splitUnits(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/);
  const units: string[] = [];
  for (const unit of raw) {
    const trimmed = unit.trim();
    if (trimmed.length > 0) units.push(trimmed);
  }
  return units;
}

function isDiagnosticOnly(text: string): boolean {
  const hasDiagnostic = DIAGNOSTIC_RULES.some((r) => r.test(text));
  const hasHighImpact = HIGH_IMPACT_RULES.some((r) => r.regex.test(text));
  return hasDiagnostic && !hasHighImpact;
}

function detectHighImpactAction(text: string): HighImpactAction | null {
  for (const rule of HIGH_IMPACT_RULES) {
    if (rule.regex.test(text)) {
      return rule.action;
    }
  }
  return null;
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
    const score = words.reduce((acc, word) => acc + (lower.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = summary;
    }
  }

  return bestScore > 0 ? best : undefined;
}

function buildDefectClaim(
  action: HighImpactAction,
  text: string,
  input: RecommendationGateInput
): DefectClaim {
  const relevant = findRelevantSummary(text, input.summaries);

  if (!relevant) {
    return {
      summary: "No defect context available",
      classification: "UNKNOWN",
      evidence: input.evidence,
    };
  }

  const missingFields = Object.keys(relevant.missingKeyCounts).join(", ") || "none";

  return {
    summary: `${relevant.collection}: ${relevant.classification} — ${relevant.count.sampledCount} sampled, missing fields: ${missingFields}`,
    classification: relevant.classification,
    evidence: relevant.evidence,
  };
}

function downgradeRecommendation(
  sentence: string,
  action: HighImpactAction,
  reason: string
): string {
  const verb = ACTION_VERBS[action] ?? "Remediating";
  return `${verb} is not recommended yet because the underlying defect has not been verified. ${reason}. Audit the source data and verify the defect before proceeding with remediation.`;
}

export function applyRecommendationGate(
  input: RecommendationGateInput
): RecommendationGateResult {
  const units = splitUnits(input.answer);
  const recommendations: GatedRecommendation[] = [];
  const gatedParts: string[] = [];

  for (const unit of units) {
    if (isDiagnosticOnly(unit)) {
      gatedParts.push(unit);
      continue;
    }

    const action = detectHighImpactAction(unit);
    if (!action) {
      gatedParts.push(unit);
      continue;
    }

    const defect = buildDefectClaim(action, unit, input);
    const decision = canRecommendAction(action, defect);

    recommendations.push({
      original: unit,
      action,
      allowed: decision.allowed,
      reason: decision.reason,
    });

    if (decision.allowed) {
      gatedParts.push(unit);
    } else {
      gatedParts.push(downgradeRecommendation(unit, action, decision.reason));
    }
  }

  return {
    gatedAnswer: gatedParts.join(" ").trim(),
    recommendations,
  };
}
