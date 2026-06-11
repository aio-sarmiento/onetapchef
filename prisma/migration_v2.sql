-- OneTapChef v2 Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ──────────────────────────────────────────────

-- 1. Replace OrderStatus enum
-- Drop the default first so the column can be retyped freely
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'pending',
  'confirmed',
  'ready_for_pickup',
  'out_for_delivery',
  'collected',
  'delivered',
  'cancelled'
);

ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'pending'   THEN 'pending'::"OrderStatus"
      WHEN 'confirmed' THEN 'confirmed'::"OrderStatus"
      WHEN 'ready'     THEN 'ready_for_pickup'::"OrderStatus"
      WHEN 'completed' THEN 'collected'::"OrderStatus"
      WHEN 'cancelled' THEN 'cancelled'::"OrderStatus"
      ELSE 'pending'::"OrderStatus"
    END
  );

-- Restore the default using the new type
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"OrderStatus";

DROP TYPE "OrderStatus_old";

-- 2. Add DeliveryType enum
CREATE TYPE "DeliveryType" AS ENUM ('pickup', 'delivery');

-- 3. Add delivery fields to orders table
ALTER TABLE "orders"
  ADD COLUMN "delivery_type"      "DeliveryType" NOT NULL DEFAULT 'pickup',
  ADD COLUMN "delivery_address"   TEXT,
  ADD COLUMN "glovo_order_id"     TEXT,
  ADD COLUMN "glovo_tracking_url" TEXT;

-- 4. Create saved_recipes table
CREATE TABLE "saved_recipes" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"    TEXT NOT NULL,
  "recipe_id"  TEXT NOT NULL,
  "saved_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_recipes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_recipes_user_id_recipe_id_key"
  ON "saved_recipes"("user_id", "recipe_id");

ALTER TABLE "saved_recipes"
  ADD CONSTRAINT "saved_recipes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_recipes"
  ADD CONSTRAINT "saved_recipes_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
