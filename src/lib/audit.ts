/**
 * Lightweight helper that services can call to log audit events.
 * For server-side use only (API routes, services, server components).
 *
 * Usage:
 *   await audit("equipment_created", {
 *     userId: session.id,
 *     userEmail: session.email,
 *     userRole: session.role,
 *     entityType: "equipment",
 *     entityId: "123",
 *     metadata: { assetTag: "TAG-001" },
 *   });
 */
import { writeAuditLog, type AuditLogInput } from "@/services/audit-log/audit-log.service";

export async function audit(
  action: string,
  context?: {
    userId?: string | null;
    userEmail?: string | null;
    userRole?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    success?: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const input: AuditLogInput = {
    action,
    userId: context?.userId ?? null,
    userEmail: context?.userEmail ?? null,
    userRole: context?.userRole ?? null,
    entityType: context?.entityType ?? null,
    entityId: context?.entityId ?? null,
    success: context?.success ?? true,
    ipAddress: context?.ipAddress ?? null,
    userAgent: context?.userAgent ?? null,
    metadata: context?.metadata ?? null,
  };

  await writeAuditLog(input);
}
