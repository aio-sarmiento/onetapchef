import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local first, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createOrGetAuthUser(email: string, password: string, role: string, displayName: string) {
  const { data: list } = await adminClient.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);

  if (existing) {
    // Update metadata in case it was created without it
    await adminClient.auth.admin.updateUserById(existing.id, {
      user_metadata: { role, displayName },
      password,
    });
    console.log(`  Updated auth user: ${email} (${existing.id}) role=${role}`);
    return existing.id;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, displayName },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create auth user ${email}: ${error?.message}`);
  }
  console.log(`  Created auth user: ${email} (${data.user.id}) role=${role}`);
  return data.user.id;
}

async function main() {
  console.log("\n=== OneTapChef Dev Users Seed ===\n");

  // ── STUDENT ────────────────────────────────────────────────
  console.log("Creating student account...");
  const studentEmail = "student@onetapchef.dev";
  const studentPassword = "devpass123!";

  const studentId = await createOrGetAuthUser(studentEmail, studentPassword, "student", "Demo Student");

  await prisma.user.upsert({
    where: { id: studentId },
    update: {},
    create: { id: studentId, email: studentEmail, role: "student", displayName: "Demo Student" },
  });

  await prisma.studentProfile.upsert({
    where: { userId: studentId },
    update: {},
    create: { userId: studentId, dietaryTags: [] },
  });

  await prisma.basket.upsert({
    where: { studentId },
    update: {},
    create: { studentId },
  });

  console.log("  ✓ Student ready\n");

  // ── VENDOR ─────────────────────────────────────────────────
  console.log("Creating vendor account...");
  const vendorEmail = "vendor@onetapchef.dev";
  const vendorPassword = "devpass123!";

  const vendorId = await createOrGetAuthUser(vendorEmail, vendorPassword, "vendor", "Demo Vendor");

  await prisma.user.upsert({
    where: { id: vendorId },
    update: {},
    create: { id: vendorId, email: vendorEmail, role: "vendor", displayName: "Demo Vendor" },
  });

  await prisma.vendorProfile.upsert({
    where: { userId: vendorId },
    update: { isAdminVerified: true },
    create: {
      userId: vendorId,
      businessName: "Demo Market",
      city: "Madrid",
      address: "Calle Gran Vía 1, Madrid",
      isAdminVerified: true,
      contactPhone: "+34 600 000 000",
    },
  });

  console.log("  ✓ Vendor ready (pre-verified)\n");

  // ── SUMMARY ────────────────────────────────────────────────
  console.log("=== Login credentials ===");
  console.log(`Student  →  ${studentEmail}  /  ${studentPassword}`);
  console.log(`Vendor   →  ${vendorEmail}  /  ${vendorPassword}`);
  console.log("\nBoth accounts are pre-confirmed and ready to use.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
