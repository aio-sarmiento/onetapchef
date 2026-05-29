import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/server";

const baseSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["student", "vendor"]),
  displayName: z.string().min(1).max(80),
});

const vendorSchema = baseSchema.extend({
  role: z.literal("vendor"),
  businessName: z.string().min(1).max(120),
  city: z.string().min(1).max(80),
  address: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parse = baseSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }

  const { email, password, role, displayName } = parse.data;

  const supabase = await createServiceClient();

  // Create the Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role, displayName },
    email_confirm: false,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Auth error" }, { status: 400 });
  }

  const userId = authData.user.id;

  try {
    // Create the users row
    await prisma.user.create({
      data: {
        id: userId,
        email,
        role,
        displayName,
      },
    });

    // Create the role-specific profile
    if (role === "vendor") {
      const vParse = vendorSchema.safeParse(body);
      if (!vParse.success) {
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: "Missing vendor fields" }, { status: 400 });
      }
      const { businessName, city, address } = vParse.data;
      await prisma.vendorProfile.create({
        data: { userId, businessName, city, address },
      });
    } else {
      await prisma.studentProfile.create({ data: { userId, dietaryTags: [] } });
      // Pre-create an empty basket for the student
      await prisma.basket.create({ data: { studentId: userId } });
    }

    // Send confirmation email via Supabase
    await supabase.auth.admin.generateLink({
      type: "signup",
      email,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // Roll back the auth user if DB write fails
    await supabase.auth.admin.deleteUser(userId);
    console.error(err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
