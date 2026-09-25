import { AuditLogRepository } from "@/repositories/postgres/audit-log.repository";

export type AuditLogInput = {
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  success?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await AuditLogRepository.create({
    userId: input.userId ?? null,
    userEmail: input.userEmail ?? null,
    userRole: input.userRole ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    success: input.success ?? true,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    metadata: input.metadata ?? null,
  });
}
