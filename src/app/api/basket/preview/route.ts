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

type CandidateVendor = { id: string; businessName: string; address: string; contactPhone: string | null };

type StockCandidate = Prisma.VendorStockGetPayload<{
  include: { vendor: typeof vendorSelect };
}>;

const ACTIVE_STATUSES: StockStatus[] = [StockStatus.available, StockStatus.low];

async function fetchCandidates(ingredientId: string, today: Date): Promise<StockCandidate[]> {
  const baseWhere: Prisma.VendorStockWhereInput = {
    ingredientId,
    status: { in: ACTIVE_STATUSES },
    expiryDate: { gte: today },
    quantityAvailable: { gt: 0 },
    vendor: { isAdminVerified: true },
  };

  const promoted = await prisma.vendorStock.findMany({
    where: { ...baseWhere, isPromoted: true },
    include: { vendor: vendorSelect },
    orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
    take: 5,
  });
  if (promoted.length > 0) return promoted;

  return prisma.vendorStock.findMany({
    where: baseWhere,
    include: { vendor: vendorSelect },
    orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
    take: 5,
  });
}

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

  // Aggregate scaled ingredient quantities across all recipes, skipping non-purchasable
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
          include: { ingredient: { select: { name: true, category: true, purchasable: true } } },
        },
      },
    });
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

  // For each ingredient: score all candidates by waste+cost, pick best + top-2 alternatives
  const vendorMap = new Map<string, {
    vendor: CandidateVendor;
    lines: PreviewVendorGroup["lineItems"][number][];
  }>();

  for (const [, agg] of Array.from(aggregated)) {
    const candidates = await fetchCandidates(agg.ingredientId, today);
    if (candidates.length === 0) continue;

    type Scored = {
      stock: StockCandidate;
      score: number;
      totalCost: number;
      packLabel: string;
    };

    const scored: Scored[] = candidates.map((s) => {
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
