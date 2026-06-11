/**
 * Fixes vendor stock prices to realistic €/g values based on ingredient category.
 * Run once: npm run db:fix-prices
 */
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

// Price per 100g/100ml in euros — fits DECIMAL(10,2), values 0.10–2.20
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  "Protein":    { min: 1.00, max: 2.20 }, // 10–22 €/kg
  "Vegetable":  { min: 0.10, max: 0.40 }, // 1–4 €/kg
  "Fruit":      { min: 0.15, max: 0.50 }, // 1.5–5 €/kg
  "Dairy":      { min: 0.20, max: 1.20 }, // 2–12 €/kg
  "Grain":      { min: 0.10, max: 0.30 }, // 1–3 €/kg
  "Spice":      { min: 0.60, max: 2.00 }, // 6–20 €/kg
  "Condiment":  { min: 0.20, max: 0.80 }, // 2–8 €/L
  "Baking":     { min: 0.10, max: 0.30 }, // 1–3 €/kg
  "Nut & Seed": { min: 0.80, max: 1.80 }, // 8–18 €/kg
  "Other":      { min: 0.10, max: 0.50 },
};

function realisticPrice(category: string, ingredientId: string): number {
  const range = PRICE_RANGES[category] ?? PRICE_RANGES["Other"];
  const hash = (ingredientId.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 100) / 100;
  const price = range.min + hash * (range.max - range.min);
  return Math.round(price * 100) / 100;
}

async function main() {
  console.log("\n=== Fix Stock Prices ===\n");

  const allStock = await prisma.vendorStock.findMany({
    include: { ingredient: { select: { id: true, category: true } } },
  });

  console.log(`Updating ${allStock.length} stock entries...`);

  let updated = 0;
  for (const stock of allStock) {
    const price = realisticPrice(stock.ingredient.category, stock.ingredient.id);
    await prisma.vendorStock.update({
      where: { id: stock.id },
      data: { pricePerUnit: price },
    });
    updated++;
    if (updated % 100 === 0) process.stdout.write(`  ${updated}/${allStock.length}\n`);
  }

  console.log(`\n✓ Updated ${updated} stock prices to realistic values.\n`);

  // Show a few examples
  const examples = await prisma.vendorStock.findMany({
    take: 8,
    include: { ingredient: { select: { name: true, category: true } } },
    orderBy: { ingredient: { category: "asc" } },
  });

  console.log("Sample prices:");
  for (const s of examples) {
    const per100g = Number(s.pricePerUnit).toFixed(2);
    const perKg = (Number(s.pricePerUnit) * 10).toFixed(2);
    console.log(`  ${s.ingredient.name.padEnd(25)} [${s.ingredient.category}]  ${per100g} €/100g  (${perKg} €/kg)`);
  }
  console.log();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
