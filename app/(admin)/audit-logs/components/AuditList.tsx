import { Filter } from "lucide-react";

import { formatTimestamp } from "../utils/auditFormat";
import { actionIcon } from "../utils/auditNormalize";
import { isSuspiciousAuditEvent } from "../utils/auditRisk";
import type { AuditLogRow, AuditSeverity } from "../utils/auditTypes";

function severityClass(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    default:
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  }
}

function riskBarClass(score: number): string {
  if (score >= 70) return "w-full bg-red-400";
  if (score >= 60) return "w-3/5 bg-amber-300";
  if (score >= 40) return "w-2/5 bg-amber-300";
  if (score >= 20) return "w-1/5 bg-sky-300";

  return "w-[10%] bg-slate-400";
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
    <section className="rounded-3xl border border-white/50 bg-white/60 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
      <div className="border-b border-white/50 p-4 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
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
                  className={`w-full rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-500/10 ${
                    selected
                      ? "border-blue-400/40 bg-blue-500/10"
                      : "border-white/50 bg-white/45 hover:bg-white/70 dark:border-white/10 dark:bg-black/10 dark:hover:bg-white/[0.08]"
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
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-red-700 dark:text-red-300">
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

                  <div className="mt-2 text-xs text-slate-500">
                    {formatTimestamp(log.createdAt)}
                  </div>

                  <div className="mt-2 truncate text-xs text-slate-600 dark:text-slate-400">
                    Actor: {log.actorEmail ?? log.actorUid ?? "—"}
                  </div>

                  <div className="truncate text-xs text-slate-500">
                    Target: {log.targetEmail ?? log.targetUid ?? "—"}
                  </div>

                  <div className="mt-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    {log.category}
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/10 dark:bg-black/50">
                    <div
                      className={`h-full rounded-full ${riskBarClass(log.riskScore)}`}
                    />
                  </div>

                  <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    Risk {log.riskScore}/100
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/50 bg-white/40 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-black/20">
            No audit logs match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}