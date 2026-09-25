import { EquipmentModelRepository } from "@/repositories/postgres/equipment-model.repository";

export async function getAllEquipmentModels() {
  return EquipmentModelRepository.getAll();
}

export async function getEquipmentModelCount() {
  return EquipmentModelRepository.count();
}
