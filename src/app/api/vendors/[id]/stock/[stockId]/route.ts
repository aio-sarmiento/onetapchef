import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recomputeAvailabilityForIngredient } from "@/lib/availability";

const updateSchema = z.object({
  quantityAvailable: z.number().min(0).optional(),
  pricePerUnit: z.number().min(0).optional(),
  packageSize: z.number().positive().optional(),
  isPromoted: z.boolean().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["available", "low", "sold_out"]).optional(),
});

async function getAuthorizedVendor(vendorId: string, userId: string) {
  const profile = await prisma.vendorProfile.findUnique({ where: { id: vendorId } });
  return profile?.userId === userId ? profile : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; stockId: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const vendor = await getAuthorizedVendor(params.id, user.id);
  if (!vendor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parse = updateSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const updateData: Record<string, unknown> = { ...parse.data };
  if (parse.data.expiryDate) updateData.expiryDate = new Date(parse.data.expiryDate);

  // Auto-compute status from quantity if not explicitly set
  if (parse.data.quantityAvailable !== undefined && parse.data.status === undefined) {
    const stock = await prisma.vendorStock.findUnique({ where: { id: params.stockId } });
    if (stock) {
      const pct = parse.data.quantityAvailable / Number(stock.originalQuantity);
      updateData.status = parse.data.quantityAvailable === 0 ? "sold_out" : pct < 0.2 ? "low" : "available";
    }
  }

  const updated = await prisma.vendorStock.update({
    where: { id: params.stockId },
    data: updateData,
    include: { ingredient: true },
  });

  await recomputeAvailabilityForIngredient(updated.ingredientId);

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; stockId: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const vendor = await getAuthorizedVendor(params.id, user.id);
  if (!vendor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stock = await prisma.vendorStock.findUnique({ where: { id: params.stockId } });
  if (!stock) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ingredientId = stock.ingredientId;
  await prisma.vendorStock.delete({ where: { id: params.stockId } });
  await recomputeAvailabilityForIngredient(ingredientId);

  return new NextResponse(null, { status: 204 });
}
