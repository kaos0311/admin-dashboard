import { FieldValue, getFirestore } from "firebase-admin/firestore";

import type { AdminAuditEntryInput } from "./auditTypes.js";

const AUDIT_LOGS_COLLECTION = "auditLogs";

/**
 * Write an immutable audit entry to Firestore.
 *
 * This function is only callable from within Cloud Functions — never
 * directly from the client. Audit entries are write-once, read-only.
 *
 * @param input - The audit entry payload
 */
export async function writeAuditEntry(
  input: AdminAuditEntryInput
): Promise<void> {
  const db = getFirestore();

  const payload: Record<string, unknown> = {
    action: input.action,

    performedByUid: input.performedByUid,
    performedByEmail: input.performedByEmail,

    targetUid: input.targetUid ?? null,
    targetEmail: input.targetEmail ?? null,

    details: input.details ?? {},

    timestamp: FieldValue.serverTimestamp(),

    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,

    success: input.success ?? true,
    failureReason: input.failureReason ?? null,
  };

  await db.collection(AUDIT_LOGS_COLLECTION).add(payload);
}
