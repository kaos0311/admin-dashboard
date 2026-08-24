import { EquipmentRepository } from "@/repositories/postgres/equipment.repository";
import { audit } from "@/lib/audit";

export async function getEquipment() {
  return EquipmentRepository.getAll();
}

export async function createEquipmentRecord(formData: FormData) {
  const assetTag = String(formData.get("assetTag"));

  const equipment = await EquipmentRepository.create({
    assetTag,
    serialNumber: String(formData.get("serialNumber") || ""),
    condition: String(formData.get("condition") || ""),
    notes: String(formData.get("notes") || ""),
    modelId: Number(formData.get("modelId")),
    locationId: Number(formData.get("locationId")),
    status: "AVAILABLE",
  });

  await audit("equipment_created", {
    entityType: "equipment",
    entityId: String(equipment.id),
    metadata: { assetTag },
  });

  return equipment;
}
