import { prisma } from "@/lib/prisma";

export const EquipmentModelRepository = {
  async getAll() {
    return prisma.equipmentModel.findMany({
      include: {
        manufacturer: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  },

  async count() {
    return prisma.equipmentModel.count();
  },
};
