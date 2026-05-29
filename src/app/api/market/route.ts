import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stock = await prisma.vendorStock.findMany({
    where: {
      status: { in: ["available", "low"] },
      expiryDate: { gte: today },
      quantityAvailable: { gt: 0 },
      vendor: { isAdminVerified: true },
    },
    include: {
      ingredient: true,
      vendor: { select: { id: true, businessName: true, city: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  return NextResponse.json(stock);
}
