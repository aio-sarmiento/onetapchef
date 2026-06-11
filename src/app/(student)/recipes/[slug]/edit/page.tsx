"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, X, Camera, Upload, ImageIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

type Ingredient = { id: string; name: string; defaultUnit: string };
type IngredientRow = {
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  isOptional: boolean;
};

const PRESET_TAGS = ["Vegan", "Vegetarian", "Gluten-free", "Dairy-free", "Nut-free", "Halal", "Kosher"];
const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Other"];
const CUISINES = ["International", "Spanish", "Italian", "Mexican", "Asian", "Mediterranean", "American", "Other"];

export default function EditRecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: recipe, isLoading } = useQuery({
    queryKey: ["recipe-edit", slug],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseServings, setBaseServings] = useState("2");
  const [prepTime, setPrepTime] = useState("10");
  const [cookTime, setCookTime] = useState("20");
  const [category, setCategory] = useState("Dinner");
  const [cuisine, setCuisine] = useState("International");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);
  const [ingSearch, setIngSearch] = useState("");
  const [selectedPresetTags, setSelectedPresetTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [initialised, setInitialised] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: ingResults = [] } = useQuery<Ingredient[]>({
    queryKey: ["ingredients", ingSearch],
    queryFn: async () => {
      const res = await fetch(`/api/ingredients?q=${encodeURIComponent(ingSearch)}`);
      return res.json();
    },
    enabled: ingSearch.length > 1,
  });

  // Initialise form from loaded recipe (once)
  if (recipe && !initialised) {
    setTitle(recipe.title);
    setDescription(recipe.description);
    setBaseServings(String(recipe.baseServings));
    setPrepTime(String(recipe.prepTimeMinutes));
    setCookTime(String(recipe.cookTimeMinutes));
    setCategory(recipe.category);
    setCuisine(recipe.cuisine);
    setImageUrl(recipe.imageUrl ?? "");
    setImagePreview(recipe.imageUrl ?? null);
    setInstructions(Array.isArray(recipe.instructions) ? recipe.instructions : [""]);
    setIngredientRows(
      (recipe.ingredientAvailability ?? []).map((ia: { ingredientId: string; ingredientName: string; quantity: number; unit: string; isOptional: boolean }) => ({
        ingredientId: ia.ingredientId,
        ingredientName: ia.ingredientName,
        quantity: String(ia.quantity),
        unit: ia.unit,
        isOptional: ia.isOptional,
      }))
    );
    const preset = (recipe.dietaryTags ?? []).filter((t: string) => PRESET_TAGS.includes(t));
    const custom = (recipe.dietaryTags ?? []).filter((t: string) => !PRESET_TAGS.includes(t));
    setSelectedPresetTags(preset);
    setCustomTags(custom);
    setInitialised(true);
  }

  function togglePresetTag(tag: string) {
    setSelectedPresetTags((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
    );
  }

  function addCustomTag() {
    const t = tagInput.trim();
    if (!t || customTags.includes(t)) return;
    setCustomTags((tags) => [...tags, t]);
    setTagInput("");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/recipes/${recipe.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description,
        baseServings: parseInt(baseServings),
        prepTimeMinutes: parseInt(prepTime),
        cookTimeMinutes: parseInt(cookTime),
        category, cuisine,
        dietaryTags: [...selectedPresetTags, ...customTags],
        imageUrl: imageUrl || null,
        instructions: instructions.filter(Boolean),
        ingredients: ingredientRows.filter((r) => r.quantity).map((r) => ({
          ingredientId: r.ingredientId,
          quantity: parseFloat(r.quantity),
          unit: r.unit,
          isOptional: r.isOptional,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Save failed", description: data.error, variant: "destructive" });
      setLoading(false);
      return;
    }
    toast({ title: "Recipe updated!" });
    router.push(`/recipes/${slug}`);
  }

  async function handleDelete() {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Delete failed", variant: "destructive" });
      setDeleting(false);
      return;
    }
    toast({ title: "Recipe deleted" });
    router.push("/recipes");
  }

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Loading…</div>;
  if (!recipe) return <div className="py-16 text-center text-muted-foreground">Recipe not found.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/recipes/${slug}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-3xl font-bold">Edit Recipe</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">Basic info</h2>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cuisine</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                >
                  {CUISINES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Photo</h2>
            <div className="flex gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); } }}>
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute("capture", "environment"); fileInputRef.current.click(); } }}>
                <Camera className="h-3.5 w-3.5 mr-1.5" /> Take photo
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            {imageUploading && <div className="h-32 rounded-lg border bg-muted animate-pulse" />}
            {imagePreview && !imageUploading && (
              <div className="relative w-full aspect-[16/7] rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setImagePreview(null); setImageUrl(""); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {!imagePreview && !imageUploading && (
              <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground gap-2 text-sm">
                <ImageIcon className="h-5 w-5" /> No photo
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
                <button key={tag} type="button" onClick={() => togglePresetTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${selectedPresetTags.includes(tag) ? "bg-brand text-white border-transparent" : "border-border hover:border-brand hover:text-brand"}`}>
                  {tag}
                </button>
              ))}
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-brand text-white">
                    {tag}
                    <button type="button" onClick={() => setCustomTags((t) => t.filter((x) => x !== tag))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input placeholder="Add custom tag…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }} className="max-w-xs" />
              <Button type="button" variant="outline" size="sm" onClick={addCustomTag}>Add</Button>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold">Ingredients</h2>
            <div className="relative">
              <Input placeholder="Search and add an ingredient…" value={ingSearch} onChange={(e) => setIngSearch(e.target.value)} />
              {ingResults.length > 0 && ingSearch.length > 1 && (
                <div className="absolute top-full left-0 right-0 z-10 border rounded-md bg-white shadow divide-y max-h-48 overflow-y-auto">
                  {ingResults.map((ing) => (
                    <button key={ing.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setIngredientRows((r) => [...r, { ingredientId: ing.id, ingredientName: ing.name, quantity: "", unit: ing.defaultUnit, isOptional: false }]); setIngSearch(""); }}>
                      {ing.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {ingredientRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">{row.ingredientName}</span>
                <Input className="w-24" type="number" placeholder="Qty" value={row.quantity}
                  onChange={(e) => setIngredientRows((rows) => rows.map((r, idx) => idx === i ? { ...r, quantity: e.target.value } : r))} />
                <span className="text-sm text-muted-foreground w-8">{row.unit}</span>
                <Button type="button" variant="ghost" size="icon" onClick={() => setIngredientRows((rows) => rows.filter((_, idx) => idx !== i))}>
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
                <span className="h-6 w-6 rounded-full bg-brand-muted text-brand text-xs font-bold flex items-center justify-center mt-2 shrink-0">{i + 1}</span>
                <textarea className="flex-1 rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" rows={2}
                  value={step} onChange={(e) => setInstructions((s) => s.map((st, idx) => idx === i ? e.target.value : st))} />
                {instructions.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="mt-1" onClick={() => setInstructions((s) => s.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setInstructions((s) => [...s, ""])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add step
            </Button>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" variant="brand" className="flex-1" disabled={loading || imageUploading}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-white" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete recipe"}
          </Button>
        </div>
      </form>
    </div>
  );
}
