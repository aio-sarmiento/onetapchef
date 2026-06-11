"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PlusCircle, ChefHat, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Recipe = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  category: string;
  availabilityScore: number;
  createdAt: string;
  _count: { ingredients: number };
};

async function fetchMyRecipes(): Promise<Recipe[]> {
  const meRes = await fetch("/api/auth/me");
  const me = await meRes.json();
  const res = await fetch(`/api/recipes?authorId=${me.id}&limit=48`);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

function AvailabilityDot({ score }: { score: number }) {
  const s = Number(score);
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full",
      s >= 1 ? "bg-green-500" : s >= 0.5 ? "bg-yellow-400" : "bg-red-400"
    )} />
  );
}

export default function MyRecipesPage() {
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["my-recipes"],
    queryFn: fetchMyRecipes,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Recipes</h1>
          <p className="text-muted-foreground mt-1">Recipes you have created.</p>
        </div>
        <Button asChild variant="brand">
          <Link href="/recipes/new">
            <PlusCircle className="h-4 w-4 mr-2" />
            New recipe
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl border bg-muted animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-24 flex flex-col items-center gap-4">
          <div className="bg-brand-muted rounded-full p-6">
            <ChefHat className="h-12 w-12 text-brand" />
          </div>
          <h2 className="text-xl font-semibold">No recipes yet</h2>
          <p className="text-muted-foreground max-w-xs">
            Share your first recipe and help other students cook with local produce.
          </p>
          <Button asChild variant="brand">
            <Link href="/recipes/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create your first recipe
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link href={`/recipes/${recipe.slug}`} className="font-semibold hover:underline line-clamp-1 text-base">
                      {recipe.title}
                    </Link>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{recipe.description}</p>
                  </div>
                  <Button asChild variant="ghost" size="icon" className="shrink-0">
                    <Link href={`/recipes/${recipe.slug}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{recipe.category}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AvailabilityDot score={recipe.availabilityScore} />
                    {Math.round(Number(recipe.availabilityScore) * 100)}% available
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {recipe._count.ingredients} ingredients
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
