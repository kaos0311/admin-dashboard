import { prisma } from "@/lib/prisma";

export const ManufacturerRepository = {
  async getAll() {
    return prisma.manufacturer.findMany({
      orderBy: {
        name: "asc",
      },
    });
  },

  async count() {
    return prisma.manufacturer.count();
  },
};
