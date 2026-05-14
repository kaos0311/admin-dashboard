import { FieldValue } from "firebase-admin/firestore";
import { db } from "../imports/utils/firestore";

export type AuditAction =
  | "import_processed"
  | "import_failed"
  | "patient_created"
  | "patient_updated"
  | "patient_deleted"
  | "report_deleted"
  | "merge_requested"
  | "merge_completed"
  | "merge_failed"
  | "issue_created"
  | "issue_resolved"
  | "issue_ignored"
  | "reprocess_started"
  | "reprocess_completed"
  | "reprocess_failed"
  | "notification_created"
  | "user_role_changed"
  | "system_event";

export type AuditTargetType =
  | "patient"
  | "order"
  | "rental"
  | "inventory"
  | "report"
  | "importJob"
  | "mergeJob"
  | "dataQualityIssue"
  | "notification"
  | "user"
  | "system";

export interface AuditLogPayload {
  action: AuditAction;

  actorUid?: string | null;
  actorEmail?: string | null;

  targetType: AuditTargetType;
  targetId?: string | null;

  safeSummary: string;

  source?: string;
  metadata?: Record<string, unknown>;
}

function sanitizeText(value: string): string {
  return value
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]")
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[REDACTED_DATE]")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[REDACTED_DATE]")
    .slice(0, 500);
}

function sanitizeMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> {
  if (!metadata) return {};

  const blockedKeys = [
    "ssn",
    "socialSecurityNumber",
    "dob",
    "dateOfBirth",
    "birthDate",
    "address",
    "street",
    "insuranceId",
    "policyNumber",
    "medicareNumber",
    "medicaidNumber",
    "rawRow",
    "rawData",
    "patientName",
    "fullName",
  ];

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (blockedKeys.includes(key)) {
      clean[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "string") {
      clean[key] = sanitizeText(value);
      continue;
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      clean[key] = value;
      continue;
    }

    clean[key] = "[COMPLEX_VALUE_REDACTED]";
  }

  return clean;
}

export async function writeAuditLog(
  payload: AuditLogPayload
): Promise<void> {
  const safeSummary = sanitizeText(payload.safeSummary);

  await db.collection("auditLogs").add({
    action: payload.action,

    actorUid: payload.actorUid ?? "system",
    actorEmail: payload.actorEmail ?? "system",

    targetType: payload.targetType,
    targetId: payload.targetId ?? null,

    safeSummary,

    source: payload.source ?? "functions",
    metadata: sanitizeMetadata(payload.metadata),

    createdAt: FieldValue.serverTimestamp(),
  });
}