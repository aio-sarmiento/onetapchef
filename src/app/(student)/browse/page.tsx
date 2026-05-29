"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/recipe-card";
import { cn } from "@/lib/utils";
import { useGlobalStockRealtime } from "@/hooks/use-stock-realtime";

const CATEGORIES = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const AVAILABILITY_FILTERS = [
  { label: "All recipes", value: "0" },
  { label: "Fully available", value: "1" },
  { label: "Mostly available", value: "0.5" },
];

type Recipe = {
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
};

async function fetchRecipes(params: URLSearchParams) {
  const res = await fetch(`/api/recipes?${params}`);
  if (!res.ok) throw new Error("Failed to load recipes");
  return res.json() as Promise<Recipe[]>;
}

export default function BrowsePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [minScore, setMinScore] = useState("0");

  const params = new URLSearchParams({
    q,
    minScore,
    sort: "availability",
    ...(category !== "All" && { category }),
  });

  useGlobalStockRealtime();

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", q, category, minScore],
    queryFn: () => fetchRecipes(params),
    staleTime: 30 * 1000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Showing recipes you can make with today&apos;s available stock.
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                category === cat
                  ? "bg-brand text-white border-transparent"
                  : "border-border hover:border-foreground"
              )}
            >
              {cat}
            </button>
          ))}

          <div className="ml-auto flex gap-2">
            {AVAILABILITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setMinScore(f.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                  minScore === f.value
                    ? "bg-brand text-white border-transparent"
                    : "border-border hover:border-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card h-72 animate-pulse" />
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No recipes found</p>
          <p className="text-sm mt-1">Try adjusting your filters or check back later when vendors add new stock.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{recipes.length} recipes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} {...recipe} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
