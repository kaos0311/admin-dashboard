import { LocationRepository } from "@/repositories/postgres/location.repository";

export async function getLocationCount() {
  return LocationRepository.count();
}
