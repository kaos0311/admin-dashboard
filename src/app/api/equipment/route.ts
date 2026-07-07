import { NextResponse } from "next/server";

import { getEquipment } from "@/services/equipment/equipment.service";

export async function GET() {
  const equipment = await getEquipment();

  return NextResponse.json(equipment);
}

