import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

function toJsonValue(value: Record<string, unknown> | null): Prisma.InputJsonValue | undefined {
  if (value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const AuditLogRepository = {
  async create(data: {
    userId: string | null;
    userEmail: string | null;
    userRole: string | null;
    action: string;
    entityType: string | null;
    entityId: string | null;
    success: boolean;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: Record<string, unknown> | null;
  }) {
    return prisma.auditLog.create({
      data: {
        userId: data.userId,
        userEmail: data.userEmail,
        userRole: data.userRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        success: data.success,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: toJsonValue(data.metadata),
      },
    });
  },

  async findMany(options?: { take?: number; skip?: number }) {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: options?.take ?? 100,
      skip: options?.skip ?? 0,
    });
  },
};
