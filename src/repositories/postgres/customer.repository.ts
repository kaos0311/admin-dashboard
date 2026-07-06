import { prisma } from "@/lib/prisma";

export const CustomerRepository = {
  async count() {
    return prisma.customer.count();
  },
};
