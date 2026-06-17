import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

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
    // Strip pickupPin — vendors should not see it, only students do
    const safe = orders.map(({ pickupPin: _pin, ...o }) => o);
    return NextResponse.json(safe);
  }

  // Student
  const orders = await prisma.order.findMany({
    where: { studentId: user.id },
    include: {
      vendor: { select: { businessName: true, city: true, address: true, contactPhone: true } },
      items: { include: { ingredient: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}
