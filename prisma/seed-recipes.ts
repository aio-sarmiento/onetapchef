import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();
const MEALDB = "https://www.themealdb.com/api/json/v1/1";

// ── Category mappings ───────────────────────────────────────────────────────
const OUR_CATEGORY: Record<string, string> = {
  Breakfast: "Breakfast",
  Dessert: "Dessert",
  Starter: "Snack",
  Side: "Snack",
  Beef: "Dinner",
  Chicken: "Dinner",
  Lamb: "Dinner",
  Pork: "Dinner",
  Seafood: "Dinner",
  Pasta: "Lunch",
  Vegan: "Lunch",
  Vegetarian: "Lunch",
  Miscellaneous: "Dinner",
  Goat: "Dinner",
};

const DIETARY_TAGS: Record<string, string[]> = {
  Vegan: ["vegan", "vegetarian"],
  Vegetarian: ["vegetarian"],
};

// ── Ingredient helpers ──────────────────────────────────────────────────────
function inferCategory(name: string, type: string | null): string {
  const n = name.toLowerCase();
  const t = (type ?? "").toLowerCase();
  if (t.includes("meat") || ["beef", "chicken", "pork", "lamb", "turkey", "duck", "veal", "bacon", "sausage", "mince"].some((k) => n.includes(k))) return "Protein";
  if (t.includes("seafood") || t.includes("fish") || ["salmon", "tuna", "shrimp", "prawn", "cod", "fish", "crab", "lobster", "anchovy", "sardine", "mussel", "clam"].some((k) => n.includes(k))) return "Protein";
  if (["egg", "tofu", "tempeh", "lentil", "chickpea", "bean", "legume"].some((k) => n.includes(k))) return "Protein";
  if (t.includes("vegetable") || ["tomato", "onion", "garlic", "pepper", "carrot", "potato", "spinach", "broccoli", "lettuce", "celery", "zucchini", "courgette", "aubergine", "eggplant", "mushroom", "leek", "cabbage", "cauliflower", "peas", "corn", "cucumber", "beetroot", "radish", "asparagus", "artichoke", "fennel", "spring onion", "shallot"].some((k) => n.includes(k))) return "Vegetable";
  if (t.includes("fruit") || ["apple", "banana", "lemon", "lime", "orange", "strawberr", "raspberr", "blueberr", "mango", "pineapple", "peach", "cherry", "grape", "avocado", "coconut", "passion fruit", "melon", "watermelon", "plum", "apricot"].some((k) => n.includes(k))) return "Fruit";
  if (t.includes("dairy") || ["milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "parmesan", "mozzarella", "cheddar", "ricotta", "brie", "feta", "gouda"].some((k) => n.includes(k))) return "Dairy";
  if (["flour", "rice", "pasta", "bread", "oat", "wheat", "cornmeal", "quinoa", "barley", "couscous", "noodle", "tortilla", "crumb", "semolina", "polenta"].some((k) => n.includes(k))) return "Grain";
  if (["oil", "vinegar", "soy sauce", "fish sauce", "worcestershire", "tabasco", "ketchup", "mustard", "mayonnaise", "pesto", "tahini", "miso", "stock", "broth", "wine", "beer"].some((k) => n.includes(k))) return "Condiment";
  if (["sugar", "chocolate", "cocoa", "vanilla", "baking powder", "baking soda", "yeast", "icing", "caramel", "syrup", "honey", "jam", "molasses", "golden syrup"].some((k) => n.includes(k))) return "Baking";
  if (["almond", "walnut", "pecan", "cashew", "peanut", "pistachio", "hazelnut", "pine nut", "sesame", "sunflower seed", "pumpkin seed", "flax"].some((k) => n.includes(k))) return "Nut & Seed";
  if (["salt", "pepper", "cumin", "oregano", "basil", "thyme", "rosemary", "cinnamon", "paprika", "turmeric", "ginger", "chili", "cayenne", "nutmeg", "coriander", "cardamom", "clove", "bay", "dill", "mint", "parsley", "sage", "tarragon", "anise", "fennel seed", "allspice", "caraway", "saffron", "sumac", "za'atar"].some((k) => n.includes(k))) return "Spice";
  return "Other";
}

function guessDefaultUnit(name: string, category: string): string {
  const n = name.toLowerCase();
  if (category === "Condiment" && (n.includes("oil") || n.includes("sauce") || n.includes("vinegar") || n.includes("juice") || n.includes("stock") || n.includes("broth") || n.includes("wine") || n.includes("beer"))) return "ml";
  if (category === "Dairy" && (n.includes("milk") || n.includes("cream") || n.includes("yogurt") || n.includes("yoghurt"))) return "ml";
  if (category === "Spice") return "g";
  return "g";
}

function parseMeasure(measure: string): { quantity: number; unit: string } {
  const s = measure.trim();
  if (!s || /^(to taste|as needed|as required|a pinch)$/i.test(s)) return { quantity: 1, unit: "pinch" };

  // Mixed number: "1 1/2 cups"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (mixed) {
    const q = parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
    return { quantity: q, unit: (mixed[4].trim() || "piece") };
  }
  // Fraction: "1/2 cup"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (frac) {
    return { quantity: parseInt(frac[1]) / parseInt(frac[2]), unit: (frac[3].trim() || "piece") };
  }
  // Number: "2 cups" or "100g"
  const num = s.match(/^([\d.]+)\s*(.*)$/);
  if (num) {
    return { quantity: parseFloat(num[1]), unit: (num[2].trim() || "piece") };
  }
  return { quantity: 1, unit: s.substring(0, 20) || "piece" };
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (!u || ["whole", "large", "medium", "small", "big"].includes(u)) return "piece";
  if (["g", "gr", "gram", "grams"].includes(u)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(u)) return "kg";
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(u)) return "ml";
  if (["l", "liter", "liters", "litre", "litres"].includes(u)) return "l";
  if (["tbsp", "tbs", "tablespoon", "tablespoons"].includes(u)) return "tbsp";
  if (["tsp", "teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["cup", "cups"].includes(u)) return "cup";
  if (["oz", "ounce", "ounces"].includes(u)) return "oz";
  if (["lb", "lbs", "pound", "pounds"].includes(u)) return "lb";
  if (["clove", "cloves"].includes(u)) return "clove";
  if (["slice", "slices"].includes(u)) return "slice";
  if (["can", "cans", "tin", "tins"].includes(u)) return "can";
  if (["pack", "package", "packet", "packets"].includes(u)) return "pack";
  if (["pinch", "pinches"].includes(u)) return "pinch";
  if (["handful", "handfuls"].includes(u)) return "handful";
  if (["piece", "pieces", "pcs", "pc"].includes(u)) return "piece";
  if (["sprig", "sprigs"].includes(u)) return "sprig";
  if (["bunch", "bunches"].includes(u)) return "bunch";
  if (["sheet", "sheets"].includes(u)) return "sheet";
  return u.substring(0, 20);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Inline availability recompute (avoids @/ alias imports)
async function recomputeRecipeAvailability(recipeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalRequired, inStock] = await Promise.all([
    prisma.recipeIngredient.count({ where: { recipeId, isOptional: false } }),
    prisma.recipeIngredient.count({
      where: {
        recipeId,
        isOptional: false,
        ingredient: {
          stock: {
            some: {
              status: { in: ["available", "low"] },
              expiryDate: { gte: today },
              quantityAvailable: { gt: 0 },
            },
          },
        },
      },
    }),
  ]);

  const score = totalRequired === 0 ? 0 : inStock / totalRequired;
  await prisma.recipe.update({ where: { id: recipeId }, data: { availabilityScore: score } });
  return score;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface MDBIngredient {
  idIngredient: string;
  strIngredient: string;
  strDescription: string | null;
  strType: string | null;
}

interface MealSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
}

type MealDetail = Record<string, string | null>;

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n=== OneTapChef Recipe Seed (TheMealDB) ===\n");

  const studentUser = await prisma.user.findFirst({ where: { role: "student" } });
  const vendor = await prisma.vendorProfile.findFirst({ where: { isAdminVerified: true } });

  if (!studentUser) throw new Error("No student user found. Run `npm run db:seed-dev` first.");
  if (!vendor) throw new Error("No verified vendor found. Run `npm run db:seed-dev` first.");

  console.log(`Author : ${studentUser.displayName}`);
  console.log(`Vendor : ${vendor.businessName}\n`);

  // ── 1. Seed Ingredients ──────────────────────────────────────────────────
  console.log("1/4  Fetching ingredients from TheMealDB...");
  const ingRes = await fetch(`${MEALDB}/list.php?i=list`);
  const ingData = (await ingRes.json()) as { meals: MDBIngredient[] };
  const mdbIngredients = (ingData.meals ?? []).filter((i) => i.strIngredient?.trim());

  console.log(`     Found ${mdbIngredients.length} ingredients — upserting...`);
  const nameToId = new Map<string, string>();

  for (const ing of mdbIngredients) {
    const name = ing.strIngredient.trim();
    const category = inferCategory(name, ing.strType ?? null);
    const defaultUnit = guessDefaultUnit(name, category);

    const record = await prisma.ingredient.upsert({
      where: { name },
      update: {},
      create: { name, aliases: [], category, defaultUnit },
    });
    nameToId.set(name.toLowerCase(), record.id);
  }
  console.log(`     ✓ ${nameToId.size} ingredients ready\n`);

  // ── 2. Seed Recipes via letter sweep (a–z) ───────────────────────────────
  // Each search.php?f={letter} returns FULL meal details in one call — no
  // secondary lookup needed and covers every meal in the DB.
  console.log("2/4  Sweeping all meals by first letter (a–z)...");

  let totalRecipes = 0;
  const seenSlugs = new Set<string>();

  // Pre-load existing slugs to avoid upsert collisions
  const existingRecipes = await prisma.recipe.findMany({ select: { slug: true } });
  existingRecipes.forEach((r) => seenSlugs.add(r.slug));

  const letters = "abcdefghijklmnopqrstuvwxyz".split("");

  for (const letter of letters) {
    await delay(300);
    process.stdout.write(`     [${letter.toUpperCase()}] `);

    let details: MealDetail[] = [];
    try {
      const res = await fetch(`${MEALDB}/search.php?f=${letter}`);
      const data = (await res.json()) as { meals: MealDetail[] | null };
      details = data.meals ?? [];
    } catch {
      process.stdout.write(`error\n`);
      continue;
    }

    process.stdout.write(`${details.length} meals — `);
    let letterCount = 0;

    for (const detail of details) {
      try {
        const strCategory = (detail.strCategory as string ?? "Miscellaneous").trim();

        // Extract ingredients + measures
        const seenIngIds = new Set<string>();
        const links: { ingredientId: string; quantity: number; unit: string }[] = [];

        for (let i = 1; i <= 20; i++) {
          const rawName = (detail[`strIngredient${i}`] ?? "").trim();
          const rawMeasure = (detail[`strMeasure${i}`] ?? "").trim();
          if (!rawName) continue;

          const ingredientId = nameToId.get(rawName.toLowerCase());
          if (!ingredientId || seenIngIds.has(ingredientId)) continue;
          seenIngIds.add(ingredientId);

          const { quantity, unit } = parseMeasure(rawMeasure);
          links.push({ ingredientId, quantity, unit: normalizeUnit(unit) });
        }

        if (links.length === 0) continue;

        const instructions = (detail.strInstructions ?? "")
          .split(/\r?\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 15)
          .slice(0, 20);

        if (instructions.length === 0) continue;

        const rawTitle = (detail.strMeal as string ?? "").trim();
        if (!rawTitle) continue;

        let slug = slugify(rawTitle);
        if (!slug) continue;
        if (seenSlugs.has(slug)) slug = `${slug}-${detail.idMeal ?? ""}`;
        if (seenSlugs.has(slug)) continue; // still duplicate — skip
        seenSlugs.add(slug);

        const category = OUR_CATEGORY[strCategory] ?? "Dinner";
        const dietaryTags = DIETARY_TAGS[strCategory] ?? [];
        const area = (detail.strArea as string ?? "").trim();
        const cuisine = area && area !== "Unknown" ? area : "International";

        await prisma.recipe.upsert({
          where: { slug },
          update: {},
          create: {
            title: rawTitle,
            slug,
            description: `A ${strCategory.toLowerCase()} recipe from ${cuisine} cuisine.`,
            authorId: studentUser.id,
            baseServings: 4,
            prepTimeMinutes: 15,
            cookTimeMinutes: 30,
            category,
            cuisine,
            dietaryTags,
            imageUrl: (detail.strMealThumb as string) ?? null,
            instructions,
            isPublished: true,
            ingredients: {
              create: links.map((l, idx) => ({ ...l, sortOrder: idx })),
            },
          },
        });

        letterCount++;
        totalRecipes++;
      } catch {
        // Skip failed meals silently
      }
    }

    console.log(`${letterCount} new`);
  }

  console.log(`\n     Total new recipes this run: ${totalRecipes}\n`);

  // ── 3. Vendor stock for ALL ingredients ─────────────────────────────────
  console.log("3/4  Creating vendor stock for all ingredients...");
  const allIngredients = await prisma.ingredient.findMany({ select: { id: true } });
  const expiryOptions = [3, 5, 7, 10, 14];
  let stockCreated = 0;

  for (const ing of allIngredients) {
    const exists = await prisma.vendorStock.findFirst({
      where: { vendorId: vendor.id, ingredientId: ing.id },
      select: { id: true },
    });
    if (exists) continue;

    const daysAhead = expiryOptions[Math.floor(Math.random() * expiryOptions.length)];
    const expiry = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    const qty = Math.floor(Math.random() * 1800) + 200;

    // Realistic price per gram based on category
    const ingRecord = await prisma.ingredient.findUnique({ where: { id: ing.id }, select: { category: true } });
    const category = ingRecord?.category ?? "Other";
    const priceRanges: Record<string, { min: number; max: number }> = {
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
    const range = priceRanges[category] ?? priceRanges["Other"];
    const hash = (ing.id.split("").reduce((s: number, c: string) => s + c.charCodeAt(0), 0) % 100) / 100;
    const price = Math.round((range.min + hash * (range.max - range.min)) * 100) / 100;

    await prisma.vendorStock.create({
      data: {
        vendorId: vendor.id,
        ingredientId: ing.id,
        quantityAvailable: qty,
        originalQuantity: qty,
        unit: "g",
        pricePerUnit: price,
        expiryDate: expiry,
        status: qty < 300 ? "low" : "available",
      },
    });
    stockCreated++;
  }
  console.log(`     ✓ ${stockCreated} stock entries created\n`);

  // ── 4. Recompute availability scores ─────────────────────────────────────
  console.log("4/4  Recomputing availability scores...");
  const allRecipes = await prisma.recipe.findMany({ select: { id: true } });
  let done = 0;
  for (const r of allRecipes) {
    await recomputeRecipeAvailability(r.id);
    done++;
    if (done % 50 === 0) process.stdout.write(`     ${done}/${allRecipes.length}\n`);
  }
  console.log(`     ✓ ${allRecipes.length} recipes updated\n`);

  console.log("=== Seed complete! ===\n");
  console.log(`  Ingredients : ${nameToId.size}`);
  console.log(`  Recipes     : ${totalRecipes}`);
  console.log(`  Stock items : ${stockCreated}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
