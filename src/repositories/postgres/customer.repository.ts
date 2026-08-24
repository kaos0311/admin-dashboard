import { prisma } from "@/lib/prisma";

export const CustomerRepository = {
  async getAll() {
    return prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },
    });
  },

  async count() {
    return prisma.customer.count();
  },
};
