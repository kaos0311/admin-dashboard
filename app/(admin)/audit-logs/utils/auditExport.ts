import toast from "react-hot-toast";

import { formatTimestamp, sanitizeCsvCell } from "./auditFormat";
import type { AuditLogRow } from "./auditTypes";

export function exportAuditCsv(logs: AuditLogRow[]): void {
  if (!logs.length) {
    toast.error("No logs to export.");
    return;
  }

  const rows = logs.map((log) => ({
    id: log.id,
    action: log.action,
    category: log.category,
    severity: log.severity,
    riskScore: log.riskScore,
    actor: log.actorEmail ?? log.actorUid ?? "",
    target: log.targetEmail ?? log.targetUid ?? "",
    ipAddress: log.ipAddress ?? "",
    createdAt: formatTimestamp(log.createdAt),
  }));

  const headers = Object.keys(rows[0] ?? {});

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => sanitizeCsvCell(row[header as keyof typeof row]))
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  link.rel = "noopener";
  link.click();

  URL.revokeObjectURL(url);
}