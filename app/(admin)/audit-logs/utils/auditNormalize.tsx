import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  Ban,
  Database,
  FileText,
  Settings,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { humanAction, safeJson } from "./auditFormat";
import { getCategory, getRiskScore, getSeverity } from "./auditRisk";
import type { AuditLogRow } from "./auditTypes";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(data: DocumentData, keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readTimestamp(data: DocumentData, keys: string[]): Timestamp | null {
  for (const key of keys) {
    const value = data[key];

    if (value instanceof Timestamp) {
      return value;
    }

    if (
      isRecord(value) &&
      typeof value.seconds === "number" &&
      typeof value.nanoseconds === "number"
    ) {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
  }

  return null;
}

function buildSearchableText(log: Omit<AuditLogRow, "searchableText">): string {
  return [
    log.id,
    log.action,
    log.actionLabel,
    log.category,
    log.severity,
    log.actorEmail ?? "",
    log.targetEmail ?? "",
    log.actorUid ?? "",
    log.targetUid ?? "",
    log.ipAddress ?? "",
    log.userAgent ?? "",
    log.detailsText,
  ]
    .join(" ")
    .toLowerCase();
}

export function mapAuditDoc(
  docSnap: QueryDocumentSnapshot<DocumentData>
): AuditLogRow {
  const data = docSnap.data();

  const action = readString(data, ["action", "event", "type", "name"]) ?? "unknown";
  const actionLabel = humanAction(action);

  const details = isRecord(data.details) ? data.details : {};
  const detailsText = safeJson(details).toLowerCase();

  const createdAt = readTimestamp(data, [
    "createdAt",
    "timestamp",
    "at",
    "updatedAt",
  ]);

  const actorUid = readString(data, ["actorUid", "actorId", "uid", "userUid"]);
  const actorEmail = readString(data, ["actorEmail", "email", "userEmail"]);

  const targetUid = readString(data, ["targetUid", "targetId"]);
  const targetEmail = readString(data, ["targetEmail", "targetUserEmail"]);

  const ipAddress = readString(data, ["ipAddress", "ip"]);
  const userAgent = readString(data, ["userAgent", "device"]);

  const category = getCategory(action, detailsText);
  const severity = getSeverity(action, category, detailsText);

  const baseLog: Omit<AuditLogRow, "searchableText"> = {
    id: docSnap.id,
    action,
    actionLabel,
    category,
    severity,
    riskScore: getRiskScore(action, category, severity, detailsText),

    actorUid,
    actorEmail,
    targetUid,
    targetEmail,

    ipAddress,
    userAgent,

    details,
    detailsText,

    createdAt,
    createdAtMs: createdAt?.toMillis?.() ?? 0,
  };

  return {
    ...baseLog,
    searchableText: buildSearchableText(baseLog),
  };
}

export function actionIcon(action: string) {
  const normalized = action.toLowerCase();
  const className = "h-4 w-4";

  if (normalized.includes("created")) {
    return <UserPlus className={className} aria-hidden />;
  }

  if (normalized.includes("role")) {
    return <UserCog className={className} aria-hidden />;
  }

  if (normalized.includes("disabled")) {
    return <UserMinus className={className} aria-hidden />;
  }

  if (
    normalized.includes("deleted") ||
    normalized.includes("clean") ||
    normalized.includes("purge") ||
    normalized.includes("reset")
  ) {
    return <Trash2 className={className} aria-hidden />;
  }

  if (normalized.includes("settings")) {
    return <Settings className={className} aria-hidden />;
  }

  if (
    normalized.includes("database") ||
    normalized.includes("report") ||
    normalized.includes("import") ||
    normalized.includes("rebuild")
  ) {
    return <Database className={className} aria-hidden />;
  }

  if (
    normalized.includes("denied") ||
    normalized.includes("failed") ||
    normalized.includes("unauthorized")
  ) {
    return <Ban className={className} aria-hidden />;
  }

  return <FileText className={className} aria-hidden />;
}