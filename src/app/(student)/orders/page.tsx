"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Order = {
  id: string;
  status: string;
  estimatedTotal: number;
  studentNote: string | null;
  vendorNote: string | null;
  createdAt: string;
  vendor: { businessName: string; city: string; contactPhone: string | null };
  items: {
    id: string;
    quantityRequested: number;
    quantityConfirmed: number | null;
    unit: string;
    pricePerUnit: number;
    ingredient: { name: string };
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending vendor response",
  confirmed: "Confirmed — ready soon",
  ready: "Ready for collection",
  completed: "Collected",
  cancelled: "Cancelled",
};

const STATUS_BADGE: Record<string, "available" | "low" | "unavailable" | "expiring" | "secondary"> = {
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

export default function StudentOrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["student-orders"],
    queryFn: fetchOrders,
  });

  const completeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-orders"] });
      toast({ title: "Marked as collected!" });
    },
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">No orders yet</p>
          <p className="text-sm mt-1">Build a basket and send your first ingredient request.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{order.vendor.businessName}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.vendor.city} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[order.status]}>
                    {STATUS_LABELS[order.status]}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1">{item.ingredient.name}</span>
                      <span className="text-muted-foreground">
                        {item.quantityConfirmed != null
                          ? `${item.quantityConfirmed} / ${Number(item.quantityRequested)} ${item.unit}`
                          : `${Number(item.quantityRequested)} ${item.unit}`}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(Number(item.pricePerUnit))}/{item.unit}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-sm font-medium">
                  Total: {formatCurrency(Number(order.estimatedTotal))}
                </div>

                {order.vendorNote && (
                  <p className="text-sm bg-muted rounded-md p-3 italic">
                    Vendor: &ldquo;{order.vendorNote}&rdquo;
                  </p>
                )}

                {order.vendor.contactPhone && order.status === "confirmed" && (
                  <p className="text-sm text-muted-foreground">
                    Contact vendor: <span className="font-medium">{order.vendor.contactPhone}</span>
                  </p>
                )}

                {order.status === "ready" && (
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={() => completeMutation.mutate(order.id)}
                    disabled={completeMutation.isPending}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Mark as collected
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
