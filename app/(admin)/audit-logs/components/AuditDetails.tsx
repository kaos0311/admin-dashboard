import { AlertTriangle } from "lucide-react";

import { formatTimestamp, safeJson } from "../utils/auditFormat";
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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/50 bg-white/50 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <p className="mt-2 break-words text-sm">{value}</p>
    </div>
  );
}

export function AuditDetails({ selectedLog }: { selectedLog: AuditLogRow | null }) {
  return (
    <section className="sticky top-6 h-fit max-h-[calc(100vh-3rem)] overflow-auto rounded-3xl border border-white/50 bg-white/60 p-6 shadow-sm backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
      {selectedLog ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold capitalize">
                {selectedLog.actionLabel}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {formatTimestamp(selectedLog.createdAt)}
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.15em] ${severityClass(
                selectedLog.severity
              )}`}
            >
              {selectedLog.severity}
            </span>
          </div>

          {isSuspiciousAuditEvent(selectedLog) && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                High-risk audit event
              </div>

              <p className="mt-1 text-xs text-red-700/80 dark:text-red-200/80">
                Delete, reset, database, security, permission, or failure activity
                detected. Stop sipping coffee and look at the damn thing.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Category" value={selectedLog.category} />
            <InfoCard title="Risk Score" value={`${selectedLog.riskScore}/100`} />
            <InfoCard
              title="Actor"
              value={selectedLog.actorEmail ?? selectedLog.actorUid ?? "—"}
            />
            <InfoCard
              title="Target"
              value={selectedLog.targetEmail ?? selectedLog.targetUid ?? "—"}
            />
            <InfoCard title="Actor UID" value={selectedLog.actorUid ?? "—"} />
            <InfoCard title="Target UID" value={selectedLog.targetUid ?? "—"} />
            <InfoCard title="IP Address" value={selectedLog.ipAddress ?? "—"} />
          </div>

          <InfoCard title="Device / User Agent" value={selectedLog.userAgent ?? "—"} />

          <div className="rounded-2xl border border-white/50 bg-white/50 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/20">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
              Details
            </p>

            <pre className="mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200">
              {safeJson(selectedLog.details)}
            </pre>
          </div>
        </div>
      ) : (
        <p className="text-slate-500">Select an audit event.</p>
      )}
    </section>
  );
}