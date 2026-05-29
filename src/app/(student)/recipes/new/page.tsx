"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

type Ingredient = { id: string; name: string; defaultUnit: string };

type IngredientRow = {
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  isOptional: boolean;
};

export default function NewRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseServings, setBaseServings] = useState("2");
  const [prepTime, setPrepTime] = useState("10");
  const [cookTime, setCookTime] = useState("20");
  const [category, setCategory] = useState("Dinner");
  const [cuisine, setCuisine] = useState("International");
  const [imageUrl, setImageUrl] = useState("");
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);
  const [ingSearch, setIngSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: ingResults = [] } = useQuery<Ingredient[]>({
    queryKey: ["ingredients", ingSearch],
    queryFn: async () => {
      const res = await fetch(`/api/ingredients?q=${encodeURIComponent(ingSearch)}`);
      return res.json();
    },
    enabled: ingSearch.length > 1,
  });

  function addIngredient(ing: Ingredient) {
    setIngredientRows((rows) => [
      ...rows,
      { ingredientId: ing.id, ingredientName: ing.name, quantity: "", unit: ing.defaultUnit, isOptional: false },
    ]);
    setIngSearch("");
  }

  function removeIngredient(i: number) {
    setIngredientRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        baseServings: parseInt(baseServings),
        prepTimeMinutes: parseInt(prepTime),
        cookTimeMinutes: parseInt(cookTime),
        category,
        cuisine,
        dietaryTags: [],
        imageUrl: imageUrl || undefined,
        instructions: instructions.filter(Boolean),
        ingredients: ingredientRows
          .filter((r) => r.quantity)
          .map((r) => ({
            ingredientId: r.ingredientId,
            quantity: parseFloat(r.quantity),
            unit: r.unit,
            isOptional: r.isOptional,
          })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: data.error?.fieldErrors?.title?.[0] ?? "Failed to submit", variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Recipe submitted!" });
    router.push(`/recipes/${data.slug}`);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Submit a Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">Basic info</h2>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Tomato pasta" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="A quick weeknight dinner…"
              />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="space-y-2">
                <Label>Servings</Label>
                <Input type="number" min="1" value={baseServings} onChange={(e) => setBaseServings(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prep (min)</Label>
                <Input type="number" min="0" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cook (min)</Label>
                <Input type="number" min="0" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cuisine</Label>
                <Input value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Ingredients</h2>
            <div className="relative">
              <Input
                placeholder="Search and add an ingredient…"
                value={ingSearch}
                onChange={(e) => setIngSearch(e.target.value)}
              />
              {ingResults.length > 0 && ingSearch.length > 1 && (
                <div className="absolute top-full left-0 right-0 z-10 border rounded-md bg-white shadow divide-y max-h-48 overflow-y-auto">
                  {ingResults.map((ing) => (
                    <button
                      key={ing.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => addIngredient(ing)}
                    >
                      {ing.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ingredientRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{row.ingredientName}</span>
                <Input
                  className="w-24"
                  type="number"
                  placeholder="Qty"
                  value={row.quantity}
                  onChange={(e) =>
                    setIngredientRows((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))
                  }
                />
                <span className="text-sm text-muted-foreground w-8">{row.unit}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Instructions</h2>
            {instructions.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="h-6 w-6 rounded-full bg-brand-muted text-brand text-xs font-bold flex items-center justify-center mt-2 shrink-0">
                  {i + 1}
                </span>
                <textarea
                  className="flex-1 rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={2}
                  value={step}
                  onChange={(e) =>
                    setInstructions((s) => s.map((st, idx) => idx === i ? e.target.value : st))
                  }
                  placeholder={`Step ${i + 1}`}
                />
                {instructions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1"
                    onClick={() => setInstructions((s) => s.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInstructions((s) => [...s, ""])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add step
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" variant="brand" className="w-full" disabled={loading}>
          {loading ? "Submitting…" : "Submit recipe"}
        </Button>
      </form>
    </div>
  );
}
