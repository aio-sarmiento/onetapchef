"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
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
  const json = await res.json();
  return json.data ?? json; // handle both new {data,total} and legacy array
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map((recipe) => (
            <Card key={recipe.id} className="overflow-hidden hover:shadow-md transition-all group">
              {/* Image */}
              <div className="relative aspect-[4/3] bg-muted">
                {recipe.imageUrl ? (
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-brand-muted">
                    <ChefHat className="h-10 w-10 text-brand/30" />
                  </div>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white/85 hover:bg-white backdrop-blur-sm shadow-sm"
                >
                  <Link href={`/recipes/${recipe.slug}/edit`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <CardContent className="p-4 flex flex-col gap-2">
                <Link
                  href={`/recipes/${recipe.slug}`}
                  className="font-bold text-base hover:underline line-clamp-1"
                >
                  {recipe.title}
                </Link>
                <p className="text-sm text-muted-foreground line-clamp-2">{recipe.description}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline" className="text-xs">{recipe.category}</Badge>
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
