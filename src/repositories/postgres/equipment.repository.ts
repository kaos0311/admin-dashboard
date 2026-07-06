import { EquipmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const EquipmentRepository = {
  async getAll() {
    return prisma.equipment.findMany({
      include: {
        model: {
          include: {
            manufacturer: true,
          },
        },
        customer: true,
        location: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async count() {
    return prisma.equipment.count();
  },

  async countByStatus(status: EquipmentStatus) {
    return prisma.equipment.count({
      where: {
        status,
      },
    });
  },

  async getDashboardStats() {
    const [total, available, inUse, repair] = await Promise.all([
      prisma.equipment.count(),
      prisma.equipment.count({ where: { status: "AVAILABLE" } }),
      prisma.equipment.count({ where: { status: "IN_USE" } }),
      prisma.equipment.count({
        where: {
          OR: [{ status: "NEEDS_REPAIR" }, { status: "IN_REPAIR" }],
        },
      }),
    ]);

    return {
      total,
      available,
      inUse,
      repair,
    };
  },
};