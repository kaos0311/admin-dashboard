import { CustomerRepository } from "@/repositories/postgres/customer.repository";
import { EquipmentRepository } from "@/repositories/postgres/equipment.repository";
import { LocationRepository } from "@/repositories/postgres/location.repository";

export async function getDashboardSummary() {
  const [equipmentStats, locations, customers] = await Promise.all([
    EquipmentRepository.getDashboardStats(),
    LocationRepository.count(),
    CustomerRepository.count(),
  ]);

  return {
    ...equipmentStats,
    locations,
    customers,
  };
}
