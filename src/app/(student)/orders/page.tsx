"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, CheckCircle, Truck, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Order = {
  id: string;
  status: string;
  deliveryType: "pickup" | "delivery";
  deliveryAddress: string | null;
  glovoTrackingUrl: string | null;
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

const PICKUP_STEPS = [
  { key: "pending", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
  { key: "ready_for_pickup", label: "Ready" },
  { key: "collected", label: "Collected" },
];

const DELIVERY_STEPS = [
  { key: "pending", label: "Sent" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

const TERMINAL = new Set(["collected", "delivered", "cancelled"]);

function StepTracker({ status, deliveryType }: { status: string; deliveryType: "pickup" | "delivery" }) {
  if (status === "cancelled") {
    return <Badge variant="unavailable">Cancelled</Badge>;
  }

  const steps = deliveryType === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
  const currentIdx = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => {
        const done = i < currentIdx || (i === currentIdx && TERMINAL.has(status));
        const active = i === currentIdx && !TERMINAL.has(status);
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
              done ? "bg-brand text-white" : active ? "bg-brand-muted text-brand border border-brand" : "bg-muted text-muted-foreground"
            )}>
              {done && <CheckCircle className="h-3 w-3" />}
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-4 h-px", i < currentIdx ? "bg-brand" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting vendor",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
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

  const collectMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "collected" }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-orders"] });
      toast({ title: "Order marked as collected!" });
    },
  });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-24 flex flex-col items-center gap-4">
          <div className="bg-brand-muted rounded-full p-6">
            <Package className="h-12 w-12 text-brand" />
          </div>
          <h2 className="text-xl font-semibold">No orders yet</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Build a basket and send your first ingredient request to a vendor.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {order.deliveryType === "delivery"
                          ? <Truck className="h-4 w-4 text-brand" />
                          : <MapPin className="h-4 w-4 text-brand" />
                        }
                        {order.vendor.businessName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.vendor.city} · {formatDate(order.createdAt)}
                        {order.deliveryType === "delivery" ? " · Glovo delivery" : " · Pickup"}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <StepTracker status={order.status} deliveryType={order.deliveryType} />
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

                {order.deliveryAddress && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    Delivering to: {order.deliveryAddress}
                  </p>
                )}

                {order.glovoTrackingUrl && (
                  <a
                    href={order.glovoTrackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand underline flex items-center gap-1"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Track Glovo delivery
                  </a>
                )}

                {order.vendor.contactPhone && order.status === "confirmed" && order.deliveryType === "pickup" && (
                  <p className="text-sm text-muted-foreground">
                    Contact vendor: <span className="font-medium">{order.vendor.contactPhone}</span>
                  </p>
                )}

                {order.status === "ready_for_pickup" && order.deliveryType === "pickup" && (
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={() => collectMutation.mutate(order.id)}
                    disabled={collectMutation.isPending}
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
