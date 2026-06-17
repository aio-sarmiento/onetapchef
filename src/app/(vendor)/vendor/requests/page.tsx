"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, User, Truck, MapPin, ArrowRight, Key, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  vendorNote: string | null;
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

type Tab = "pending" | "in-progress" | "history";

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export default function VendorRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["vendor-orders"],
    queryFn: fetchOrders,
  });

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const inProgressOrders = orders.filter((o) => ["confirmed", "ready_for_pickup", "out_for_delivery"].includes(o.status));
  const historyOrders = orders.filter((o) => ["collected", "delivered", "cancelled"].includes(o.status));

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
      setTab("in-progress");
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
        ready_for_pickup: "Marked as ready — PIN sent to student",
        out_for_delivery: "Dispatched for delivery",
        cancelled: "Order cancelled",
      };
      toast({ title: labels[status] ?? "Updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const verifyPinMutation = useMutation({
    mutationFn: async ({ orderId, pin }: { orderId: string; pin: string }) => {
      const res = await fetch(`/api/orders/${orderId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      toast({ title: "Pickup confirmed! Order complete." });
      setPinInputs({});
    },
    onError: (e) => toast({ title: "Incorrect PIN", description: e.message, variant: "destructive" }),
  });

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pendingOrders.length },
    { key: "in-progress", label: "In Progress", count: inProgressOrders.length },
    { key: "history", label: "History", count: historyOrders.length },
  ];

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground mt-1">
          {pendingOrders.length} pending · {inProgressOrders.length} in progress
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2",
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold",
                tab === t.key ? "bg-brand text-white" : "bg-muted text-muted-foreground"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === "pending" && (
        <div className="space-y-4">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium">All caught up!</p>
              <p className="text-sm mt-1">No pending requests right now.</p>
            </div>
          ) : (
            pendingOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {order.student.displayName}
                        {order.deliveryType === "delivery"
                          ? <Truck className="h-3.5 w-3.5 text-brand" />
                          : <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.student.email} · {formatDate(order.createdAt)}
                        {" · "}{order.deliveryType === "delivery" ? "Glovo delivery" : "Pickup"}
                      </p>
                      {order.deliveryAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5">Deliver to: {order.deliveryAddress}</p>
                      )}
                    </div>
                    <Badge variant="expiring">Pending</Badge>
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
                  {confirming === order.id ? (
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
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* In Progress tab */}
      {tab === "in-progress" && (
        <div className="space-y-4">
          {inProgressOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No orders in progress</p>
            </div>
          ) : (
            inProgressOrders.map((order) => (
              <Card key={order.id} className={cn(order.status === "ready_for_pickup" && "border-amber-300")}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {order.student.displayName}
                        {order.deliveryType === "delivery"
                          ? <Truck className="h-3.5 w-3.5 text-brand" />
                          : <MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.student.email} · {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm">
                        <span className="flex-1">{item.ingredient.name}</span>
                        <span className="text-muted-foreground">
                          {item.quantityConfirmed != null
                            ? `${item.quantityConfirmed} ${item.unit} confirmed`
                            : `${Number(item.quantityRequested)} ${item.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-medium">
                    Total: {formatCurrency(Number(order.estimatedTotal))}
                  </div>

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

                  {/* PIN verification for pickup */}
                  {order.status === "ready_for_pickup" && order.deliveryType === "pickup" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Key className="h-4 w-4" />
                        <span className="text-sm font-semibold">Waiting for student pickup</span>
                      </div>
                      <p className="text-xs text-amber-600">Ask the student for their 4-digit pickup code.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="Enter PIN"
                          className="w-28 border rounded-lg px-3 py-2 text-center text-lg font-bold tracking-widest"
                          value={pinInputs[order.id] ?? ""}
                          onChange={(e) => setPinInputs((p) => ({ ...p, [order.id]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                        />
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() => verifyPinMutation.mutate({ orderId: order.id, pin: pinInputs[order.id] ?? "" })}
                          disabled={!pinInputs[order.id] || pinInputs[order.id].length !== 4 || verifyPinMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          {verifyPinMutation.isPending ? "Verifying…" : "Confirm pickup"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-4">
          {historyOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No completed orders yet</p>
            </div>
          ) : (
            historyOrders.map((order) => (
              <Card key={order.id} className="opacity-90">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{order.student.displayName}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.student.email} · {formatDate(order.createdAt)}
                        {" · "}{order.deliveryType === "delivery" ? "Delivery" : "Pickup"}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    {order.items.map((item) => {
                      const qty = item.quantityConfirmed ?? item.quantityRequested;
                      const lineTotal = Number(qty) * Number(item.pricePerUnit);
                      return (
                        <div key={item.id} className="flex items-center gap-3 text-sm">
                          <span className="flex-1 text-muted-foreground">{item.ingredient.name}</span>
                          <span>{Number(qty)} {item.unit}</span>
                          <span className="text-muted-foreground">× {formatCurrency(Number(item.pricePerUnit))}</span>
                          <span className="font-medium w-16 text-right">{formatCurrency(lineTotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t text-sm font-semibold">
                    <span>Order total</span>
                    <span>{formatCurrency(Number(order.estimatedTotal))}</span>
                  </div>
                  {order.vendorNote && (
                    <p className="text-xs text-muted-foreground italic">{order.vendorNote}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
