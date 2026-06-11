import { prisma } from "@/lib/prisma";

/**
 * Recomputes availability_score for every recipe that uses the given ingredient.
 * Called whenever vendor_stock changes for that ingredient.
 */
export async function recomputeAvailabilityForIngredient(ingredientId: string) {
  // Find all recipes that have this ingredient as a required (non-optional) item
  const affectedRecipes = await prisma.recipeIngredient.findMany({
    where: { ingredientId, isOptional: false },
    select: { recipeId: true },
    distinct: ["recipeId"],
  });

  await Promise.all(
    affectedRecipes.map(({ recipeId }) => recomputeRecipeAvailability(recipeId))
  );
}

export async function recomputeRecipeAvailability(recipeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Count required ingredients and how many have live stock
  const [totalRequired, inStock] = await Promise.all([
    prisma.recipeIngredient.count({
      where: { recipeId, isOptional: false },
    }),
    prisma.recipeIngredient.count({
      where: {
        recipeId,
        isOptional: false,
        ingredient: {
          stock: {
            some: {
              status: { in: ["available", "low"] },
              expiryDate: { gte: today },
              quantityAvailable: { gt: 0 },
            },
          },
        },
      },
    }),
  ]);

  const score = totalRequired === 0 ? 0 : inStock / totalRequired;

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { availabilityScore: score },
  });

  return score;
}

/**
 * For a single recipe, returns per-ingredient availability with vendor info.
 * Used on the recipe detail page — always a live read, not the cached score.
 */
export async function getIngredientAvailability(recipeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const recipeIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId },
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

  return recipeIngredients.map((ri) => ({
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
}
