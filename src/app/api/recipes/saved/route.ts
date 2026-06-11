import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const saved = await prisma.savedRecipe.findMany({
    where: { userId: user.id },
    include: {
      recipe: {
        include: {
          author: { select: { displayName: true } },
          _count: { select: { ingredients: true } },
        },
      },
    },
    orderBy: { savedAt: "desc" },
  });

  return NextResponse.json(saved.map((s) => ({ ...s.recipe, savedAt: s.savedAt })));
}

const saveSchema = z.object({ recipeId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const body = await req.json();
  const parse = saveSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const saved = await prisma.savedRecipe.upsert({
    where: { userId_recipeId: { userId: user.id, recipeId: parse.data.recipeId } },
    create: { userId: user.id, recipeId: parse.data.recipeId },
    update: {},
  });

  return NextResponse.json(saved, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = session.user;

  const { searchParams } = new URL(req.url);
  const recipeId = searchParams.get("recipeId");
  if (!recipeId) return NextResponse.json({ error: "recipeId required" }, { status: 400 });

  await prisma.savedRecipe.deleteMany({ where: { userId: user.id, recipeId } });
  return new NextResponse(null, { status: 204 });
}
