// Defines the minimum pack size a vendor would sell per ingredient category
// and realistic price ranges (€/g or €/ml) for Madrid market

export type PackDef = {
  size: number;   // grams or ml per pack
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
  "Protein":    { min: 1.00, max: 2.20 }, // 10-22€/kg
  "Vegetable":  { min: 0.10, max: 0.40 }, // 1-4€/kg
  "Fruit":      { min: 0.15, max: 0.50 }, // 1.5-5€/kg
  "Dairy":      { min: 0.20, max: 1.20 }, // 2-12€/kg
  "Grain":      { min: 0.10, max: 0.30 }, // 1-3€/kg
  "Spice":      { min: 0.60, max: 2.00 }, // 6-20€/kg
  "Condiment":  { min: 0.20, max: 0.80 }, // 2-8€/L
  "Baking":     { min: 0.10, max: 0.30 }, // 1-3€/kg
  "Nut & Seed": { min: 0.80, max: 1.80 }, // 8-18€/kg
  "Other":      { min: 0.10, max: 0.50 },
};

export function getPackDef(category: string): PackDef {
  return PACK_SIZES[category] ?? PACK_SIZES["Other"];
}

// Rounds a required quantity up to the nearest full vendor pack.
// Returns the number of packs and the total quantity that will be ordered.
export function roundToPacks(
  requiredQty: number,
  category: string
): { packs: number; totalQty: number; packDef: PackDef; packLabel: string } {
  const packDef = getPackDef(category);
  const packs = Math.max(1, Math.ceil(requiredQty / packDef.size));
  const totalQty = packs * packDef.size;
  const packLabel =
    packs === 1
      ? `1 × ${packDef.label}`
      : `${packs} × ${packDef.label}`;
  return { packs, totalQty, packDef, packLabel };
}

// Returns a deterministic realistic price per 100g for a given ingredient.
// Uses a hash of the ingredient ID so values stay consistent across re-runs.
// Safe to store in DECIMAL(10,2) — values are 0.10–2.20.
export function realisticPrice(category: string, ingredientId: string): number {
  const range = PRICE_RANGES[category] ?? PRICE_RANGES["Other"];
  const hash = (ingredientId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 100) / 100;
  const price = range.min + hash * (range.max - range.min);
  return Math.round(price * 100) / 100; // 2 decimal places
}
