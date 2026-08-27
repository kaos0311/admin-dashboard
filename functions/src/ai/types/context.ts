/**
 * Context-shape types for the Jarvis database-analysis pipeline.
 * Previously an empty scaffold.
 */

export type {
  Classification,
  CollectionSampleSummary,
  CountClaim,
  CountContradiction,
  CountMethod,
  CountReport,
  DefectClaim,
  Evidence,
  EvidenceKind,
  JoinSide,
  JoinVerification,
  HighImpactAction,
} from "./reporting";

import type {
  CollectionSampleSummary,
  CountContradiction,
  JoinVerification,
} from "./reporting";

/** Context payload handed to the model alongside the user question. */
export interface JarvisAnalysisContext {
  operationsOverview?: {
    generatedAt: string;
    totalSampledRecords: number;
    summaries: CollectionSampleSummary[];
    contradictions?: CountContradiction[];
  };
  joinVerifications?: JoinVerification[];
  [key: string]: unknown;
}