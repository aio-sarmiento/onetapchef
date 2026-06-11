"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock, Minus, Plus, ShoppingBasket, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IngredientAvailabilityChip } from "@/components/ingredient-availability-chip";
import { useBasketStore } from "@/stores/basket-store";
import { scaleQuantity, formatCurrency } from "@/lib/utils";
import { roundToPacks } from "@/lib/vendor-units";
import { toast } from "@/hooks/use-toast";
import { useStockRealtime } from "@/hooks/use-stock-realtime";

type IngredientAvailability = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  category: string;
  quantity: number;
  unit: string;
  isOptional: boolean;
  preparationNote: string | null;
  availability: "available" | "low" | "unavailable";
  bestStock: {
    pricePerUnit: number;
    packageSize: number;
    quantityAvailable: number;
    vendor: { businessName: string };
  } | null;
};

type RecipeDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  baseServings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  category: string;
  cuisine: string;
  dietaryTags: string[];
  instructions: string[];
  availabilityScore: number;
  author: { displayName: string };
  ingredientAvailability: IngredientAvailability[];
};

async function fetchRecipe(slug: string): Promise<RecipeDetail> {
  const res = await fetch(`/api/recipes/${slug}`);
  if (!res.ok) throw new Error("Recipe not found");
  return res.json();
}

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["recipe", slug],
    queryFn: () => fetchRecipe(slug),
  });

  const [servings, setServings] = useState<number | null>(null);

  // Subscribe to live stock changes for all ingredients in this recipe
  useStockRealtime(
    recipe?.id ?? "",
    recipe?.ingredientAvailability.map((i) => i.ingredientId) ?? []
  );
  const { addItem, removeItem, hasItem } = useBasketStore();

  if (isLoading) return <RecipeDetailSkeleton />;
  if (error || !recipe) return <div className="py-20 text-center text-muted-foreground">Recipe not found.</div>;

  const currentServings = servings ?? recipe.baseServings;
  const inBasket = hasItem(recipe.id);

  // pricePerUnit is €/100g — use vendor's actual packageSize, round up to packs, divide by 100
  const estimatedCost = recipe.ingredientAvailability
    .filter((i) => i.bestStock && !i.isOptional)
    .reduce((sum, i) => {
      const scaled = scaleQuantity(i.quantity, recipe.baseServings, currentServings);
      const { totalQty: orderedQty } = roundToPacks(scaled, i.category, Number(i.bestStock!.packageSize));
      return sum + (orderedQty / 100) * Number(i.bestStock!.pricePerUnit);
    }, 0);
  const costPerPortion = currentServings > 0 ? estimatedCost / currentServings : 0;

  function handleBasket() {
    if (!recipe) return;
    if (inBasket) {
      removeItem(recipe.id);
      toast({ title: "Removed from basket" });
    } else {
      addItem({
        recipeId: recipe.id,
        slug: recipe.slug,
        title: recipe.title,
        imageUrl: recipe.imageUrl,
        baseServings: recipe.baseServings,
      });
      // Update servings in store if user changed them
      if (servings && servings !== recipe.baseServings) {
        useBasketStore.getState().updateServings(recipe.id, currentServings);
      }
      toast({ title: "Added to basket!", description: recipe.title });
    }
  }

  const score = Number(recipe.availabilityScore);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt={recipe.title} className="object-cover w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <ChefHat className="h-16 w-16" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{recipe.category}</Badge>
            <Badge variant="outline">{recipe.cuisine}</Badge>
            {recipe.dietaryTags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>

          <h1 className="text-3xl font-bold leading-tight">{recipe.title}</h1>
          <p className="text-muted-foreground">{recipe.description}</p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min total
            </span>
            <span>by {recipe.author.displayName}</span>
          </div>

          {/* Availability bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Ingredient availability</span>
              <span>{Math.round(score * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score === 1 ? "bg-green-500" : score >= 0.5 ? "bg-yellow-500" : "bg-red-400"
                }`}
                style={{ width: `${score * 100}%` }}
              />
            </div>
          </div>

          {/* Portion scaler */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Servings</span>
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setServings((s) => Math.max(1, (s ?? recipe.baseServings) - 1))}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center font-semibold text-sm">{currentServings}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setServings((s) => (s ?? recipe.baseServings) + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {estimatedCost > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2 space-y-0.5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Per portion</span>
                <span className="font-semibold text-foreground">{formatCurrency(costPerPortion)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Total for {currentServings} {currentServings === 1 ? "portion" : "portions"}</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleBasket}
            variant={inBasket ? "outline" : "brand"}
            className="gap-2"
          >
            <ShoppingBasket className="h-4 w-4" />
            {inBasket ? "Remove from basket" : "Add to basket"}
          </Button>
        </div>
      </div>

      {/* Ingredients */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Ingredients</h2>
        <div className="space-y-2">
          {recipe.ingredientAvailability.map((ing) => (
            <IngredientAvailabilityChip
              key={ing.id}
              name={ing.ingredientName}
              quantity={ing.quantity}
              unit={ing.unit}
              isOptional={ing.isOptional}
              preparationNote={ing.preparationNote}
              availability={ing.availability}
              bestStock={ing.bestStock}
              scaledQuantity={scaleQuantity(ing.quantity, recipe.baseServings, currentServings)}
            />
          ))}
        </div>
      </section>

      {/* Instructions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Instructions</h2>
        <ol className="space-y-4">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-shrink-0 h-7 w-7 rounded-full bg-brand-muted text-brand font-bold text-sm flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed pt-1">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function RecipeDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
