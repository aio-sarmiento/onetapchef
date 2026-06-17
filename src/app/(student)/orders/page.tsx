"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, CheckCircle, Truck, MapPin, Clock, ChevronDown, ChevronUp, Key, ExternalLink } from "lucide-react";
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
  pickupPin: string | null;
  createdAt: string;
  vendor: { businessName: string; city: string; address: string; contactPhone: string | null };
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting vendor",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  out_for_delivery: "Out for delivery",
  collected: "Collected",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function StepTracker({ status, deliveryType }: { status: string; deliveryType: "pickup" | "delivery" }) {
  if (status === "cancelled") return <Badge variant="unavailable">Cancelled</Badge>;
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

function PinDisplay({ pin }: { pin: string }) {
  return (
    <div className="rounded-xl border-2 border-brand bg-brand-muted p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2 text-brand">
        <Key className="h-4 w-4" />
        <span className="text-sm font-semibold">Your pickup code</span>
      </div>
      <div className="flex items-center justify-center gap-3 my-3">
        {pin.split("").map((digit, i) => (
          <div key={i} className="w-12 h-14 rounded-lg bg-white border-2 border-brand flex items-center justify-center text-3xl font-bold text-brand shadow-sm">
            {digit}
          </div>
        ))}
      </div>
      <p className="text-xs text-brand/70 font-medium">Show this code to the vendor</p>
    </div>
  );
}

function OrderCard({ order, defaultExpanded = false }: { order: Order; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isReady = order.status === "ready_for_pickup" && order.deliveryType === "pickup";
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(order.vendor.address + ", " + order.vendor.city)}`;

  return (
    <Card className={cn(isReady && "border-green-400 shadow-green-100 shadow-md")}>
      {/* Ready for pickup banner */}
      {isReady && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2.5 rounded-t-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-green-700">Ready for pickup!</span>
          <span className="text-xs text-green-600 ml-1">Head to {order.vendor.businessName}</span>
        </div>
      )}

      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {order.deliveryType === "delivery"
                  ? <Truck className="h-4 w-4 text-brand" />
                  : <MapPin className="h-4 w-4 text-brand" />}
                {order.vendor.businessName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {order.vendor.city} · {formatDate(order.createdAt)}
                {order.deliveryType === "delivery" ? " · Glovo delivery" : " · Pickup"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">
                {STATUS_LABELS[order.status] ?? order.status}
              </span>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          <StepTracker status={order.status} deliveryType={order.deliveryType} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Items */}
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

          <div className="text-sm font-semibold">
            Total: {formatCurrency(Number(order.estimatedTotal))}
          </div>

          {order.vendorNote && (
            <p className="text-sm bg-muted rounded-md p-3 italic">
              Vendor: &ldquo;{order.vendorNote}&rdquo;
            </p>
          )}

          {/* Vendor address + contact (shown from confirmed onwards for pickup) */}
          {order.deliveryType === "pickup" && ["confirmed", "ready_for_pickup"].includes(order.status) && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup location</p>
              <p className="text-sm font-medium">{order.vendor.address}, {order.vendor.city}</p>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Get directions
              </a>
              {order.vendor.contactPhone && (
                <p className="text-sm text-muted-foreground">
                  Phone: <span className="font-medium text-foreground">{order.vendor.contactPhone}</span>
                </p>
              )}
            </div>
          )}

          {/* Pickup PIN */}
          {isReady && order.pickupPin && (
            <PinDisplay pin={order.pickupPin} />
          )}

          {/* Delivery tracking */}
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
        </CardContent>
      )}
    </Card>
  );
}

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function StudentOrdersPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["student-orders"],
    queryFn: fetchOrders,
  });

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const activeOrders = orders.filter((o) => ["confirmed", "ready_for_pickup", "out_for_delivery"].includes(o.status));
  const historyOrders = orders.filter((o) => TERMINAL.has(o.status));

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
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {(["active", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === t
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "active" ? (
                  <>Active {pendingOrders.length + activeOrders.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand text-white text-xs">
                      {pendingOrders.length + activeOrders.length}
                    </span>
                  )}</>
                ) : (
                  <>History {historyOrders.length > 0 && (
                    <span className="ml-1.5 text-xs text-muted-foreground">({historyOrders.length})</span>
                  )}</>
                )}
              </button>
            ))}
          </div>

          {tab === "active" && (
            <div className="space-y-6">
              {/* Pending section */}
              {pendingOrders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Waiting for vendors ({pendingOrders.length})
                    </h2>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                    <p className="text-sm text-amber-700">
                      Your request has been sent. Vendors will confirm and adjust quantities if needed.
                    </p>
                    {pendingOrders.map((order) => (
                      <OrderCard key={order.id} order={order} defaultExpanded={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Active (confirmed / ready / in transit) */}
              {activeOrders.length > 0 && (
                <div className="space-y-3">
                  {pendingOrders.length > 0 && (
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">In progress</h2>
                  )}
                  {activeOrders.map((order) => (
                    <OrderCard key={order.id} order={order} defaultExpanded={true} />
                  ))}
                </div>
              )}

              {pendingOrders.length === 0 && activeOrders.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No active orders</p>
                  <p className="text-sm mt-1">All caught up! Check History for past orders.</p>
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {historyOrders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No completed orders yet</p>
                </div>
              ) : (
                historyOrders.map((order) => (
                  <OrderCard key={order.id} order={order} defaultExpanded={false} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
