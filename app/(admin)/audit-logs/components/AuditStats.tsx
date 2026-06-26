import { useMemo } from "react";

import { isSuspiciousAuditEvent } from "../utils/auditRisk";
import type { AuditLogRow, AuditSeverity } from "../utils/auditTypes";
import { SummaryCard } from "./SummaryCard";
import { spacing } from "@/theme";

type AuditStatsProps = {
  logs: AuditLogRow[];
  onSeveritySelect?: (severity: AuditSeverity | "all") => void;
  onLogSelect?: (logId: string) => void;
};

export function AuditStats({
  logs,
  onSeveritySelect,
  onLogSelect,
}: AuditStatsProps) {
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

  const firstHighRisk = useMemo(
    () => logs.find((log) => log.riskScore >= 70),
    [logs]
  );

  const firstSuspicious = useMemo(
    () => logs.find(isSuspiciousAuditEvent),
    [logs]
  );

  return (
    <section className={`${spacing.gridCardsTwo} xl:grid-cols-6`}>
      <SummaryCard
        label="Loaded Logs"
        value={stats.total}
        tone="blue"
        onClick={() => onSeveritySelect?.("all")}
      />
      <SummaryCard
        label="High Risk"
        value={stats.highRisk}
        tone="red"
        onClick={firstHighRisk ? () => onLogSelect?.(firstHighRisk.id) : undefined}
      />
      <SummaryCard
        label="Suspicious"
        value={stats.suspicious}
        tone="red"
        onClick={firstSuspicious ? () => onLogSelect?.(firstSuspicious.id) : undefined}
      />
      <SummaryCard
        label="Critical"
        value={stats.critical}
        tone="red"
        onClick={() => onSeveritySelect?.("critical")}
      />
      <SummaryCard
        label="Warnings"
        value={stats.warning}
        tone="yellow"
        onClick={() => onSeveritySelect?.("warning")}
      />
      <SummaryCard label="Unique Actors" value={stats.uniqueActors} tone="blue" />
    </section>
  );
}





