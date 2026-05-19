import type { Timestamp } from "firebase/firestore";

export type AuditSeverity = "info" | "warning" | "critical";
export type DateFilter = "all" | "today" | "7d" | "30d";

export type AuditCategory =
  | "user"
  | "role"
  | "report"
  | "database"
  | "security"
  | "settings"
  | "unknown";

export type AuditLogRow = {
  id: string;
  action: string;
  actionLabel: string;
  category: AuditCategory;
  severity: AuditSeverity;
  riskScore: number;

  actorUid: string | null;
  actorEmail: string | null;
  targetUid: string | null;
  targetEmail: string | null;

  ipAddress: string | null;
  userAgent: string | null;

  details: Record<string, unknown>;
  detailsText: string;

  createdAt: Timestamp | null;
  createdAtMs: number;

  searchableText: string;
};