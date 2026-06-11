"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, AlertTriangle, Megaphone, MegaphoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, daysUntilExpiry, formatCurrency } from "@/lib/utils";
import { getPackDef } from "@/lib/vendor-units";
import { toast } from "@/hooks/use-toast";

type StockItem = {
  id: string;
  quantityAvailable: number;
  unit: string;
  pricePerUnit: number;
  packageSize: number;
  isPromoted: boolean;
  expiryDate: string;
  status: "available" | "low" | "sold_out" | "expired";
  ingredient: { id: string; name: string; category: string };
};

type Ingredient = { id: string; name: string; category: string; defaultUnit: string };

async function fetchMyStock(): Promise<{ vendorId: string; stock: StockItem[] }> {
  const meRes = await fetch("/api/auth/me");
  const me = await meRes.json();
  const vendorId = me.vendorProfile?.id;
  if (!vendorId) return { vendorId: "", stock: [] };
  const stockRes = await fetch(`/api/vendors/${vendorId}/stock`);
  const stock = await stockRes.json();
  return { vendorId, stock };
}

async function fetchIngredients(q: string, category: string): Promise<Ingredient[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const res = await fetch(`/api/ingredients?${params}`);
  return res.json();
}

async function fetchCategories(): Promise<string[]> {
  const res = await fetch("/api/ingredients/categories");
  return res.json();
}

export default function VendorStockPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vendor-stock"], queryFn: fetchMyStock });

  const [showForm, setShowForm] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [browseCategory, setBrowseCategory] = useState("");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [expiry, setExpiry] = useState("");

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["ingredient-categories"],
    queryFn: fetchCategories,
  });

  const showResults = ingredientSearch.length > 1 || browseCategory !== "";

  const { data: ingredientResults = [] } = useQuery({
    queryKey: ["ingredients", ingredientSearch, browseCategory],
    queryFn: () => fetchIngredients(ingredientSearch, browseCategory),
    enabled: showResults,
  });

  // When an ingredient is selected, pre-fill package size from category default
  function selectIngredient(ing: Ingredient) {
    setSelectedIngredient(ing);
    setIngredientSearch(ing.name);
    setBrowseCategory("");
    const packDef = getPackDef(ing.category);
    setPackageSize(String(packDef.size));
  }

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!data?.vendorId || !selectedIngredient) throw new Error("Missing data");
      const res = await fetch(`/api/vendors/${data.vendorId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: selectedIngredient.id,
          quantityAvailable: parseFloat(quantity),
          unit: selectedIngredient.defaultUnit,
          pricePerUnit: parseFloat(price),
          packageSize: parseFloat(packageSize) || getPackDef(selectedIngredient.category).size,
          isPromoted: true,
          expiryDate: expiry,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to add listing");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-stock"] });
      toast({ title: "Listing added!" });
      setShowForm(false);
      setSelectedIngredient(null);
      setIngredientSearch("");
      setQuantity("");
      setPrice("");
      setPackageSize("");
      setExpiry("");
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (stockId: string) => {
      const res = await fetch(`/api/vendors/${data?.vendorId}/stock/${stockId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-stock"] });
      toast({ title: "Listing removed" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ stockId, isPromoted }: { stockId: string; isPromoted: boolean }) => {
      const res = await fetch(`/api/vendors/${data?.vendorId}/stock/${stockId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPromoted }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendor-stock"] }),
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const STATUS_BADGE: Record<string, "available" | "low" | "unavailable" | "expiring"> = {
    available: "available",
    low: "low",
    sold_out: "unavailable",
    expired: "unavailable",
  };

  const packSizeHint = selectedIngredient
    ? `${getPackDef(selectedIngredient.category).unit} per package`
    : "g or ml per package";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Stock</h1>
          <p className="text-muted-foreground mt-1">Manage your near-expiring ingredient listings.</p>
        </div>
        <Button variant="brand" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add listing
        </Button>
      </div>

      {/* Add listing form */}
      {showForm && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">New listing</h2>

            <div className="space-y-2">
              <Label>Ingredient</Label>
              <Input
                placeholder="Search by name…"
                value={ingredientSearch}
                onChange={(e) => {
                  setIngredientSearch(e.target.value);
                  setBrowseCategory("");
                  setSelectedIngredient(null);
                  setPackageSize("");
                }}
              />

              {!selectedIngredient && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setBrowseCategory(browseCategory === cat ? "" : cat);
                        setIngredientSearch("");
                        setSelectedIngredient(null);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        browseCategory === cat
                          ? "bg-brand text-white border-transparent"
                          : "border-border hover:border-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {showResults && ingredientResults.length > 0 && !selectedIngredient && (
                <div className="border rounded-md divide-y max-h-52 overflow-y-auto">
                  {ingredientResults.map((ing) => (
                    <button
                      key={ing.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => selectIngredient(ing)}
                    >
                      <span className="font-medium">{ing.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{ing.category}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedIngredient && (
                <div className="flex items-center justify-between text-xs">
                  <p className="text-brand font-medium">
                    Selected: {selectedIngredient.name} · unit: {selectedIngredient.defaultUnit}
                  </p>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground underline"
                    onClick={() => { setSelectedIngredient(null); setIngredientSearch(""); setPackageSize(""); }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Total quantity ({selectedIngredient?.defaultUnit ?? "unit"})</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Package size ({packSizeHint})</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="200"
                  value={packageSize}
                  onChange={(e) => setPackageSize(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Price per 100g / 100ml (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry date</Label>
                <Input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {price && packageSize && (
              <p className="text-xs text-muted-foreground">
                = {formatCurrency((parseFloat(packageSize) / 100) * parseFloat(price))} per package
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="brand"
                disabled={!selectedIngredient || !quantity || !expiry || !price || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "Adding…" : "Add listing"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : !data?.stock.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No active listings</p>
          <p className="text-sm mt-1">Add your first near-expiring ingredient above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.stock.map((item) => {
            const days = daysUntilExpiry(item.expiryDate);
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{item.ingredient.name}</span>
                      <Badge variant={STATUS_BADGE[item.status]}>{item.status.replace("_", " ")}</Badge>
                      {item.isPromoted ? (
                        <Badge variant="secondary" className="text-xs">Promoted</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>
                      )}
                      {days <= 1 && (
                        <Badge variant="expiring" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Expires today
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Number(item.quantityAvailable)}{item.unit} · {Number(item.packageSize)}{item.unit} packages ·{" "}
                      {formatCurrency(Number(item.pricePerUnit))}/100{item.unit} ·{" "}
                      {formatCurrency((Number(item.packageSize) / 100) * Number(item.pricePerUnit))}/pkg ·{" "}
                      Expires {formatDate(item.expiryDate)} ({days}d)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={item.isPromoted ? "Hide from students" : "Promote to students"}
                      className={item.isPromoted ? "text-brand hover:text-muted-foreground" : "text-muted-foreground hover:text-brand"}
                      onClick={() => promoteMutation.mutate({ stockId: item.id, isPromoted: !item.isPromoted })}
                      disabled={promoteMutation.isPending}
                    >
                      {item.isPromoted ? <Megaphone className="h-4 w-4" /> : <MegaphoneOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
