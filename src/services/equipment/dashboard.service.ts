import { prisma } from "@/lib/prisma";
import { EquipmentRepository } from "@/repositories/postgres/equipment.repository";

export async function getDashboardSummary() {
  const stats = await EquipmentRepository.getDashboardStats();

  const [locations, customers] = await Promise.all([
    prisma.location.count(),
    prisma.customer.count(),
  ]);

  return {
    ...stats,
    locations,
    customers,
  };
}
