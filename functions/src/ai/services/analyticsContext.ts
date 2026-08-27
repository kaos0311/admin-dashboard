/**
 * Analytics context helpers.
 * Previously an empty scaffold.
 *
 * Converts stored analytics documents (analytics/reports) plus collection
 * summaries into a model-facing payload that respects the reporting
 * contract: stored metrics keep their own provenance, and any count derived
 * from a limited query is labeled as sampled.
 */

import type { CollectionSampleSummary, CountContradiction } from "../types/reporting";
import { buildAnalyticsContextSection } from "../prompts/analyticsPrompt";

export interface StoredMetric {
  key: string;
  label: string;
  formattedValue: string;
  status: string;
  formula?: string;
  missingInputs?: string[];
}

export interface AnalyticsContextInput {
  generatedAtLabel: string;
  metrics: StoredMetric[];
  summaries: CollectionSampleSummary[];
  contradictions: CountContradiction[];
}

export function buildAnalyticsPayload(input: AnalyticsContextInput): {
  text: string;
  metrics: StoredMetric[];
} {
  const missingInputs = input.metrics.flatMap(
    (metric) => metric.missingInputs ?? []
  );

  const header = [
    `Retail/financial analytics (generatedAtLabel: ${input.generatedAtLabel || "unknown"}).`,
    "Stored metrics below carry their own provenance from the analytics document; do not recompute them from samples.",
    missingInputs.length > 0
      ? `Missing inputs reported by the analytics pipeline: ${Array.from(new Set(missingInputs)).join(", ")}. Treat affected metrics as incomplete.`
      : "No missing inputs were reported by the analytics pipeline.",
  ];

  return {
    text: [
      ...header,
      "",
      buildAnalyticsContextSection({
        summaries: input.summaries,
        contradictions: input.contradictions,
        joins: [],
      }),
    ].join("\n"),
    metrics: input.metrics,
  };
}