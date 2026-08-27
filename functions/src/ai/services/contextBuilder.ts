/**
 * Shared Jarvis context assembly.
 *
 * Previously an empty scaffold. Implements the reporting contract:
 * - limited queries produce CountReports with actualCount = null
 * - optional aggregate counts upgrade summaries to VERIFIED
 * - count contradictions across sections are detected mechanically
 */

import {
  countFromLimitedQuery,
  findCountContradictions,
  summarizeSample,
  type CollectionSampleSummary,
  type CountClaim,
  type CountContradiction,
  type Evidence,
  type JoinPair,
  type JoinVerification,
  verifyJoin,
} from "../types/reporting";

export type { JoinPair } from "../types/reporting";

export interface CollectionFetchResult {
  collection: string;
  /** Documents actually retrieved (the sample). */
  docs: Array<Record<string, unknown>>;
  /** Query limit applied when fetching the sample. */
  limit: number;
  /**
   * True Firestore aggregate count result, when one was executed.
   * Callers MUST leave this null when only a limited query ran.
   */
  aggregateCount?: number | null;
}

/**
 * Build per-collection summaries from fetch results without ever labeling a
 * limited query as an actual count.
 */
export function buildCollectionSummaries(
  results: CollectionFetchResult[],
  requiredFieldsByCollection: Record<string, string[]> = {}
): CollectionSampleSummary[] {
  return results.map((result) =>
    summarizeSample(
      result.collection,
      result.docs,
      result.limit,
      {
        requiredFields: requiredFieldsByCollection[result.collection] ?? [],
        aggregateCount: result.aggregateCount ?? null,
      }
    )
  );
}

/**
 * Extract CountClaims from summaries so cross-section contradictions can be
 * detected (e.g. "PRESENT 962" vs "MISSING 962" style mismatches).
 */
export function collectCountClaims(
  summaries: CollectionSampleSummary[]
): CountClaim[] {
  const claims: CountClaim[] = [];
  for (const summary of summaries) {
    claims.push({
      entity: `${summary.collection}:total`,
      value: summary.count.sampledCount,
      section: `summary:${summary.collection}`,
    });
    if (summary.count.actualCount !== null) {
      claims.push({
        entity: `${summary.collection}:total`,
        value: summary.count.actualCount,
        section: `aggregate:${summary.collection}`,
      });
    }
    for (const [status, value] of Object.entries(summary.statusCounts)) {
      claims.push({
        entity: `${summary.collection}:${status}`,
        value,
        section: `status:${summary.collection}`,
      });
    }
  }
  return claims;
}

export interface ContextBuildOutput {
  totalSampledRecords: number;
  summaries: CollectionSampleSummary[];
  contradictions: CountContradiction[];
  joins: JoinVerification[];
  evidence: Evidence[];
}

export function buildOperationsContext(
  results: CollectionFetchResult[],
  requiredFieldsByCollection: Record<string, string[]> = {},
  joinPairs: JoinPair[] = []
): ContextBuildOutput {
  const summaries = buildCollectionSummaries(
    results,
    requiredFieldsByCollection
  );
  const contradictions = findCountContradictions(collectCountClaims(summaries));

  const samples = results.reduce<Record<string, Array<Record<string, unknown>>>>(
    (acc, result) => {
      acc[result.collection] = result.docs;
      return acc;
    },
    {}
  );

  const joins = buildJoinVerifications(samples, joinPairs);

  const evidence: Evidence[] = summaries.flatMap((summary) => summary.evidence);

  return {
    totalSampledRecords: summaries.reduce(
      (sum, summary) => sum + summary.count.sampledCount,
      0
    ),
    summaries,
    contradictions,
    joins,
    evidence,
  };
}

export function buildJoinVerifications(
  samples: Record<string, Array<Record<string, unknown>>>,
  pairs: JoinPair[]
): JoinVerification[] {
  return pairs.map((pair) => {
    const leftValues = (samples[pair.leftCollection] ?? []).map(
      (doc) => doc[pair.leftField] as string | number | null | undefined
    );
    const rightValues = (samples[pair.rightCollection] ?? []).map(
      (doc) => doc[pair.rightField] as string | number | null | undefined
    );
    return verifyJoin(
      {
        collection: pair.leftCollection,
        field: pair.leftField,
        values: leftValues,
      },
      {
        collection: pair.rightCollection,
        field: pair.rightField,
        values: rightValues,
      }
    );
  });
}