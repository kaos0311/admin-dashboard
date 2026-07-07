import { LocationRepository } from "@/repositories/postgres/location.repository";

export async function getAllLocations() {
  return LocationRepository.getAll();
}

export async function getLocationCount() {
  return LocationRepository.count();
}
