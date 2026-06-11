import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { recomputeRecipeAvailability } from "@/lib/availability";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const recipe = await prisma.recipe.findFirst({
    where: {
      OR: [{ id: params.id }, { slug: params.id }],
      isPublished: true,
    },
    include: {
      author: { select: { id: true, displayName: true, avatarUrl: true } },
    },
  });

  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Increment view count (fire-and-forget)
  prisma.recipe.update({ where: { id: recipe.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return NextResponse.json(recipe);
}

const ingredientSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  isOptional: z.boolean().default(false),
  preparationNote: z.string().optional(),
});

const editSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(500).optional(),
  baseServings: z.number().int().min(1).max(20).optional(),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  category: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  dietaryTags: z.array(z.string()).optional(),
  imageUrl: z.string().url().nullable().optional(),
  instructions: z.array(z.string().min(1)).min(1).optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const recipe = await prisma.recipe.findFirst({
    where: { OR: [{ id: params.id }, { slug: params.id }] },
  });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.user_metadata?.role === "admin";
  if (recipe.authorId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parse = editSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { ingredients, instructions, ...fields } = parse.data;

  const updated = await prisma.recipe.update({
    where: { id: recipe.id },
    data: {
      ...fields,
      ...(instructions ? { instructions } : {}),
      ...(ingredients
        ? {
            ingredients: {
              deleteMany: {},
              create: ingredients.map((ing, i) => ({ ...ing, sortOrder: i })),
            },
          }
        : {}),
    },
  });

  await recomputeRecipeAvailability(recipe.id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const recipe = await prisma.recipe.findUnique({ where: { id: params.id } });
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.user_metadata?.role === "admin";
  if (recipe.authorId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.recipe.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
