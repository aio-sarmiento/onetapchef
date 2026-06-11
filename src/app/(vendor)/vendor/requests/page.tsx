"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, User, Truck, MapPin, ArrowRight } from "lucide-react";
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
  deliveryType: "pickup" | "delivery";
  deliveryAddress: string | null;
  estimatedTotal: number;
  studentNote: string | null;
  createdAt: string;
  student: { displayName: string; email: string };
  items: OrderItem[];
};

const STATUS_BADGE: Record<string, "available" | "low" | "unavailable" | "expiring" | "secondary"> = {
  pending: "expiring",
  confirmed: "low",
  ready_for_pickup: "available",
  out_for_delivery: "available",
  collected: "secondary",
  delivered: "secondary",
  cancelled: "unavailable",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
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

  const active = orders.filter((o) => !["collected", "delivered", "cancelled"].includes(o.status));
  const history = orders.filter((o) => ["collected", "delivered", "cancelled"].includes(o.status));

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
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      toast({ title: "Order confirmed! Stock deducted automatically." });
      setConfirming(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      const labels: Record<string, string> = {
        ready_for_pickup: "Marked as ready for pickup",
        out_for_delivery: "Dispatched for delivery",
        cancelled: "Order cancelled",
      };
      toast({ title: labels[status] ?? "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Incoming Requests</h1>
        <p className="text-muted-foreground mt-1">
          {active.length} active request{active.length !== 1 ? "s" : ""}
        </p>
      </div>

      {active.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No active requests right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {order.student.displayName}
                      {order.deliveryType === "delivery"
                        ? <Truck className="h-3.5 w-3.5 text-brand" />
                        : <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.student.email} · {formatDate(order.createdAt)}
                      {" · "}{order.deliveryType === "delivery" ? "Glovo delivery" : "Pickup"}
                    </p>
                    {order.deliveryAddress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Deliver to: {order.deliveryAddress}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_BADGE[order.status]}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {order.studentNote && (
                  <p className="text-sm bg-muted rounded-md p-3 italic">&ldquo;{order.studentNote}&rdquo;</p>
                )}

                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 font-medium">{item.ingredient.name}</span>
                      <span className="text-muted-foreground">{Number(item.quantityRequested)} {item.unit}</span>
                      <span className="text-muted-foreground">{formatCurrency(Number(item.pricePerUnit))}/{item.unit}</span>
                      {confirming === order.id && (
                        <input
                          type="number" min="0" step="0.01"
                          className="w-20 border rounded px-2 py-1 text-xs"
                          value={quantities[item.id] ?? Number(item.quantityRequested)}
                          onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: parseFloat(e.target.value) || 0 }))}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-sm font-medium">
                  Estimated total: {formatCurrency(Number(order.estimatedTotal))}
                </div>

                {/* Action buttons based on current status */}
                {order.status === "pending" && (
                  confirming === order.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="brand" onClick={() => confirmMutation.mutate(order.id)} disabled={confirmMutation.isPending}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {confirmMutation.isPending ? "Confirming…" : "Confirm & deduct stock"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Back</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="brand" onClick={() => startConfirm(order)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive"
                        onClick={() => statusMutation.mutate({ orderId: order.id, status: "cancelled" })}
                        disabled={statusMutation.isPending}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Decline
                      </Button>
                    </div>
                  )
                )}

                {order.status === "confirmed" && (
                  <div className="flex gap-2">
                    {order.deliveryType === "pickup" ? (
                      <Button size="sm" variant="brand"
                        onClick={() => statusMutation.mutate({ orderId: order.id, status: "ready_for_pickup" })}
                        disabled={statusMutation.isPending}>
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                        {statusMutation.isPending ? "Updating…" : "Mark ready for pickup"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="brand"
                        onClick={() => statusMutation.mutate({ orderId: order.id, status: "out_for_delivery" })}
                        disabled={statusMutation.isPending}>
                        <Truck className="h-3.5 w-3.5 mr-1" />
                        {statusMutation.isPending ? "Dispatching…" : "Dispatch via Glovo"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Completed & cancelled</h2>
          {history.map((order) => (
            <Card key={order.id} className="opacity-70">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{order.student.displayName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <Badge variant={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                <span className="text-sm font-medium">{formatCurrency(Number(order.estimatedTotal))}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
