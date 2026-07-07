import { prisma } from "@/lib/prisma";

export const LocationRepository = {
  async getAll() {
    return prisma.location.findMany({
      orderBy: {
        name: "asc",
      },
    });
  },

  async count() {
    return prisma.location.count();
  },
};
