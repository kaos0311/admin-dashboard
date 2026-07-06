import { ManufacturerRepository } from "@/repositories/postgres/manufacturer.repository";

export async function getAllManufacturers() {
  return ManufacturerRepository.getAll();
}

export async function getManufacturerCount() {
  return ManufacturerRepository.count();
}
