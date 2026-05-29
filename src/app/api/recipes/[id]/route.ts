import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { getIngredientAvailability } from "@/lib/availability";

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

  const ingredientAvailability = await getIngredientAvailability(recipe.id);

  return NextResponse.json({ ...recipe, ingredientAvailability });
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
