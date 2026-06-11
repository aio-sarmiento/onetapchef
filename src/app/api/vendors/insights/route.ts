import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const vendor = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!vendor) return NextResponse.json({ error: "Not a vendor" }, { status: 403 });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Top requested ingredients (across all vendors, last 7 days)
  const topIngredients = await prisma.orderItem.groupBy({
    by: ["ingredientId"],
    _count: { id: true },
    _sum: { quantityRequested: true },
    where: { order: { createdAt: { gte: since } } },
    orderBy: { _count: { id: "desc" } },
    take: 8,
  });

  const ingredientDetails = await prisma.ingredient.findMany({
    where: { id: { in: topIngredients.map((i) => i.ingredientId) } },
    select: { id: true, name: true, category: true },
  });

  const ingredientMap = new Map(ingredientDetails.map((i) => [i.id, i]));

  const topIngredientsWithNames = topIngredients.map((ti) => ({
    ...ingredientMap.get(ti.ingredientId),
    orderCount: ti._count.id,
    totalQty: Number(ti._sum.quantityRequested ?? 0),
    inMyStock: false,
  }));

  // Check which of these the vendor already stocks
  const myStock = await prisma.vendorStock.findMany({
    where: {
      vendorId: vendor.id,
      ingredientId: { in: topIngredients.map((i) => i.ingredientId) },
      status: { in: ["available", "low"] },
    },
    select: { ingredientId: true },
  });
  const myStockedIds = new Set(myStock.map((s) => s.ingredientId));

  topIngredientsWithNames.forEach((item) => {
    if (item.id) item.inMyStock = myStockedIds.has(item.id);
  });

  // Top recipes by recent orders (last 7 days, by basket items ordered)
  const topRecipeItems = await prisma.basketItem.groupBy({
    by: ["recipeId"],
    _count: { id: true },
    where: { addedAt: { gte: since } },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const recipeDetails = await prisma.recipe.findMany({
    where: { id: { in: topRecipeItems.map((r) => r.recipeId) }, isPublished: true },
    select: { id: true, title: true, slug: true, availabilityScore: true, category: true },
  });

  const recipeMap = new Map(recipeDetails.map((r) => [r.id, r]));
  const topRecipes = topRecipeItems
    .map((tr) => ({ ...recipeMap.get(tr.recipeId), addCount: tr._count.id }))
    .filter((r) => r.id);

  return NextResponse.json({ topIngredients: topIngredientsWithNames, topRecipes });
}
