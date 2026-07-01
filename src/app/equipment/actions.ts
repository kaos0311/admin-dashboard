"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function createEquipment(formData: FormData) {
  await prisma.equipment.create({
    data: {
      assetTag: String(formData.get("assetTag")),
      serialNumber: String(formData.get("serialNumber") || ""),
      condition: String(formData.get("condition") || ""),
      notes: String(formData.get("notes") || ""),
      modelId: Number(formData.get("modelId")),
      locationId: Number(formData.get("locationId")),
      status: "AVAILABLE",
    },
  });

  redirect("/equipment");
}
