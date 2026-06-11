import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, StockStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { scaleQuantity } from "@/lib/utils";
import { roundToPacks, scoreVendorOption } from "@/lib/vendor-units";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  items: z.array(z.object({
    recipeId: z.string().uuid(),
    servings: z.number().int().min(1),
  })).min(1),
  excludedIngredientIds: z.array(z.string()).default([]),
});

export type PreviewAlternative = {
  vendorId: string;
  vendorName: string;
  packLabel: string;
  lineTotal: number;
};

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
    alternatives: PreviewAlternative[];
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

  // ── Query 1: fetch all recipes in one go ────────────────────────────────────
  const recipes = await prisma.recipe.findMany({
    where: { id: { in: items.map((i) => i.recipeId) } },
    include: {
      ingredients: {
        include: { ingredient: { select: { name: true, category: true, purchasable: true } } },
      },
    },
  });
  const recipeMap = new Map(recipes.map((r) => [r.id, r]));

  // ── Aggregate ingredient quantities across all basket recipes ───────────────
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

  const ingredientIds = Array.from(aggregated.keys());

  // ── Query 2: fetch all vendor stock for all ingredients in one go ───────────
  const allStock = await prisma.vendorStock.findMany({
    where: {
      ingredientId: { in: ingredientIds },
      status: { in: ACTIVE_STATUSES },
      expiryDate: { gte: today },
      quantityAvailable: { gt: 0 },
      vendor: { isAdminVerified: true },
    },
    include: { vendor: vendorSelect },
    orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
  }) as StockCandidate[];

  // Group stock by ingredient, keeping up to 5 per ingredient
  const stockByIngredient = new Map<string, StockCandidate[]>();
  for (const s of allStock) {
    const list = stockByIngredient.get(s.ingredientId) ?? [];
    if (list.length < 5) list.push(s);
    stockByIngredient.set(s.ingredientId, list);
  }

  // ── Score and select best vendor per ingredient (all in memory) ─────────────
  const vendorMap = new Map<string, {
    vendor: StockCandidate["vendor"];
    lines: PreviewVendorGroup["lineItems"][number][];
  }>();

  for (const [, agg] of Array.from(aggregated)) {
    const all = stockByIngredient.get(agg.ingredientId) ?? [];
    if (all.length === 0) continue;

    // Prefer promoted stock; fall back to all if none promoted
    const promoted = all.filter((s) => s.isPromoted);
    const pool = promoted.length > 0 ? promoted : all;

    type Scored = { stock: StockCandidate; score: number; totalCost: number; packLabel: string };
    const scored: Scored[] = pool.map((s) => {
      const pkgSize = Number(s.packageSize);
      const pricePer100g = Number(s.pricePerUnit);
      const { totalQty: orderedQty, packLabel } = roundToPacks(agg.totalQty, agg.category, pkgSize);
      const totalCost = (orderedQty / 100) * pricePer100g;
      const score = scoreVendorOption(agg.totalQty, pkgSize, pricePer100g);
      return { stock: s, score, totalCost, packLabel };
    });
    scored.sort((a, b) => a.score - b.score);

    const best = scored[0];
    const alternatives: PreviewAlternative[] = scored.slice(1, 3).map((s) => ({
      vendorId: s.stock.vendor.id,
      vendorName: s.stock.vendor.businessName,
      packLabel: s.packLabel,
      lineTotal: Math.round(s.totalCost * 100) / 100,
    }));

    const entry = vendorMap.get(best.stock.vendor.id) ?? { vendor: best.stock.vendor, lines: [] };
    entry.lines.push({
      ingredientId: agg.ingredientId,
      ingredientName: agg.name,
      packLabel: best.packLabel,
      pricePerUnit: Number(best.stock.pricePerUnit),
      lineTotal: Math.round(best.totalCost * 100) / 100,
      alternatives,
    });
    vendorMap.set(best.stock.vendor.id, entry);
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
