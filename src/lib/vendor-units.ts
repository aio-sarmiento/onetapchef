export type PackDef = {
  size: number;   // grams or ml per pack (category default)
  unit: string;   // display unit
  label: string;  // e.g. "500g bag", "50g jar"
};

export const PACK_SIZES: Record<string, PackDef> = {
  "Protein":    { size: 200,  unit: "g",  label: "200g pack"    },
  "Vegetable":  { size: 200,  unit: "g",  label: "200g"         },
  "Fruit":      { size: 150,  unit: "g",  label: "piece"        },
  "Dairy":      { size: 250,  unit: "g",  label: "250g"         },
  "Grain":      { size: 500,  unit: "g",  label: "500g bag"     },
  "Spice":      { size: 50,   unit: "g",  label: "50g jar"      },
  "Condiment":  { size: 250,  unit: "ml", label: "250ml bottle" },
  "Baking":     { size: 250,  unit: "g",  label: "250g pack"    },
  "Nut & Seed": { size: 100,  unit: "g",  label: "100g bag"     },
  "Other":      { size: 100,  unit: "g",  label: "100g"         },
};

// Price per 100g/100ml in euros — stored this way to fit DECIMAL(10,2) column.
// Divide by 100 when computing per-gram cost in checkout/preview.
// Based on Madrid supermarket prices.
export const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  "Protein":    { min: 1.00, max: 2.20 },
  "Vegetable":  { min: 0.10, max: 0.40 },
  "Fruit":      { min: 0.15, max: 0.50 },
  "Dairy":      { min: 0.20, max: 1.20 },
  "Grain":      { min: 0.10, max: 0.30 },
  "Spice":      { min: 0.60, max: 2.00 },
  "Condiment":  { min: 0.20, max: 0.80 },
  "Baking":     { min: 0.10, max: 0.30 },
  "Nut & Seed": { min: 0.80, max: 1.80 },
  "Other":      { min: 0.10, max: 0.50 },
};

export function getPackDef(category: string): PackDef {
  return PACK_SIZES[category] ?? PACK_SIZES["Other"];
}

/**
 * Rounds required quantity up to the nearest full vendor pack.
 * packageSizeOverride: vendor-configured pack size (grams/ml); falls back to category default.
 */
export function roundToPacks(
  requiredQty: number,
  category: string,
  packageSizeOverride?: number
): { packs: number; totalQty: number; packDef: PackDef; packLabel: string } {
  const packDef = getPackDef(category);
  const packSize = packageSizeOverride ?? packDef.size;
  const packs = Math.max(1, Math.ceil(requiredQty / packSize));
  const totalQty = packs * packSize;
  // Use numeric label when using vendor's actual size, descriptive label for category default
  const sizeLabel = packageSizeOverride
    ? `${packSize}${packDef.unit}`
    : packDef.label;
  const packLabel = packs === 1 ? `1 × ${sizeLabel}` : `${packs} × ${sizeLabel}`;
  return { packs, totalQty, packDef, packLabel };
}

/**
 * Scores a vendor option for a given required quantity.
 * Lower score = better. Penalises waste so a tighter pack wins over a cheaper-per-gram but wasteful one.
 * pricePer100g: pricePerUnit field (€/100g).
 */
export function scoreVendorOption(
  requiredQty: number,
  packageSize: number,
  pricePer100g: number
): number {
  const packs = Math.max(1, Math.ceil(requiredQty / packageSize));
  const totalQty = packs * packageSize;
  const totalCost = (totalQty / 100) * pricePer100g;
  const wasteRatio = totalQty > 0 ? (totalQty - Math.min(requiredQty, totalQty)) / totalQty : 0;
  // Each 10% waste adds ~3% to effective cost score
  return totalCost * (1 + 0.3 * wasteRatio);
}

export function realisticPrice(category: string, ingredientId: string): number {
  const range = PRICE_RANGES[category] ?? PRICE_RANGES["Other"];
  const hash = (ingredientId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 100) / 100;
  const price = range.min + hash * (range.max - range.min);
  return Math.round(price * 100) / 100;
}
