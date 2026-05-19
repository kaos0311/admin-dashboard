import type { AuditCategory, AuditLogRow, AuditSeverity } from "./auditTypes";

export function getCategory(action: string, detailsText: string): AuditCategory {
  const text = `${action} ${detailsText}`.toLowerCase();

  if (text.includes("role") || text.includes("claim")) return "role";
  if (text.includes("user") || text.includes("account")) return "user";
  if (text.includes("report") || text.includes("import")) return "report";

  if (
    text.includes("database") ||
    text.includes("clean") ||
    text.includes("purge") ||
    text.includes("reset") ||
    text.includes("rebuild")
  ) {
    return "database";
  }

  if (
    text.includes("security") ||
    text.includes("permission") ||
    text.includes("denied") ||
    text.includes("failed") ||
    text.includes("unauthorized")
  ) {
    return "security";
  }

  if (text.includes("settings") || text.includes("config")) return "settings";

  return "unknown";
}

export function getSeverity(
  action: string,
  category: AuditCategory,
  detailsText: string
): AuditSeverity {
  const text = `${action} ${detailsText}`.toLowerCase();

  if (
    category === "security" ||
    category === "database" ||
    text.includes("delete") ||
    text.includes("deleted") ||
    text.includes("clean") ||
    text.includes("purge") ||
    text.includes("reset") ||
    text.includes("failed") ||
    text.includes("permission") ||
    text.includes("denied") ||
    text.includes("unauthorized")
  ) {
    return "critical";
  }

  if (
    category === "role" ||
    text.includes("disable") ||
    text.includes("disabled") ||
    text.includes("updated") ||
    text.includes("archive") ||
    text.includes("cancel")
  ) {
    return "warning";
  }

  return "info";
}

export function getRiskScore(
  action: string,
  category: AuditCategory,
  severity: AuditSeverity,
  detailsText: string
): number {
  const text = `${action} ${detailsText}`.toLowerCase();

  let score = severity === "critical" ? 70 : severity === "warning" ? 40 : 15;

  if (category === "database") score += 20;
  if (category === "security") score += 15;
  if (category === "role") score += 15;

  if (text.includes("delete") || text.includes("purge") || text.includes("reset")) {
    score += 15;
  }

  if (text.includes("admin")) score += 10;
  if (text.includes("failed") || text.includes("error")) score += 10;

  return Math.min(score, 100);
}

export function isSuspiciousAuditEvent(log: AuditLogRow): boolean {
  const text = `${log.action} ${log.detailsText}`.toLowerCase();

  return (
    log.riskScore >= 80 ||
    text.includes("delete") ||
    text.includes("purge") ||
    text.includes("reset") ||
    text.includes("permission") ||
    text.includes("denied") ||
    text.includes("failed") ||
    text.includes("unauthorized")
  );
}