/**
 * Audit-log summarization tool.
 * Previously an empty scaffold. Summaries always carry the sample note so a
 * limited log tail is never described as complete history.
 */

import { buildAuditContext, type AuditLogEntry } from "../services/auditContext";

export interface AuditLogActionTally {
  action: string;
  count: number;
}

export interface AuditLogSummary {
  sampledCount: number;
  actualCount: number | null;
  limitApplied: number;
  talliesByAction: Record<string, number>;
  topActions: AuditLogActionTally[];
  sampleNote: string;
}

export function summarizeAuditLogEntries(
  entries: AuditLogEntry[],
  limitApplied: number
): AuditLogSummary {
  const context = buildAuditContext({ entries, limitApplied });

  const talliesByAction: Record<string, number> = {};
  for (const entry of entries) {
    const key = String(entry.action ?? "unknown");
    talliesByAction[key] = (talliesByAction[key] ?? 0) + 1;
  }

  const topActions = Object.entries(talliesByAction)
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    sampledCount: entries.length,
    actualCount: null, // no aggregate executed here; never fabricate totals
    limitApplied,
    talliesByAction,
    topActions,
    sampleNote: context.auditSampleNote,
  };
}