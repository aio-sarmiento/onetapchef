"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Order = {
  id: string;
  status: string;
  estimatedTotal: number;
  createdAt: string;
  student: { displayName: string };
  items: { id: string; quantityConfirmed: number | null; quantityRequested: number; unit: string; ingredient: { name: string } }[];
};

const STATUS_BADGE: Record<string, "available" | "low" | "expiring" | "secondary" | "unavailable"> = {
  pending: "expiring",
  confirmed: "low",
  ready: "available",
  completed: "secondary",
  cancelled: "unavailable",
};

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function VendorOrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["vendor-orders"], queryFn: fetchOrders });

  const readyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendor-orders"] }); toast({ title: "Marked as ready!" }); },
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Order History</h1>
      {orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No orders yet.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{order.student.displayName}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_BADGE[order.status]}>{order.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <span className="flex-1">{item.ingredient.name}</span>
                    <span className="text-muted-foreground">
                      {item.quantityConfirmed ?? Number(item.quantityRequested)} {item.unit}
                    </span>
                  </div>
                ))}
                <div className="text-sm font-medium">{formatCurrency(Number(order.estimatedTotal))}</div>
                {order.status === "confirmed" && (
                  <Button size="sm" variant="brand" onClick={() => readyMutation.mutate(order.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Mark ready for collection
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
