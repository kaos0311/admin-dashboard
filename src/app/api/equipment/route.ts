import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const equipment = await prisma.equipment.findMany({
    include: {
      model: {
        include: {
          manufacturer: true,
        },
      },
      location: true,
      customer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(equipment);
}
