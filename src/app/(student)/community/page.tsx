"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { Flame, Clock, Users, ChefHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PopularRecipe = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  category: string;
  availabilityScore: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  baseServings: number;
  author: { displayName: string; avatarUrl: string | null };
  _count: { savedByUsers: number; ingredients: number };
};

async function fetchPopularRecipes(): Promise<PopularRecipe[]> {
  const res = await fetch("/api/recipes?sort=popular&limit=30");
  if (!res.ok) throw new Error("Failed to load");
  const json = await res.json();
  return json.data ?? json;
}

export default function CommunityPage() {
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["community-feed"],
    queryFn: fetchPopularRecipes,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <div className="h-8 w-36 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-muted animate-pulse mt-2" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-full rounded-2xl bg-muted animate-pulse h-[80vh]" />
        ))}
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-24 flex flex-col items-center gap-4">
        <div className="bg-brand-muted rounded-full p-6">
          <Flame className="h-12 w-12 text-brand" />
        </div>
        <h2 className="text-xl font-semibold">No recipes yet</h2>
        <p className="text-muted-foreground">Be the first to share a recipe with the community!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community</h1>
        <p className="text-muted-foreground mt-1">Most loved recipes from students like you.</p>
      </div>

      <div className="flex flex-col gap-5">
        {recipes.map((recipe) => (
          <Link key={recipe.id} href={`/recipes/${recipe.slug}`}>
            <div className="relative w-full rounded-2xl overflow-hidden h-[82vh] cursor-pointer group">
              {recipe.imageUrl ? (
                <Image
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  fill
                  className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
              ) : (
                <div className="absolute inset-0 bg-brand-muted flex items-center justify-center">
                  <ChefHat className="h-24 w-24 text-brand/25" />
                </div>
              )}

              {/* gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

              {/* top badges */}
              <div className="absolute top-5 left-5 flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-xs">
                  {recipe.category}
                </Badge>
                {recipe._count.savedByUsers > 0 && (
                  <Badge className="bg-brand/80 text-white border-transparent backdrop-blur-sm text-xs">
                    <Flame className="h-3 w-3 mr-1" />
                    {recipe._count.savedByUsers} saves
                  </Badge>
                )}
              </div>

              {/* bottom content */}
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <h2 className="text-2xl font-bold leading-tight mb-2 line-clamp-2">
                  {recipe.title}
                </h2>
                <p className="text-white/75 text-sm line-clamp-2 mb-5">
                  {recipe.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-sm font-bold border border-white/30">
                      {recipe.author.displayName[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{recipe.author.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/70 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {recipe.prepTimeMinutes + recipe.cookTimeMinutes}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {recipe.baseServings} servings
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
