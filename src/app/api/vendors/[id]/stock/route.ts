import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recomputeAvailabilityForIngredient } from "@/lib/availability";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const stock = await prisma.vendorStock.findMany({
    where: { vendorId: params.id },
    include: { ingredient: true },
    orderBy: { expiryDate: "asc" },
  });
  return NextResponse.json(stock);
}

const createStockSchema = z.object({
  ingredientId: z.string().uuid(),
  quantityAvailable: z.number().positive(),
  unit: z.string().min(1),
  pricePerUnit: z.number().min(0),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const vendorProfile = await prisma.vendorProfile.findUnique({ where: { id: params.id } });
  if (!vendorProfile || vendorProfile.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!vendorProfile.isAdminVerified) {
    return NextResponse.json({ error: "Vendor account not yet verified" }, { status: 403 });
  }

  const body = await req.json();
  const parse = createStockSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { ingredientId, quantityAvailable, unit, pricePerUnit, expiryDate } = parse.data;

  const stock = await prisma.vendorStock.create({
    data: {
      vendorId: params.id,
      ingredientId,
      quantityAvailable,
      originalQuantity: quantityAvailable,
      unit,
      pricePerUnit,
      expiryDate: new Date(expiryDate),
      status: "available",
    },
    include: { ingredient: true },
  });

  // Update availability scores for all recipes using this ingredient
  await recomputeAvailabilityForIngredient(ingredientId);

  return NextResponse.json(stock, { status: 201 });
}
