import { NextRequest, NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/require-api-auth";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getEquipment } from "@/services/equipment/equipment.service";

export async function GET(request: NextRequest) {
  const ipRateLimit = await enforceRateLimit({
    request,
    policyName: "general",
    scope: "ip",
  });
  if (ipRateLimit) return ipRateLimit;

  const auth = await requireApiPermission(request, "inventory:read");
  if (!auth.ok) return auth.response;

  const userRateLimit = await enforceRateLimit({
    request,
    policyName: "general",
    scope: "user",
    identifier: auth.uid,
  });
  if (userRateLimit) return userRateLimit;

  const equipment = await getEquipment();

  return NextResponse.json(equipment);
}
