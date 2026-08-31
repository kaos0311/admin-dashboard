/**
 * Guidance appended to Jarvis context for analysis-reporting intent.
 * Previously an empty scaffold.
 */

import type {
  Classification,
  CollectionSampleSummary,
  CountContradiction,
  JoinVerification,
  ValueJoinVerification,
} from "../types/reporting";

export const ANALYTICS_PROMPT_SECTION = `
Analytics & reporting guidance:
- Counts: always report sampledCount separately from actualCount; say "unknown" for actualCount when no aggregate count ran.
- Every reported figure carries a classification: VERIFIED, SAMPLED, INFERRED, UNKNOWN, or NOT TESTED.
- Join claims require join-verification numbers (records tested, exact matches, confirmed unmatched, not observed in target sample, unresolved against incomplete target, missing keys, ambiguous matches).
- Claim strength: absolute terms require aggregate-grade evidence; otherwise use "suggests", "likely", "sample indicates".
- Recommendation gating: migrations, restores, re-imports, new linkage keys, and data repair require a VERIFIED defect first.
- Missing inputs: name the data source needed before relying on any metric.`;

export interface AnalyticsPromptContext {
  summaries: CollectionSampleSummary[];
  contradictions: CountContradiction[];
  joins: Array<JoinVerification | ValueJoinVerification>;
}

function classificationLine(name: string, classification: Classification): string {
  return `- ${name}: ${classification}`;
}

export function buildAnalyticsContextSection(
  context: AnalyticsPromptContext
): string {
  const summaryLines = context.summaries.map((summary) =>
    classificationLine(
      `${summary.collection} (sampled=${summary.count.sampledCount}, actual=${
        summary.count.actualCount === null ? "unknown" : summary.count.actualCount
      })`,
      summary.classification
    )
  );

  const contradictionLines =
    context.contradictions.length > 0
      ? context.contradictions.map((contradiction) =>
          classificationLine(
            `CONTRADICTION "${contradiction.entity}": ${contradiction.values[0]} (${contradiction.sections[0]}) vs ${contradiction.values[1]} (${contradiction.sections[1]}) — mark UNKNOWN until reconciled`,
            "UNKNOWN"
          )
        )
      : ["- No count contradictions detected between report sections."];

  const joinLines =
    context.joins.length > 0
      ? context.joins.map((join) => {
          if ("sourceCollection" in join) {
            return classificationLine(
              `join ${join.sourceCollection}.${join.sourceKey} -> ${join.targetCollection}.${join.targetKey}: sourceTested=${join.sourceTestedCount}, uniqueTargetKeysProbed=${join.targetTestedCount}, sourceWithKey=${join.sourceRecordsWithKey}, sourceMissingKeys=${join.sourceMissingKeyCount}, exactUniqueMatches=${join.exactUniqueMatches}, ambiguousMatches=${join.ambiguousMatches}, confirmedUnmatched=${join.unmatched}, notObservedInTargetSample=${join.notObservedInTargetSample}, unresolvedAgainstIncompleteTarget=${join.unresolvedAgainstIncompleteTarget}, duplicateTargetKeys=${join.duplicateTargetKeys}, targetDuplicateKeyCount=${join.targetDuplicateKeyCount}, coverage=${join.coveragePercentage}%, outcome=${join.outcome}, sampleStatus=${join.sampleStatus}, joinMethod=${join.joinMethod}, sourceScanComplete=${join.sourceScanComplete}, targetVerificationComplete=${join.targetVerificationComplete}, joinComplete=${join.joinComplete}, targetLookupMethod=${join.targetLookupMethod}, targetUniqueKeysChecked=${join.targetUniqueKeysChecked}, targetVerificationRecordsRead=${join.targetVerificationRecordsRead}, targetVerificationQueryOperations=${join.targetVerificationQueryOperations}, targetDuplicateKeysStructurallyImpossible=${join.targetDuplicateKeysStructurallyImpossible}, sourceCountMethod=${join.sourceCountMethod}, targetCountMethod=${join.targetCountMethod}, evidenceRef=${join.evidenceRef}`,
              join.classification
            );
          }
          return classificationLine(
            `join ${join.leftCollection}.${join.leftField} -> ${join.rightCollection}.${join.rightField}: tested=${join.recordsTestedLeft}/${join.recordsTestedRight}, matches=${join.exactMatches}, unmatched=${join.unmatchedLeft}/${join.unmatchedRight}, missingKeys=${join.missingKeysLeft}/${join.missingKeysRight}, ambiguous=${join.ambiguousMatches}`,
            join.classification
          );
        })
      : ["- No cross-collection joins were tested; any relationship claim is NOT TESTED."];

  return [
    ANALYTICS_PROMPT_SECTION,
    "",
    "Collection counts:",
    ...summaryLines,
    "",
    "Consistency check:",
    ...contradictionLines,
    "",
    "Join verification:",
    ...joinLines,
  ].join("\n");
}
