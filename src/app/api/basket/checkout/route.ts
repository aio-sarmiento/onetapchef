import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StockStatus } from "@prisma/client";
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

  // ── Query 1: all recipes at once ────────────────────────────────────────────
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: items.map((i) => i.recipeId) } },
    include: {
      ingredients: {
        include: { ingredient: { select: { category: true, purchasable: true } } },
      },
    },
  });
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  // ── Aggregate quantities ────────────────────────────────────────────────────
  const aggregated = new Map<
    string,
    { ingredientId: string; totalQty: number; unit: string; category: string }
  >();

  for (const item of items) {
    const recipe = recipeMap.get(item.recipeId);
    if (!recipe) continue;
    for (const ri of recipe.ingredients) {
      if (excluded.has(ri.ingredientId)) continue;
      if (!ri.ingredient.purchasable) continue;
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

  if (aggregated.size === 0) {
    return NextResponse.json(
      { error: "None of the required ingredients are currently available." },
      { status: 422 }
    );
  }

  // ── Query 2: all vendor stock at once ───────────────────────────────────────
  const allStock = await prisma.vendorStock.findMany({
    where: {
      ingredientId: { in: Array.from(aggregated.keys()) },
      status: { in: ACTIVE_STATUSES },
      expiryDate: { gte: today },
      quantityAvailable: { gt: 0 },
      vendor: { isAdminVerified: true },
    },
    orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
  });

  // Group by ingredient, keeping up to 5 per ingredient
  const stockByIngredient = new Map<string, typeof allStock>();
  for (const s of allStock) {
    const list = stockByIngredient.get(s.ingredientId) ?? [];
    if (list.length < 5) list.push(s);
    stockByIngredient.set(s.ingredientId, list);
  }

  // ── Score and group by best vendor ─────────────────────────────────────────
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

  for (const [, agg] of Array.from(aggregated)) {
    const all = stockByIngredient.get(agg.ingredientId) ?? [];
    if (all.length === 0) continue;

    const promoted = all.filter((s) => s.isPromoted);
    const pool = promoted.length > 0 ? promoted : all;

    const best = pool
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
