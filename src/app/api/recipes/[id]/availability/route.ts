import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const recipe = await prisma.recipe.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }], isPublished: true },
    select: { id: true },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recipeIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId: recipe.id },
    include: {
      ingredient: {
        include: {
          stock: {
            where: {
              status: { in: ["available", "low"] },
              expiryDate: { gte: today },
              quantityAvailable: { gt: 0 },
            },
            include: { vendor: { select: { id: true, businessName: true } } },
            orderBy: [{ status: "asc" }, { pricePerUnit: "asc" }],
            take: 3,
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const availability = recipeIngredients.map((ri) => ({
    id: ri.id,
    ingredientId: ri.ingredientId,
    ingredientName: ri.ingredient.name,
    category: ri.ingredient.category,
    quantity: Number(ri.quantity),
    unit: ri.unit,
    isOptional: ri.isOptional,
    preparationNote: ri.preparationNote,
    sortOrder: ri.sortOrder,
    availability:
      ri.ingredient.stock.length === 0
        ? ("unavailable" as const)
        : ri.ingredient.stock[0].status === "low"
        ? ("low" as const)
        : ("available" as const),
    bestStock: ri.ingredient.stock[0] ?? null,
    allStock: ri.ingredient.stock,
  }));

  return NextResponse.json(availability);
}
