import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  status: z.enum(["ready", "completed", "cancelled"]),
  note: z.string().max(500).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { vendor: true },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isStudent = order.studentId === user.id;
  const isVendor = order.vendor.userId === user.id;

  if (!isStudent && !isVendor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parse = statusSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { status, note } = parse.data;

  // Enforce transition rules
  if (status === "ready" && !isVendor) {
    return NextResponse.json({ error: "Only vendor can mark ready" }, { status: 403 });
  }
  if (status === "completed" && !isStudent) {
    return NextResponse.json({ error: "Only student can mark completed" }, { status: 403 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      status,
      ...(isVendor && note ? { vendorNote: note } : {}),
      ...(isStudent && note ? { studentNote: note } : {}),
    },
  });

  return NextResponse.json(updated);
}
