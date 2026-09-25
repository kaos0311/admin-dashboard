/**
 * Audit-context helpers.
 * Previously an empty scaffold.
 *
 * Shapes recent audit-log evidence for Jarvis with explicit sample limits so
 * the model can never present a 25-row log tail as a complete activity
 * history.
 */

import type { Evidence } from "../types/reporting";

export interface AuditLogEntry {
  id: string;
  action: string | null;
  actorEmail: string | null;
  severity: string | null;
  createdAt: unknown;
}

export interface AuditContextInput {
  entries: AuditLogEntry[];
  /** Limit that produced these entries, e.g. 25. */
  limitApplied: number;
}

export interface AuditContextOutput {
  recentAuditLogs: AuditLogEntry[];
  auditSampleNote: string;
  evidence: Evidence[];
}

const SAMPLE_NOTE_TEMPLATE = (limit: number, count: number): string =>
  `Most recent ${count} audit-log entries (query limit ${limit}). This is a SAMPLE; total audit volume is UNKNOWN. Use "sample indicates" language, not "complete".`;

export function buildAuditContext(
  input: AuditContextInput
): AuditContextOutput {
  const count = input.entries.length;

  return {
    recentAuditLogs: input.entries,
    auditSampleNote:
      count === 0
        ? `No audit-log entries were retrieved (query limit ${limit(input.limitApplied)}). Total audit volume is UNKNOWN.`
        : SAMPLE_NOTE_TEMPLATE(input.limitApplied, count),
    evidence: [
      {
        kind: "audit_logs",
        reference: `auditLogs orderBy createdAt desc limit(${input.limitApplied}) -> ${count} entries`,
      },
    ],
  };
}

function limit(value: number): number {
  return value;
}