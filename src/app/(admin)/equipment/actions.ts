"use server";

import { redirect } from "next/navigation";

import { createEquipmentRecord } from "@/services/equipment/equipment.service";

export async function createEquipment(formData: FormData) {
  await createEquipmentRecord(formData);

  redirect("/equipment");
}
