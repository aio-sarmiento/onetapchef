"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type OrderItem = {
  id: string;
  quantityRequested: number;
  quantityConfirmed: number | null;
  unit: string;
  pricePerUnit: number;
  ingredient: { name: string };
};

type Order = {
  id: string;
  status: string;
  estimatedTotal: number;
  studentNote: string | null;
  createdAt: string;
  student: { displayName: string; email: string };
  items: OrderItem[];
};

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export default function VendorRequestsPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["vendor-orders"],
    queryFn: fetchOrders,
  });

  const pending = orders.filter((o) => o.status === "pending");

  const [confirming, setConfirming] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  function startConfirm(order: Order) {
    const defaults: Record<string, number> = {};
    order.items.forEach((i) => { defaults[i.id] = Number(i.quantityRequested); });
    setQuantities(defaults);
    setConfirming(order.id);
  }

  const confirmMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new Error("Not found");
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmedItems: order.items.map((i) => ({
            orderItemId: i.id,
            quantityConfirmed: quantities[i.id] ?? 0,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      toast({ title: "Order confirmed!" });
      setConfirming(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      toast({ title: "Order cancelled" });
    },
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Incoming Requests</h1>
        <p className="text-muted-foreground mt-1">
          {pending.length} pending request{pending.length !== 1 ? "s" : ""}
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No pending ingredient requests.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {order.student.displayName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.student.email} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <Badge variant="expiring">Pending</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {order.studentNote && (
                  <p className="text-sm bg-muted rounded-md p-3 italic">
                    &ldquo;{order.studentNote}&rdquo;
                  </p>
                )}

                {/* Line items */}
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 font-medium">{item.ingredient.name}</span>
                      <span className="text-muted-foreground">
                        {Number(item.quantityRequested)} {item.unit}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(Number(item.pricePerUnit))}/{item.unit}
                      </span>

                      {confirming === order.id && (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-20 border rounded px-2 py-1 text-xs"
                          value={quantities[item.id] ?? Number(item.quantityRequested)}
                          onChange={(e) =>
                            setQuantities((q) => ({ ...q, [item.id]: parseFloat(e.target.value) || 0 }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-sm font-medium">
                  Estimated total: {formatCurrency(Number(order.estimatedTotal))}
                </div>

                {confirming === order.id ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={() => confirmMutation.mutate(order.id)}
                      disabled={confirmMutation.isPending}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      {confirmMutation.isPending ? "Confirming…" : "Confirm fulfilment"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                      Back
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="brand" onClick={() => startConfirm(order)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => cancelMutation.mutate(order.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
