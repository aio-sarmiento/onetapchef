"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Camera, Upload, ImageIcon } from "lucide-react";
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

const PRESET_TAGS = ["Vegan", "Vegetarian", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher"];
const DRAFT_KEY = "onetapchef_recipe_draft";

const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Other"];
const CUISINES = ["International", "Spanish", "Italian", "Mexican", "Asian", "Mediterranean", "American", "Other"];

function loadDraft() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NewRecipePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const draft = loadDraft();

  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [baseServings, setBaseServings] = useState(draft?.baseServings ?? "2");
  const [prepTime, setPrepTime] = useState(draft?.prepTime ?? "10");
  const [cookTime, setCookTime] = useState(draft?.cookTime ?? "20");
  const [category, setCategory] = useState(draft?.category ?? "Dinner");
  const [cuisine, setCuisine] = useState(draft?.cuisine ?? "International");
  const [imageUrl, setImageUrl] = useState(draft?.imageUrl ?? "");
  const [imagePreview, setImagePreview] = useState<string | null>(draft?.imageUrl ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [instructions, setInstructions] = useState<string[]>(draft?.instructions ?? [""]);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(draft?.ingredientRows ?? []);
  const [ingSearch, setIngSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Dietary tags
  const [selectedPresetTags, setSelectedPresetTags] = useState<string[]>(draft?.selectedPresetTags ?? []);
  const [customTags, setCustomTags] = useState<string[]>(draft?.customTags ?? []);
  const [tagInput, setTagInput] = useState("");

  // Autosave draft to localStorage on every change
  useEffect(() => {
    const data = {
      title, description, baseServings, prepTime, cookTime,
      category, cuisine, imageUrl, instructions, ingredientRows,
      selectedPresetTags, customTags,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }, [title, description, baseServings, prepTime, cookTime, category, cuisine, imageUrl, instructions, ingredientRows, selectedPresetTags, customTags]);

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

  function togglePresetTag(tag: string) {
    setSelectedPresetTags((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
    );
  }

  function addCustomTag() {
    const t = tagInput.trim();
    if (!t || customTags.includes(t) || selectedPresetTags.includes(t)) return;
    setCustomTags((tags) => [...tags, t]);
    setTagInput("");
  }

  function removeCustomTag(tag: string) {
    setCustomTags((tags) => tags.filter((t) => t !== tag));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload/recipe-image", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Upload failed", description: data.error, variant: "destructive" });
      setImagePreview(null);
    } else {
      setImageUrl(data.url);
    }
    setImageUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const allTags = [...selectedPresetTags, ...customTags];

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
        dietaryTags: allTags,
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

    localStorage.removeItem(DRAFT_KEY);
    toast({ title: "Recipe published!" });
    router.push(`/recipes/${data.slug}`);
  }

  const allTags = [...selectedPresetTags, ...customTags];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Recipe</h1>
        {draft?.title && (
          <p className="text-sm text-muted-foreground mt-1">
            Draft auto-saved ·{" "}
            <button
              className="text-brand underline"
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                window.location.reload();
              }}
            >
              Clear draft
            </button>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cuisine</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                >
                  {CUISINES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Image */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Photo</h2>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.click();
                  }
                }}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Upload photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                Take photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {imageUploading && (
              <div className="h-32 rounded-lg border bg-muted animate-pulse flex items-center justify-center text-sm text-muted-foreground">
                Uploading…
              </div>
            )}

            {imagePreview && !imageUploading && (
              <div className="relative w-full aspect-[16/7] rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(null); setImageUrl(""); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!imagePreview && !imageUploading && (
              <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground gap-2 text-sm">
                <ImageIcon className="h-5 w-5" />
                No photo yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dietary tags */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Dietary tags</h2>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => togglePresetTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selectedPresetTags.includes(tag)
                      ? "bg-brand text-white border-transparent"
                      : "border-border hover:border-brand hover:text-brand"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-brand text-white"
                  >
                    {tag}
                    <button type="button" onClick={() => removeCustomTag(tag)} className="hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add custom tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomTag}>
                Add
              </Button>
            </div>

            {allTags.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Tags: {allTags.join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Ingredients */}
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
                <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={row.isOptional}
                    onChange={(e) =>
                      setIngredientRows((rows) => rows.map((r, idx) => idx === i ? { ...r, isOptional: e.target.checked } : r))
                    }
                  />
                  Optional
                </label>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Instructions */}
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

        <Button type="submit" variant="brand" className="w-full" disabled={loading || imageUploading}>
          {loading ? "Publishing…" : "Publish recipe"}
        </Button>
      </form>
    </div>
  );
}
