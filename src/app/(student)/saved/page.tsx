"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, ShoppingBasket } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { useBasketStore } from "@/stores/basket-store";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

type SavedRecipe = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  baseServings: number;
  category: string;
  availabilityScore: number;
  author: { displayName: string };
  savedAt: string;
};

export default function SavedRecipesPage() {
  const qc = useQueryClient();
  const { addItem, hasItem } = useBasketStore();

  const { data: recipes = [], isLoading } = useQuery<SavedRecipe[]>({
    queryKey: ["saved-recipes"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/saved");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      await fetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-recipes"] }),
  });

  function handleAddAll() {
    const toAdd = recipes.filter((r) => !hasItem(r.id));
    toAdd.forEach((r) => addItem({
      recipeId: r.id, slug: r.slug, title: r.title,
      imageUrl: r.imageUrl, baseServings: r.baseServings,
    }));
    toast({ title: `${toAdd.length} recipe${toAdd.length !== 1 ? "s" : ""} added to basket` });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Recipes</h1>
          <p className="text-muted-foreground mt-1">Recipes you&apos;ve hearted.</p>
        </div>
        {recipes.length > 0 && (
          <Button variant="brand" size="sm" onClick={handleAddAll}>
            <ShoppingBasket className="h-4 w-4 mr-1.5" />
            Add all to basket
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl border bg-muted animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-24 flex flex-col items-center gap-4">
          <div className="bg-brand-muted rounded-full p-6">
            <Heart className="h-12 w-12 text-brand" />
          </div>
          <h2 className="text-xl font-semibold">Nothing saved yet</h2>
          <p className="text-muted-foreground max-w-xs text-sm">
            Tap the ❤️ on any recipe in Browse to save it here for later.
          </p>
          <Button asChild variant="brand">
            <Link href="/browse">Browse recipes</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              {...recipe}
              isSaved
              onSaveToggle={() => unsaveMutation.mutate(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
