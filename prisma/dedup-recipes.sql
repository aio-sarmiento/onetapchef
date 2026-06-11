-- Deduplicate recipes: for each title, keep the cleanest slug (no numeric-ID suffix)
-- and delete the rest. Cascade handles recipe_ingredients, basket_items, saved_recipes.

WITH ranked AS (
  SELECT
    id,
    title,
    slug,
    ROW_NUMBER() OVER (
      PARTITION BY lower(title)
      ORDER BY
        -- prefer slugs that do NOT end in a 4-6 digit numeric ID (original clean slugs)
        (slug ~ '-[0-9]{4,6}$')::int ASC,
        created_at ASC
    ) AS rn
  FROM recipes
)
DELETE FROM recipes
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
```
