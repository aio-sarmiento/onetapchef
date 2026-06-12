import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
import { recomputeRecipeAvailability } from "@/lib/availability";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const cuisine = searchParams.get("cuisine");
  const dietary = searchParams.get("dietary");
  const minScore = parseFloat(searchParams.get("minScore") ?? "0");
  const sort = searchParams.get("sort") ?? "availability";
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "24"), 48);
  const authorId = searchParams.get("authorId");
  const source = searchParams.get("source"); // "user" | "themealdb" | null (all)

  // Resolve "me" author shorthand
  let resolvedAuthorId = authorId;
  if (authorId === "me") {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    resolvedAuthorId = session?.user?.id ?? null;
  }

  const where: Prisma.RecipeWhereInput = {
    ...(resolvedAuthorId ? { authorId: resolvedAuthorId } : { isPublished: true }),
    availabilityScore: { gte: minScore },
    ...(source && { source }),
    ...(category && { category }),
    ...(cuisine && { cuisine }),
    ...(dietary && { dietaryTags: { has: dietary } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
      ],
    }),
  };

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { ingredients: true, savedByUsers: true } },
      },
      orderBy:
        sort === "availability"
          ? { availabilityScore: "desc" }
          : sort === "newest"
          ? { createdAt: "desc" }
          : sort === "popular"
          ? { savedByUsers: { _count: "desc" } }
          : { viewCount: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.recipe.count({ where }),
  ]);

  return NextResponse.json({ data: recipes, total });
}

const ingredientSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  isOptional: z.boolean().default(false),
  preparationNote: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  baseServings: z.number().int().min(1).max(20),
  prepTimeMinutes: z.number().int().min(0),
  cookTimeMinutes: z.number().int().min(0),
  category: z.string().min(1),
  cuisine: z.string().min(1),
  dietaryTags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  instructions: z.array(z.string().min(1)).min(1),
  ingredients: z.array(ingredientSchema).min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const body = await req.json();
  const parse = createSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { ingredients, instructions, ...recipeData } = parse.data;

  // Generate a unique slug
  let slug = slugify(recipeData.title);
  const existing = await prisma.recipe.count({ where: { slug } });
  if (existing > 0) slug = `${slug}-${Date.now()}`;

  const recipe = await prisma.recipe.create({
    data: {
      ...recipeData,
      slug,
      instructions,
      authorId: user.id,
      ingredients: {
        create: ingredients.map((ing, i) => ({ ...ing, sortOrder: i })),
      },
    },
    include: { ingredients: { include: { ingredient: true } } },
  });

  // Compute initial availability score
  await recomputeRecipeAvailability(recipe.id);

  return NextResponse.json(recipe, { status: 201 });
}
