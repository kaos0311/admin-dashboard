import { useMemo } from "react";

import { isSuspiciousAuditEvent } from "../utils/auditRisk";
import type { AuditLogRow } from "../utils/auditTypes";
import { SummaryCard } from "./SummaryCard";

export function AuditStats({ logs }: { logs: AuditLogRow[] }) {
  const stats = useMemo(() => {
    const actorSet = new Set<string>();

    let critical = 0;
    let warning = 0;
    let highRisk = 0;
    let suspicious = 0;

    for (const log of logs) {
      if (log.severity === "critical") critical += 1;
      if (log.severity === "warning") warning += 1;
      if (log.riskScore >= 70) highRisk += 1;
      if (isSuspiciousAuditEvent(log)) suspicious += 1;

      actorSet.add(log.actorEmail ?? log.actorUid ?? "Unknown");
    }

    return {
      total: logs.length,
      critical,
      warning,
      highRisk,
      suspicious,
      uniqueActors: actorSet.size,
    };
  }, [logs]);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <SummaryCard label="Loaded Logs" value={stats.total} />
      <SummaryCard label="High Risk" value={stats.highRisk} critical />
      <SummaryCard label="Suspicious" value={stats.suspicious} critical />
      <SummaryCard label="Critical" value={stats.critical} critical />
      <SummaryCard label="Warnings" value={stats.warning} />
      <SummaryCard label="Unique Actors" value={stats.uniqueActors} />
    </section>
  );
}