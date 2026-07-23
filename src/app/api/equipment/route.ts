import { NextRequest, NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/require-api-auth";
import { getEquipment } from "@/services/equipment/equipment.service";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission(request, "inventory:read");
  if (!auth.ok) return auth.response;

  const equipment = await getEquipment();

  return NextResponse.json(equipment);
}
