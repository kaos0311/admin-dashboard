import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export type AuditAction =
  | "user_created"
  | "user_updated"
  | "user_disabled"
  | "user_enabled"
  | "role_updated"
  | "report_uploaded"
  | "report_deleted"
  | "product_created"
  | "product_updated"
  | "product_deleted"
  | "order_created"
  | "order_updated"
  | "order_archived"
  | "rental_created"
  | "rental_updated"
  | "rental_payment_recorded"
  | "settings_updated"
  | "login"
  | "logout"
  | "wip_review_updated"
  | "wip_notes_updated"
  | "wip_deleted"
  | "wip_bulk_deleted"
  | "wip_restore_deleted"
  | "custom";

export type AuditLogDetails = Record<string, unknown>;

export type AuditLogRecord = {
  id?: string;
  action: AuditAction;
  actorUid: string;
  actorEmail: string | null;
  targetUid: string | null;
  targetEmail: string | null;
  details: AuditLogDetails;
  createdAt?: Timestamp | { toDate?: () => Date };
};

type WriteAuditLogParams = {
  action: AuditAction;
  actorUid?: string;
  actorEmail?: string | null;
  targetUid?: string | null;
  targetEmail?: string | null;
  details?: AuditLogDetails;
};

function cleanAuditDetails(details: AuditLogDetails): AuditLogDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
}

export async function writeAuditLog({
  action,
  actorUid,
  actorEmail,
  targetUid = null,
  targetEmail = null,
  details = {},
}: WriteAuditLogParams): Promise<void> {
  const user = auth.currentUser;

  await addDoc(collection(db, "auditLogs"), {
    action,
    actorUid: actorUid ?? user?.uid ?? "unknown",
    actorEmail: actorEmail ?? user?.email ?? null,
    targetUid,
    targetEmail,
    details: cleanAuditDetails(details),
    createdAt: serverTimestamp(),
  });
}

export function formatAuditTimestamp(
  value: Timestamp | { toDate?: () => Date } | undefined
): string {
  if (!value) return "-";

  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  return "-";
}

export function stringifyAuditDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "-";

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return "-";
  }
}