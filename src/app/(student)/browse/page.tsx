"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, SlidersHorizontal, ShoppingBasket, PlusCircle, CheckSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { cn } from "@/lib/utils";
import { useGlobalStockRealtime } from "@/hooks/use-stock-realtime";
import { useBasketStore } from "@/stores/basket-store";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const CATEGORIES = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const DIETARY_OPTIONS = [
  { label: "All", value: "" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
];
const CUISINE_OPTIONS = [
  "All", "American", "British", "Chinese", "French", "Indian",
  "Italian", "Japanese", "Mexican", "Spanish", "Thai",
];
const AVAILABILITY_FILTERS = [
  { label: "Any availability", value: "0" },
  { label: "Mostly available", value: "0.5" },
  { label: "Fully available", value: "1" },
];

const PAGE_SIZE = 12;

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

type RecipePage = { data: Recipe[]; total: number };

async function fetchRecipesPage(
  params: URLSearchParams,
  page: number
): Promise<RecipePage> {
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  const res = await fetch(`/api/recipes?${params}`);
  if (!res.ok) throw new Error("Failed to load recipes");
  return res.json();
}

export default function BrowsePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [cuisine, setCuisine] = useState("All");
  const [dietary, setDietary] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { addItem, hasItem } = useBasketStore();
  const loaderRef = useRef<HTMLDivElement | null>(null);

  useGlobalStockRealtime();

  // Saved recipe IDs for this user
  const { data: savedRecipes = [] } = useQuery<{ id: string }[]>({
    queryKey: ["saved-recipes"],
    queryFn: async () => {
      const res = await fetch("/api/recipes/saved");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const savedIds = new Set(savedRecipes.map((r) => r.id));

  const saveMutation = useMutation({
    mutationFn: async ({ recipeId, saved }: { recipeId: string; saved: boolean }) => {
      if (saved) {
        await fetch(`/api/recipes/saved?recipeId=${recipeId}`, { method: "DELETE" });
      } else {
        await fetch("/api/recipes/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipeId }),
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-recipes"] }),
    onError: () => toast({ title: "Sign in to save recipes", variant: "destructive" }),
  });

  const params = new URLSearchParams({ q, minScore, sort: "availability" });
  if (category !== "All") params.set("category", category);
  if (cuisine !== "All") params.set("cuisine", cuisine);
  if (dietary) params.set("dietary", dietary);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["recipes-infinite", q, category, cuisine, dietary, minScore],
    queryFn: ({ pageParam }) => fetchRecipesPage(new URLSearchParams(params), pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.data.length === PAGE_SIZE ? allPages.length + 1 : undefined,
    staleTime: 30 * 1000,
  });

  const recipes = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  // Intersection observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function addSelectedToBasket() {
    const toAdd = recipes.filter((r) => selectedIds.has(r.id) && !hasItem(r.id));
    toAdd.forEach((r) => addItem({
      recipeId: r.id,
      slug: r.slug,
      title: r.title,
      imageUrl: r.imageUrl,
      baseServings: r.baseServings,
    }));
    toast({ title: `${toAdd.length} recipe${toAdd.length !== 1 ? "s" : ""} added to basket` });
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Browse Recipes</h1>
          <p className="text-muted-foreground mt-1">
            Recipes you can make with today&apos;s available stock.
          </p>
        </div>
        <Button asChild variant="brand" size="sm" className="shrink-0 mt-1">
          <Link href="/recipes/new">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Create
          </Link>
        </Button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button
            variant={selectMode ? "brand" : "outline"}
            size="sm"
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            {selectMode ? "Cancel" : "Select"}
          </Button>
        </div>

        {/* Category row */}
        <div className="flex flex-wrap gap-2 items-center">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
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
        </div>

        {/* Cuisine row */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0 w-[72px]">Cuisine</span>
          {CUISINE_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(c)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                cuisine === c
                  ? "bg-brand text-white border-transparent"
                  : "border-border hover:border-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Dietary + availability row */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground shrink-0 w-[72px]">Dietary</span>
            {DIETARY_OPTIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => setDietary(d.value)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
                  dietary === d.value
                    ? "bg-brand text-white border-transparent"
                    : "border-border hover:border-foreground"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
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
          <p className="text-sm mt-1">Try adjusting your filters or check back when vendors add new stock.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} recipe{total !== 1 ? "s" : ""}
            {selectMode && selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                {...recipe}
                isSaved={savedIds.has(recipe.id)}
                isSelected={selectedIds.has(recipe.id)}
                selectMode={selectMode}
                onSelect={toggleSelect}
                onSaveToggle={(id) => saveMutation.mutate({ recipeId: id, saved: savedIds.has(id) })}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={loaderRef} className="h-10 flex items-center justify-center">
            {isFetchingNextPage && (
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Multi-select floating action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-brand text-white rounded-full px-6 py-3 shadow-xl flex items-center gap-3">
          <span className="font-medium text-sm">{selectedIds.size} recipe{selectedIds.size !== 1 ? "s" : ""} selected</span>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 h-8 gap-1.5"
            onClick={addSelectedToBasket}
          >
            <ShoppingBasket className="h-4 w-4" />
            Add all to basket
          </Button>
        </div>
      )}
    </div>
  );
}
