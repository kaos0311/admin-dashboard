/**
 * Report-insights CSV builder.
 * Previously an empty scaffold. Emits contract-compliant CSV rows from
 * collection summaries: sampled vs actual columns are always present, and a
 * row without an aggregate reports actualCount=unknown.
 */

import type { CollectionSampleSummary } from "../types/reporting";

export type { CollectionSampleSummary } from "../types/reporting";

export const REPORT_CSV_HEADER = [
  "Collection",
  "Sampled Rows",
  "Actual Count",
  "Count Method",
  "Statuses",
  "Missing Field Counts",
  "Classification",
] as const;

export function summarizeCsvRow(summary: CollectionSampleSummary): string[] {
  return [
    summary.collection,
    String(summary.count.sampledCount),
    summary.count.actualCount === null
      ? "unknown"
      : String(summary.count.actualCount),
    summary.count.method,
    JSON.stringify(summary.statusCounts),
    JSON.stringify(summary.missingKeyCounts),
    summary.classification,
  ];
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildReportCsv(summaries: CollectionSampleSummary[]): string {
  return [REPORT_CSV_HEADER, ...summaries.map(summarizeCsvRow)]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}