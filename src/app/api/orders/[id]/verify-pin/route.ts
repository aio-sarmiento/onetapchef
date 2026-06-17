import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ pin: z.string().length(4) });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { vendor: true },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isVendor = order.vendor.userId === session.user.id;
  if (!isVendor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (order.status !== "ready_for_pickup") {
    return NextResponse.json({ error: "Order is not ready for pickup" }, { status: 400 });
  }

  const body = await req.json();
  const parse = schema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });

  if (parse.data.pin !== order.pickupPin) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { status: "collected", pickupPin: null },
  });

  return NextResponse.json(updated);
}
