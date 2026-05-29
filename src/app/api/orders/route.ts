import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const role = user.user_metadata?.role as string;

  if (role === "vendor") {
    const vendorProfile = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
    if (!vendorProfile) return NextResponse.json([]);

    const orders = await prisma.order.findMany({
      where: { vendorId: vendorProfile.id },
      include: {
        student: { select: { displayName: true, email: true } },
        items: { include: { ingredient: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  }

  // Student
  const orders = await prisma.order.findMany({
    where: { studentId: user.id },
    include: {
      vendor: { select: { businessName: true, city: true, contactPhone: true } },
      items: { include: { ingredient: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
