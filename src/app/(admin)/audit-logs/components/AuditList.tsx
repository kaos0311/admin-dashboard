import { Filter } from "lucide-react";

import { badges, glass, typography } from "@/theme";

import { formatTimestamp } from "../utils/auditFormat";
import { actionIcon } from "../utils/auditNormalize";
import { isSuspiciousAuditEvent } from "../utils/auditRisk";
import type { AuditLogRow, AuditSeverity } from "../utils/auditTypes";

function severityClass(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return badges.danger;

    case "warning":
      return badges.warning;

    default:
      return badges.info;
  }
}

function riskBarClass(score: number): string {
  if (score >= 70) return `w-full ${glass.riskHigh}`;
  if (score >= 60) return `w-3/5 ${glass.riskMedium}`;
  if (score >= 40) return `w-2/5 ${glass.riskMedium}`;
  if (score >= 20) return `w-1/5 ${glass.riskLow}`;

  return `w-[10%] ${glass.riskMinimal}`;
}

export function AuditList({
  logs,
  filteredLogs,
  selectedLogId,
  setSelectedLogId,
}: {
  logs: AuditLogRow[];
  filteredLogs: AuditLogRow[];
  selectedLogId: string | null;
  setSelectedLogId: (id: string) => void;
}) {
  return (
    <section className={glass.card}>
      <div className={`border-b ${glass.divider} p-4`}>
        <div className={`flex items-center gap-2 ${typography.bodyMuted}`}>
          <Filter className="h-4 w-4" />
          Showing {filteredLogs.length.toLocaleString()} of{" "}
          {logs.length.toLocaleString()}
        </div>
      </div>

      <div className="max-h-[80vh] overflow-y-auto p-3">
        {filteredLogs.length ? (
          <div className="space-y-2">
            {filteredLogs.map((log) => {
              const selected = selectedLogId === log.id;
              const suspicious = isSuspiciousAuditEvent(log);

              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedLogId(log.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${glass.focus} ${
                    selected
                      ? glass.selectedListItem
                      : "border-white/10 bg-white/[0.045] hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {actionIcon(log.action)}

                      <span className="truncate text-sm font-medium capitalize">
                        {log.actionLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {suspicious && (
                        <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${badges.danger}`}>
                          Watch
                        </span>
                      )}

                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.15em] ${severityClass(
                          log.severity
                        )}`}
                      >
                        {log.severity}
                      </span>
                    </div>
                  </div>

                  <div className={`mt-2 ${typography.smallMuted}`}>
                    {formatTimestamp(log.createdAt)}
                  </div>

                  <div className={`mt-2 truncate ${typography.small}`}>
                    Actor: {log.actorEmail ?? log.actorUid ?? "â€”"}
                  </div>

                  <div className={`truncate ${typography.smallMuted}`}>
                    Target: {log.targetEmail ?? log.targetUid ?? "â€”"}
                  </div>

                  <div className={`mt-2 ${typography.caption}`}>
                    {log.category}
                  </div>

                  <div className={`mt-3 ${glass.progressTrack}`}>
                    <div
                      className={`h-full rounded-full ${riskBarClass(log.riskScore)}`}
                    />
                  </div>

                  <div className={`mt-1 ${typography.caption}`}>
                    Risk {log.riskScore}/100
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className={`${glass.emptyState} ${typography.bodyMuted}`}>
            No audit logs match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}






