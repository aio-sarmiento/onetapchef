"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, daysUntilExpiry, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type StockItem = {
  id: string;
  quantityAvailable: number;
  unit: string;
  pricePerUnit: number;
  expiryDate: string;
  status: "available" | "low" | "sold_out" | "expired";
  ingredient: { id: string; name: string; category: string };
};

type Ingredient = { id: string; name: string; category: string; defaultUnit: string };

async function fetchMyStock(): Promise<{ vendorId: string; stock: StockItem[] }> {
  const [meRes, vendorRes] = await Promise.all([
    fetch("/api/auth/me"),
    fetch("/api/auth/me"),
  ]);
  const me = await meRes.json();
  const vendorId = me.vendorProfile?.id;
  if (!vendorId) return { vendorId: "", stock: [] };
  const stockRes = await fetch(`/api/vendors/${vendorId}/stock`);
  const stock = await stockRes.json();
  return { vendorId, stock };
}

async function fetchIngredients(q: string): Promise<Ingredient[]> {
  const res = await fetch(`/api/ingredients?q=${encodeURIComponent(q)}`);
  return res.json();
}

export default function VendorStockPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vendor-stock"], queryFn: fetchMyStock });

  const [showForm, setShowForm] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [expiry, setExpiry] = useState("");

  const { data: ingredientResults = [] } = useQuery({
    queryKey: ["ingredients", ingredientSearch],
    queryFn: () => fetchIngredients(ingredientSearch),
    enabled: ingredientSearch.length > 1,
  });

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

  const STATUS_BADGE: Record<string, "available" | "low" | "unavailable" | "expiring"> = {
    available: "available",
    low: "low",
    sold_out: "unavailable",
    expired: "unavailable",
  };

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
                placeholder="Search for an ingredient…"
                value={ingredientSearch}
                onChange={(e) => {
                  setIngredientSearch(e.target.value);
                  setSelectedIngredient(null);
                }}
              />
              {ingredientResults.length > 0 && !selectedIngredient && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {ingredientResults.map((ing) => (
                    <button
                      key={ing.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelectedIngredient(ing);
                        setIngredientSearch(ing.name);
                      }}
                    >
                      <span className="font-medium">{ing.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{ing.category}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedIngredient && (
                <p className="text-xs text-brand font-medium">
                  Selected: {selectedIngredient.name} · unit: {selectedIngredient.defaultUnit}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Quantity ({selectedIngredient?.defaultUnit ?? "unit"})</Label>
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
                <Label>Price per unit (€)</Label>
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

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="brand"
                disabled={!selectedIngredient || !quantity || !expiry || addMutation.isPending}
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
                      {days <= 1 && (
                        <Badge variant="expiring" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Expires today
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Number(item.quantityAvailable)} {item.unit} · {formatCurrency(Number(item.pricePerUnit))}/{item.unit} ·
                      Expires {formatDate(item.expiryDate)} ({days}d)
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
