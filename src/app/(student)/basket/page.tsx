"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBasket, ChefHat, ArrowRight, Truck, MapPin, Loader2, X, ChevronDown } from "lucide-react";
import { useBasketStore } from "@/stores/basket-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Alternative = {
  vendorId: string;
  vendorName: string;
  packLabel: string;
  lineTotal: number;
};

type LineItem = {
  ingredientId: string;
  ingredientName: string;
  packLabel: string;
  pricePerUnit: number;
  lineTotal: number;
  alternatives: Alternative[];
};

type VendorGroup = {
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string | null;
  subtotal: number;
  lineItems: LineItem[];
};

type Preview = { groups: VendorGroup[]; grandTotal: number };

export default function BasketPage() {
  const { items, removeItem, updateServings, clearBasket } = useBasketStore();
  const [note, setNote] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expandedAlts, setExpandedAlts] = useState<Set<string>>(new Set());
  const router = useRouter();

  function toggleExclude(ingredientId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) { next.delete(ingredientId); } else { next.add(ingredientId); }
      return next;
    });
  }

  function toggleAlternatives(ingredientId: string) {
    setExpandedAlts((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) { next.delete(ingredientId); } else { next.add(ingredientId); }
      return next;
    });
  }

  useEffect(() => {
    if (items.length === 0) { setPreview(null); return; }
    const controller = new AbortController();
    setPreviewLoading(true);
    fetch("/api/basket/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ recipeId: i.recipeId, servings: i.servings })),
        excludedIngredientIds: Array.from(excluded),
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => { if (!controller.signal.aborted) setPreview(data); })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    return () => controller.abort();
  }, [items, excluded]);

  async function handleCheckout() {
    if (items.length === 0) return;
    if (deliveryType === "delivery" && !deliveryAddress.trim()) {
      toast({ title: "Delivery address required", variant: "destructive" });
      return;
    }
    setLoading(true);

    const res = await fetch("/api/basket/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ recipeId: i.recipeId, servings: i.servings })),
        studentNote: note || undefined,
        deliveryType,
        deliveryAddress: deliveryType === "delivery" ? deliveryAddress : undefined,
        excludedIngredientIds: Array.from(excluded),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast({ title: "Checkout failed", description: data.error, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Request sent!", description: `${data.orders.length} order(s) sent to vendor(s).` });
    clearBasket();
    router.push("/orders");
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="bg-brand-muted rounded-full p-6">
          <ShoppingBasket className="h-12 w-12 text-brand" />
        </div>
        <h2 className="text-2xl font-semibold">Your basket is empty</h2>
        <p className="text-muted-foreground max-w-sm">
          Browse recipes and add them to your basket to request ingredients from vendors.
        </p>
        <Button asChild variant="brand">
          <Link href="/browse">Browse recipes</Link>
        </Button>
      </div>
    );
  }

  const excludedCount = excluded.size;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Basket</h1>
        <Button variant="ghost" size="sm" onClick={clearBasket} className="text-muted-foreground">
          Clear all
        </Button>
      </div>

      {/* Recipe items */}
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.recipeId}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <ChefHat className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link href={`/recipes/${item.slug}`} className="font-medium hover:underline line-clamp-1">
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Base: {item.baseServings} servings
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1 shrink-0">
                  <button onClick={() => updateServings(item.recipeId, item.servings - 1)} className="text-muted-foreground hover:text-foreground">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.servings}</span>
                  <button onClick={() => updateServings(item.recipeId, item.servings + 1)} className="text-muted-foreground hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeItem(item.recipeId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Price breakdown per vendor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              Ingredient cost breakdown
              {previewLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {excludedCount > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline font-normal"
                onClick={() => setExcluded(new Set())}
              >
                Restore {excludedCount} removed
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!preview && !previewLoading && (
            <p className="text-sm text-muted-foreground">Loading prices…</p>
          )}
          {preview?.groups.map((group) => (
            <div key={group.vendorId} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{group.vendorName}</p>
                <p className="text-sm font-semibold">{formatCurrency(group.subtotal)}</p>
              </div>
              <div className="space-y-1 pl-3 border-l-2 border-brand-muted">
                {group.lineItems.map((line) => {
                  const isExcluded = excluded.has(line.ingredientId);
                  const altsExpanded = expandedAlts.has(line.ingredientId);
                  const hasAlts = line.alternatives.length > 0;
                  return (
                    <div key={line.ingredientId}>
                      <div
                        className={cn(
                          "flex items-center gap-2 text-xs transition-opacity",
                          isExcluded ? "opacity-40 line-through" : "text-muted-foreground"
                        )}
                      >
                        <span className="flex-1">{line.ingredientName}</span>
                        <span className="text-muted-foreground">{line.packLabel}</span>
                        <span className={cn("font-medium w-14 text-right", !isExcluded && "text-foreground")}>
                          {formatCurrency(line.lineTotal)}
                        </span>
                        {hasAlts && !isExcluded && (
                          <button
                            type="button"
                            title="Show alternative vendors"
                            onClick={() => toggleAlternatives(line.ingredientId)}
                            className="text-muted-foreground hover:text-foreground rounded p-0.5"
                          >
                            <ChevronDown className={cn("h-3 w-3 transition-transform", altsExpanded && "rotate-180")} />
                          </button>
                        )}
                        <button
                          type="button"
                          title={isExcluded ? "Re-add ingredient" : "Remove (I already have this)"}
                          onClick={() => toggleExclude(line.ingredientId)}
                          className={cn(
                            "rounded-full p-0.5 transition-colors shrink-0",
                            isExcluded
                              ? "bg-brand/20 text-brand hover:bg-brand/30"
                              : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          )}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {altsExpanded && hasAlts && !isExcluded && (
                        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-dashed border-muted-foreground/30 pl-2">
                          {line.alternatives.map((alt) => (
                            <div key={alt.vendorId} className="flex items-center gap-2 text-xs text-muted-foreground/70">
                              <span className="flex-1 italic">{alt.vendorName}</span>
                              <span>{alt.packLabel}</span>
                              <span className="w-14 text-right">{formatCurrency(alt.lineTotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {preview?.groups.length === 0 && !previewLoading && (
            <p className="text-sm text-muted-foreground">
              All ingredients removed or none available. Restore some above to continue.
            </p>
          )}
          {preview && preview.groups.length > 0 && (
            <div className="border-t pt-3 flex items-center justify-between font-semibold">
              <span>Estimated total</span>
              <span className="text-brand text-lg">{formatCurrency(preview.grandTotal)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery / pickup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fulfilment method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType("pickup")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                deliveryType === "pickup"
                  ? "border-brand bg-brand-muted text-brand"
                  : "border-border hover:border-brand/50"
              )}
            >
              <MapPin className="h-5 w-5" />
              Pickup
              <span className="text-xs font-normal text-muted-foreground text-center leading-tight">
                Collect from vendor&apos;s location
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryType("delivery")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                deliveryType === "delivery"
                  ? "border-brand bg-brand-muted text-brand"
                  : "border-border hover:border-brand/50"
              )}
            >
              <Truck className="h-5 w-5" />
              Delivery
              <span className="text-xs font-normal text-muted-foreground text-center leading-tight">
                Delivered via Glovo
              </span>
            </button>
          </div>

          {deliveryType === "delivery" && (
            <div className="space-y-2">
              <Label>Delivery address (Madrid only)</Label>
              <AddressAutocomplete
                value={deliveryAddress}
                onChange={setDeliveryAddress}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note to vendor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Note to vendors (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={3}
            placeholder="Allergies, special instructions, preferred pickup time…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleCheckout}
        variant="brand"
        size="lg"
        className="w-full gap-2"
        disabled={loading || (preview?.groups.length === 0 && !previewLoading)}
      >
        {loading ? "Sending request…" : "Send request to vendors"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
