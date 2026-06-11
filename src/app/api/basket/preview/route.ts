import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, StockStatus } from "@prisma/client";
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

const vendorSelect = {
  select: { id: true, businessName: true, address: true, contactPhone: true },
} satisfies Prisma.VendorProfileArgs;

type StockCandidate = Prisma.VendorStockGetPayload<{
  include: { vendor: typeof vendorSelect };
}>;

const ACTIVE_STATUSES: StockStatus[] = [StockStatus.available, StockStatus.low];

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

  // ── Query 1: all recipes at once ────────────────────────────────────────────
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: items.map((i) => i.recipeId) } },
    include: {
      ingredients: {
        include: { ingredient: { select: { name: true, category: true, purchasable: true } } },
      },
    },
  });
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  // ── Aggregate ingredient quantities ─────────────────────────────────────────
  const aggregated = new Map<string, {
    ingredientId: string;
    totalQty: number;
    unit: string;
    name: string;
    category: string;
  }>();

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
          name: ri.ingredient.name,
          category: ri.ingredient.category,
        });
      }
    }
  }

  if (aggregated.size === 0) {
    return NextResponse.json({ groups: [], grandTotal: 0 });
  }

  // ── Query 2: all vendor stock for all ingredients at once ───────────────────
  const allStock = await prisma.vendorStock.findMany({
    where: {
      ingredientId: { in: Array.from(aggregated.keys()) },
      status: { in: ACTIVE_STATUSES },
      expiryDate: { gte: today },
      quantityAvailable: { gt: 0 },
      vendor: { isAdminVerified: true },
    },
    include: { vendor: vendorSelect },
    orderBy: { pricePerUnit: "asc" },
  }) as StockCandidate[];

  // Group by ingredient
  const stockByIngredient = new Map<string, StockCandidate[]>();
  for (const s of allStock) {
    const list = stockByIngredient.get(s.ingredientId) ?? [];
    list.push(s);
    stockByIngredient.set(s.ingredientId, list);
  }

  // ── Pick cheapest total cost per ingredient (all in memory) ─────────────────
  const vendorMap = new Map<string, {
    vendor: StockCandidate["vendor"];
    lines: PreviewVendorGroup["lineItems"][number][];
  }>();

  for (const [, agg] of Array.from(aggregated)) {
    const candidates = stockByIngredient.get(agg.ingredientId) ?? [];
    if (candidates.length === 0) continue;

    // Pick vendor with lowest total spend for the required quantity
    let best = candidates[0];
    let bestTotal = Infinity;

    for (const s of candidates) {
      const { totalQty: orderedQty } = roundToPacks(agg.totalQty, agg.category, Number(s.packageSize));
      const totalCost = (orderedQty / 100) * Number(s.pricePerUnit);
      if (totalCost < bestTotal) {
        bestTotal = totalCost;
        best = s;
      }
    }

    const { totalQty: orderedQty, packLabel } = roundToPacks(agg.totalQty, agg.category, Number(best.packageSize));
    const lineTotal = Math.round((orderedQty / 100) * Number(best.pricePerUnit) * 100) / 100;

    const entry = vendorMap.get(best.vendor.id) ?? { vendor: best.vendor, lines: [] };
    entry.lines.push({
      ingredientId: agg.ingredientId,
      ingredientName: agg.name,
      packLabel,
      pricePerUnit: Number(best.pricePerUnit),
      lineTotal,
    });
    vendorMap.set(best.vendor.id, entry);
  }

  const groups: PreviewVendorGroup[] = Array.from(vendorMap.values()).map(({ vendor, lines }) => ({
    vendorId: vendor.id,
    vendorName: vendor.businessName,
    vendorAddress: vendor.address,
    vendorPhone: vendor.contactPhone,
    subtotal: Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100,
    lineItems: lines,
  }));

  const grandTotal = Math.round(groups.reduce((s, g) => s + g.subtotal, 0) * 100) / 100;

  return NextResponse.json({ groups, grandTotal });
}
