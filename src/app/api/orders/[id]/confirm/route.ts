import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const confirmSchema = z.object({
  confirmedItems: z.array(
    z.object({
      orderItemId: z.string().uuid(),
      quantityConfirmed: z.number().min(0),
    })
  ),
  vendorNote: z.string().max(500).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { vendor: true, items: true },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.vendor.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "pending") return NextResponse.json({ error: "Order is not pending" }, { status: 400 });

  const body = await req.json();
  const parse = confirmSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { confirmedItems, vendorNote } = parse.data;

  // Update each line item
  await Promise.all(
    confirmedItems.map((ci) =>
      prisma.orderItem.update({
        where: { id: ci.orderItemId },
        data: { quantityConfirmed: ci.quantityConfirmed },
      })
    )
  );

  // Decrement vendor stock for confirmed quantities
  await Promise.all(
    order.items.map(async (item) => {
      const confirmed = confirmedItems.find((ci) => ci.orderItemId === item.id);
      if (!confirmed || confirmed.quantityConfirmed === 0) return;

      const stock = await prisma.vendorStock.findUnique({ where: { id: item.stockId } });
      if (!stock) return;

      const newQty = Math.max(0, Number(stock.quantityAvailable) - confirmed.quantityConfirmed);
      const pct = newQty / Number(stock.originalQuantity);
      const newStatus = newQty === 0 ? "sold_out" : pct < 0.2 ? "low" : "available";

      await prisma.vendorStock.update({
        where: { id: stock.id },
        data: { quantityAvailable: newQty, status: newStatus },
      });
    })
  );

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: "confirmed", vendorNote },
    include: { items: { include: { ingredient: { select: { name: true } } } } },
  });

  return NextResponse.json(updated);
}
