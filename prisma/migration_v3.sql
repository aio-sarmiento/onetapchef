-- Migration v3: purchasable flag, vendor package sizes, promotion system

-- 1. Non-purchasable flag on ingredients (water etc. excluded from carts)
ALTER TABLE "ingredients" ADD COLUMN IF NOT EXISTS "purchasable" BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "ingredients"
SET "purchasable" = FALSE
WHERE lower(name) IN (
  'water', 'tap water', 'cold water', 'hot water', 'boiling water',
  'ice', 'ice cubes', 'crushed ice'
);

-- 2. Vendor-configurable package size (grams or ml per package)
ALTER TABLE "vendor_stock" ADD COLUMN IF NOT EXISTS "package_size" DECIMAL(10,2) NOT NULL DEFAULT 100;

-- Back-fill from ingredient category using standard pack sizes
UPDATE "vendor_stock" vs
SET "package_size" = CASE i.category
  WHEN 'Protein'    THEN 200
  WHEN 'Vegetable'  THEN 200
  WHEN 'Fruit'      THEN 150
  WHEN 'Dairy'      THEN 250
  WHEN 'Grain'      THEN 500
  WHEN 'Spice'      THEN 50
  WHEN 'Condiment'  THEN 250
  WHEN 'Baking'     THEN 250
  WHEN 'Nut & Seed' THEN 100
  ELSE 100
END
FROM "ingredients" i
WHERE vs."ingredient_id" = i."id";

-- 3. Promotion flag (true = visible in student cart matching)
ALTER TABLE "vendor_stock" ADD COLUMN IF NOT EXISTS "is_promoted" BOOLEAN NOT NULL DEFAULT TRUE;
