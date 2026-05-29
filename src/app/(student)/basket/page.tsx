"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBasket, ChefHat, ArrowRight } from "lucide-react";
import { useBasketStore } from "@/stores/basket-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function BasketPage() {
  const { items, removeItem, updateServings, clearBasket } = useBasketStore();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCheckout() {
    if (items.length === 0) return;
    setLoading(true);

    const res = await fetch("/api/basket/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ recipeId: i.recipeId, servings: i.servings })),
        studentNote: note || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast({
        title: "Checkout failed",
        description: data.error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Request sent!",
      description: `${data.orders.length} order(s) sent to vendor(s).`,
    });
    clearBasket();
    router.push("/orders");
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <ShoppingBasket className="h-16 w-16 text-muted-foreground" />
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Basket</h1>
        <Button variant="ghost" size="sm" onClick={clearBasket} className="text-muted-foreground">
          Clear all
        </Button>
      </div>

      <div className="space-y-4">
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
                  <Link
                    href={`/recipes/${item.slug}`}
                    className="font-medium hover:underline line-clamp-1"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Base: {item.baseServings} servings
                  </p>
                </div>

                {/* Portion adjuster */}
                <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1 shrink-0">
                  <button
                    onClick={() => updateServings(item.recipeId, item.servings - 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.servings}</span>
                  <button
                    onClick={() => updateServings(item.recipeId, item.servings + 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.recipeId)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Note to vendor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Note to vendors (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={3}
            placeholder="Any allergies, special instructions, preferred pickup time…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
        Your basket will create one ingredient request per vendor. Vendors will confirm
        availability and contact you to arrange collection.
      </div>

      <Button
        onClick={handleCheckout}
        variant="brand"
        size="lg"
        className="w-full gap-2"
        disabled={loading}
      >
        {loading ? "Sending request…" : "Send request to vendors"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
