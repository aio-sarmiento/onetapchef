import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { scaleQuantity } from "@/lib/utils";
import { roundToPacks } from "@/lib/vendor-units";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  items: z.array(z.object({
    recipeId: z.string().uuid(),
    servings: z.number().int().min(1),
  })).min(1),
  excludedIngredientIds: z.array(z.string()).default([]),
});

export type PreviewVendorGroup = {
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string | null;
  subtotal: number;
  lineItems: {
    ingredientId: string;
    ingredientName: string;
    packLabel: string;
    pricePerUnit: number;
    lineTotal: number;
  }[];
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const parse = previewSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { items, excludedIngredientIds } = parse.data;
  const excluded = new Set(excludedIngredientIds);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aggregate scaled ingredient quantities across all recipes
  const aggregated = new Map<string, {
    ingredientId: string;
    totalQty: number;
    unit: string;
    name: string;
    category: string;
  }>();

  for (const item of items) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: item.recipeId },
      include: {
        ingredients: {
          include: { ingredient: { select: { name: true, category: true } } },
        },
      },
    });
    if (!recipe) continue;

    for (const ri of recipe.ingredients) {
      if (excluded.has(ri.ingredientId)) continue;
      const scaled = scaleQuantity(Number(ri.quantity), recipe.baseServings, item.servings);
      const existing = aggregated.get(ri.ingredientId);
      if (existing) {
        existing.totalQty += scaled;
      } else {
        aggregated.set(ri.ingredientId, {
          ingredientId: ri.ingredientId,
          totalQty: scaled,
          unit: ri.unit,
          name: ri.ingredient.name,
          category: ri.ingredient.category,
        });
      }
    }
  }

  // Group by best vendor, applying minimum pack rounding
  const vendorMap = new Map<string, {
    vendor: { id: string; businessName: string; address: string; contactPhone: string | null };
    lines: PreviewVendorGroup["lineItems"][number][];
  }>();

  for (const [, agg] of Array.from(aggregated)) {
    const stock = await prisma.vendorStock.findFirst({
      where: {
        ingredientId: agg.ingredientId,
        status: { in: ["available", "low"] },
        expiryDate: { gte: today },
        quantityAvailable: { gt: 0 },
        vendor: { isAdminVerified: true },
      },
      include: { vendor: { select: { id: true, businessName: true, address: true, contactPhone: true } } },
      orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
    });
    if (!stock) continue;

    // pricePerUnit is stored as €/100g — divide by 100 to get €/g
    const pricePer100g = Number(stock.pricePerUnit);

    // Round up to nearest vendor pack
    const { totalQty: orderedQty, packLabel } = roundToPacks(agg.totalQty, agg.category);
    const lineTotal = (orderedQty / 100) * pricePer100g;

    const entry = vendorMap.get(stock.vendorId) ?? { vendor: stock.vendor, lines: [] };
    entry.lines.push({
      ingredientId: agg.ingredientId,
      ingredientName: agg.name,
      packLabel,
      pricePerUnit: pricePer100g,
      lineTotal,
    });
    vendorMap.set(stock.vendorId, entry);
  }

  const groups: PreviewVendorGroup[] = Array.from(vendorMap.values()).map(({ vendor, lines }) => ({
    vendorId: vendor.id,
    vendorName: vendor.businessName,
    vendorAddress: vendor.address,
    vendorPhone: vendor.contactPhone,
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    lineItems: lines,
  }));

  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0);

  return NextResponse.json({ groups, grandTotal });
}
