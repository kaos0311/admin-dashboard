import { AlertTriangle } from "lucide-react";

import { alerts, badges, glass, typography } from "@/theme";

import { formatTimestamp, safeJson } from "../utils/auditFormat";
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

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className={glass.insetPadded}>
      <p className={typography.caption}>{title}</p>

      <p className={`mt-2 break-words ${typography.body}`}>{value}</p>
    </div>
  );
}

export function AuditDetails({ selectedLog }: { selectedLog: AuditLogRow | null }) {
  return (
    <section className={`${glass.panelPadded} sticky top-6 self-start`}>
      {selectedLog ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={`${typography.cardTitle} capitalize`}>
                {selectedLog.actionLabel}
              </h2>

              <p className={`mt-1 ${typography.caption}`}>
                {formatTimestamp(selectedLog.createdAt)}
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.15em] ${severityClass(
                selectedLog.severity
              )}`}
            >
              {selectedLog.severity}
            </span>
          </div>

          {isSuspiciousAuditEvent(selectedLog) && (
            <div className={alerts.danger}>
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                High-risk audit event
              </div>

              <p className={`mt-1 ${typography.small}`}>
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
              value={selectedLog.actorEmail ?? selectedLog.actorUid ?? "-"}
            />
            <InfoCard
              title="Target"
              value={selectedLog.targetEmail ?? selectedLog.targetUid ?? "-"}
            />
            <InfoCard title="Actor UID" value={selectedLog.actorUid ?? "-"} />
            <InfoCard title="Target UID" value={selectedLog.targetUid ?? "-"} />
            <InfoCard title="IP Address" value={selectedLog.ipAddress ?? "-"} />
          </div>

          <InfoCard title="Device / User Agent" value={selectedLog.userAgent ?? "-"} />

          <div className={glass.insetPadded}>
            <p className={typography.caption}>Details</p>

            <pre className={`mt-3 max-h-[500px] overflow-auto whitespace-pre-wrap ${typography.small}`}>
              {safeJson(selectedLog.details)}
            </pre>
          </div>
        </div>
      ) : (
        <p className={typography.caption}>Select an audit event.</p>
      )}
    </section>
  );
}
