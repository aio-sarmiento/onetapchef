import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { scaleQuantity } from "@/lib/utils";
import { roundToPacks } from "@/lib/vendor-units";

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

  // Step 1+2: Load all recipe ingredients and compute scaled quantities
  const aggregated = new Map<
    string,
    { ingredientId: string; totalQty: number; unit: string; category: string }
  >();

  for (const item of items) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: item.recipeId },
      include: { ingredients: { include: { ingredient: { select: { category: true } } } } },
    });
    if (!recipe) continue;

    for (const ri of recipe.ingredients) {
      if (excluded.has(ri.ingredientId)) continue;
      const scaled = scaleQuantity(
        Number(ri.quantity),
        recipe.baseServings,
        item.servings
      );
      const key = ri.ingredientId;
      const existing = aggregated.get(key);
      if (existing) {
        existing.totalQty += scaled;
      } else {
        aggregated.set(key, {
          ingredientId: ri.ingredientId,
          totalQty: scaled,
          unit: ri.unit,
          category: ri.ingredient.category,
        });
      }
    }
  }

  // Step 3: For each ingredient, find the best vendor stock
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
    const stock = await prisma.vendorStock.findFirst({
      where: {
        ingredientId: agg.ingredientId,
        status: { in: ["available", "low"] },
        expiryDate: { gte: today },
        quantityAvailable: { gt: 0 },
        vendor: { isAdminVerified: true },
      },
      orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
    });

    if (!stock) continue; // ingredient not available — skip

    // Round up to nearest vendor pack
    const { totalQty: orderedQty } = roundToPacks(agg.totalQty, agg.category);

    // pricePerUnit stored as €/100g — convert to €/g for order line items
    const pricePerGram = Number(stock.pricePerUnit) / 100;

    const vendorId = stock.vendorId;
    const group = vendorGroups.get(vendorId) ?? [];
    group.push({
      ingredientId: agg.ingredientId,
      stockId: stock.id,
      quantityRequested: orderedQty,
      unit: agg.unit,
      pricePerUnit: pricePerGram,
    });
    vendorGroups.set(vendorId, group);
  }

  if (vendorGroups.size === 0) {
    return NextResponse.json(
      { error: "None of the required ingredients are currently available." },
      { status: 422 }
    );
  }

  // Step 4: Create one Order per vendor
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
