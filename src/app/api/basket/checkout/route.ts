import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, StockStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { scaleQuantity } from "@/lib/utils";
import { roundToPacks, scoreVendorOption } from "@/lib/vendor-units";

const ACTIVE_STATUSES: StockStatus[] = [StockStatus.available, StockStatus.low];

const checkoutSchema = z.object({
  items: z.array(
    z.object({
      recipeId: z.string().uuid(),
      servings: z.number().int().min(1),
    })
  ).min(1),
  studentNote: z.string().max(500).optional(),
  deliveryType: z.enum(["pickup", "delivery"]).default("pickup"),
  deliveryAddress: z.string().max(300).optional(),
  excludedIngredientIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json();
  const parse = checkoutSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { items, studentNote, deliveryType, deliveryAddress, excludedIngredientIds } = parse.data;
  const excluded = new Set(excludedIngredientIds);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Aggregate scaled quantities, skipping non-purchasable and excluded ingredients
  const aggregated = new Map<
    string,
    { ingredientId: string; totalQty: number; unit: string; category: string }
  >();

  for (const item of items) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: item.recipeId },
      include: {
        ingredients: {
          include: { ingredient: { select: { category: true, purchasable: true } } },
        },
      },
    });
    if (!recipe) continue;

    for (const ri of recipe.ingredients) {
      if (excluded.has(ri.ingredientId)) continue;
      if (!ri.ingredient.purchasable) continue; // skip water, ice, etc.
      const scaled = scaleQuantity(Number(ri.quantity), recipe.baseServings, item.servings);
      const existing = aggregated.get(ri.ingredientId);
      if (existing) {
        existing.totalQty += scaled;
      } else {
        aggregated.set(ri.ingredientId, {
          ingredientId: ri.ingredientId,
          totalQty: scaled,
          unit: ri.unit,
          category: ri.ingredient.category,
        });
      }
    }
  }

  // Group by best vendor using waste+cost scoring
  const vendorGroups = new Map<
    string,
    Array<{
      ingredientId: string;
      stockId: string;
      quantityRequested: number;
      unit: string;
      pricePerUnit: number;
    }>
  >();

  const baseStockWhere: Prisma.VendorStockWhereInput = {
    status: { in: ACTIVE_STATUSES },
    expiryDate: { gte: today },
    quantityAvailable: { gt: 0 },
    vendor: { isAdminVerified: true },
  };

  for (const [, agg] of Array.from(aggregated)) {
    let candidates = await prisma.vendorStock.findMany({
      where: { ingredientId: agg.ingredientId, ...baseStockWhere, isPromoted: true },
      orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
      take: 5,
    });
    if (candidates.length === 0) {
      candidates = await prisma.vendorStock.findMany({
        where: { ingredientId: agg.ingredientId, ...baseStockWhere },
        orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
        take: 5,
      });
    }
    if (candidates.length === 0) continue;

    const best = candidates
      .map((s) => ({
        stock: s,
        score: scoreVendorOption(agg.totalQty, Number(s.packageSize), Number(s.pricePerUnit)),
      }))
      .sort((a, b) => a.score - b.score)[0].stock;

    const { totalQty: orderedQty } = roundToPacks(agg.totalQty, agg.category, Number(best.packageSize));
    const pricePerGram = Number(best.pricePerUnit) / 100;

    const group = vendorGroups.get(best.vendorId) ?? [];
    group.push({
      ingredientId: agg.ingredientId,
      stockId: best.id,
      quantityRequested: orderedQty,
      unit: agg.unit,
      pricePerUnit: pricePerGram,
    });
    vendorGroups.set(best.vendorId, group);
  }

  if (vendorGroups.size === 0) {
    return NextResponse.json(
      { error: "None of the required ingredients are currently available." },
      { status: 422 }
    );
  }

  const orders = await Promise.all(
    Array.from(vendorGroups.entries()).map(async ([vendorId, lineItems]) => {
      const estimatedTotal = lineItems.reduce(
        (sum, li) => sum + li.quantityRequested * li.pricePerUnit,
        0
      );

      return prisma.order.create({
        data: {
          studentId: user.id,
          vendorId,
          estimatedTotal,
          studentNote,
          deliveryType: deliveryType as "pickup" | "delivery",
          ...(deliveryType === "delivery" && deliveryAddress ? { deliveryAddress } : {}),
          items: {
            create: lineItems.map((li) => ({
              ingredientId: li.ingredientId,
              stockId: li.stockId,
              quantityRequested: li.quantityRequested,
              unit: li.unit,
              pricePerUnit: li.pricePerUnit,
            })),
          },
        },
        include: {
          vendor: { select: { businessName: true } },
          items: { include: { ingredient: { select: { name: true } } } },
        },
      });
    })
  );

  return NextResponse.json({ orders }, { status: 201 });
}
