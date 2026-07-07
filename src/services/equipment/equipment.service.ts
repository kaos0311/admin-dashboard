import { EquipmentRepository } from "@/repositories/postgres/equipment.repository";

export async function getEquipment() {
  return EquipmentRepository.getAll();
}

export async function createEquipmentRecord(formData: FormData) {
  return EquipmentRepository.create({
    assetTag: String(formData.get("assetTag")),
    serialNumber: String(formData.get("serialNumber") || ""),
    condition: String(formData.get("condition") || ""),
    notes: String(formData.get("notes") || ""),
    modelId: Number(formData.get("modelId")),
    locationId: Number(formData.get("locationId")),
    status: "AVAILABLE",
  });
}
