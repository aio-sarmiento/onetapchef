-- Migration v4: Performance indexes for basket preview hot path
-- Run in: Supabase Dashboard → SQL Editor
-- CONCURRENTLY means no table lock — safe to run on live DB

-- vendor_stock: the most-queried table (preview + checkout)
-- Partial index covers only active, in-stock rows — much smaller than full table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_stock_active_lookup
  ON vendor_stock(ingredient_id, vendor_id, expiry_date, price_per_unit)
  WHERE status IN ('available', 'low') AND quantity_available > 0;

-- Separate index for vendor_id lookups (pre-fetch verified vendors query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_stock_vendor_id
  ON vendor_stock(vendor_id);

-- recipe_ingredients: queried in every recipe fetch and availability check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON recipe_ingredients(recipe_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recipe_ingredients_ingredient_id
  ON recipe_ingredients(ingredient_id);

-- vendor_profiles: only for the pre-fetch verified vendors query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_profiles_verified
  ON vendor_profiles(is_admin_verified)
  WHERE is_admin_verified = true;

-- ingredients: purchasable flag check during aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingredients_purchasable
  ON ingredients(id)
  WHERE purchasable = true;
