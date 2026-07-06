import { prisma } from "@/lib/prisma";

export const LocationRepository = {
  async count() {
    return prisma.location.count();
  },
};
