import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Package, ClipboardList, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const vendor = await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!vendor) redirect("/auth/login");

  if (!vendor.isAdminVerified) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <h2 className="text-2xl font-semibold">Account pending verification</h2>
        <p className="text-muted-foreground">
          Your vendor account is under review. We&apos;ll notify you within 24 hours once it&apos;s approved.
        </p>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeStock, pendingOrders, expiringCount] = await Promise.all([
    prisma.vendorStock.count({
      where: { vendorId: vendor.id, status: { in: ["available", "low"] } },
    }),
    prisma.order.count({
      where: { vendorId: vendor.id, status: "pending" },
    }),
    prisma.vendorStock.count({
      where: {
        vendorId: vendor.id,
        status: { in: ["available", "low"] },
        expiryDate: {
          gte: today,
          lte: new Date(today.getTime() + 48 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const recentRequests = await prisma.order.findMany({
    where: { vendorId: vendor.id, status: "pending" },
    include: {
      student: { select: { displayName: true } },
      items: { include: { ingredient: { select: { name: true } } }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, {vendor.businessName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Active listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Pending requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingOrders}</div>
            {pendingOrders > 0 && (
              <Button asChild size="sm" variant="brand" className="mt-2">
                <Link href="/vendor/requests">View requests</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className={expiringCount > 0 ? "border-orange-300" : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Expiring &lt;48h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${expiringCount > 0 ? "text-orange-600" : ""}`}>
              {expiringCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button asChild variant="brand">
          <Link href="/vendor/stock">
            <Package className="h-4 w-4 mr-2" />
            Manage stock
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/vendor/requests">
            <ClipboardList className="h-4 w-4 mr-2" />
            View requests
          </Link>
        </Button>
      </div>

      {/* Recent pending requests */}
      {recentRequests.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Pending requests</h2>
          <div className="space-y-3">
            {recentRequests.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{order.student.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.items.map((i) => i.ingredient.name).join(", ")}
                      {order.items.length === 3 && "…"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/vendor/requests">Review</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
