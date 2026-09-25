import { prisma } from "@/lib/prisma";

export const WorkOrderRepository = {
  async getAll() {
    return prisma.workOrder.findMany({
      include: {
        equipment: true,
      },
    });
  },

  async count() {
    return prisma.workOrder.count();
  },
};
