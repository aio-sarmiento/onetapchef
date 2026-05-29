import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding ingredient catalog...");

  const ingredients = [
    { name: "Cherry Tomatoes", category: "Vegetables", defaultUnit: "g" },
    { name: "Pasta (Spaghetti)", category: "Grains", defaultUnit: "g" },
    { name: "Pasta (Penne)", category: "Grains", defaultUnit: "g" },
    { name: "Pasta (Fusilli)", category: "Grains", defaultUnit: "g" },
    { name: "Chicken Breast", category: "Meat & Fish", defaultUnit: "g" },
    { name: "Eggs", category: "Dairy & Eggs", defaultUnit: "unit" },
    { name: "Whole Milk", category: "Dairy & Eggs", defaultUnit: "ml" },
    { name: "Butter", category: "Dairy & Eggs", defaultUnit: "g" },
    { name: "Cheddar Cheese", category: "Dairy & Eggs", defaultUnit: "g" },
    { name: "Parmesan Cheese", category: "Dairy & Eggs", defaultUnit: "g" },
    { name: "Greek Yogurt", category: "Dairy & Eggs", defaultUnit: "g" },
    { name: "Yellow Onion", category: "Vegetables", defaultUnit: "unit" },
    { name: "Garlic", category: "Vegetables", defaultUnit: "unit" },
    { name: "Bell Pepper (Red)", category: "Vegetables", defaultUnit: "unit" },
    { name: "Bell Pepper (Yellow)", category: "Vegetables", defaultUnit: "unit" },
    { name: "Zucchini", category: "Vegetables", defaultUnit: "unit" },
    { name: "Spinach", category: "Vegetables", defaultUnit: "g" },
    { name: "Mushrooms", category: "Vegetables", defaultUnit: "g" },
    { name: "Broccoli", category: "Vegetables", defaultUnit: "g" },
    { name: "Carrot", category: "Vegetables", defaultUnit: "unit" },
    { name: "Potato", category: "Vegetables", defaultUnit: "unit" },
    { name: "Sweet Potato", category: "Vegetables", defaultUnit: "unit" },
    { name: "Avocado", category: "Fruit", defaultUnit: "unit" },
    { name: "Banana", category: "Fruit", defaultUnit: "unit" },
    { name: "Apple", category: "Fruit", defaultUnit: "unit" },
    { name: "Lemon", category: "Fruit", defaultUnit: "unit" },
    { name: "Canned Tomatoes", category: "Pantry", defaultUnit: "g" },
    { name: "Olive Oil", category: "Pantry", defaultUnit: "ml" },
    { name: "All-Purpose Flour", category: "Grains", defaultUnit: "g" },
    { name: "Rice (White)", category: "Grains", defaultUnit: "g" },
    { name: "Rice (Brown)", category: "Grains", defaultUnit: "g" },
    { name: "Oats (Rolled)", category: "Grains", defaultUnit: "g" },
    { name: "Bread (Sliced)", category: "Grains", defaultUnit: "unit" },
    { name: "Canned Chickpeas", category: "Legumes", defaultUnit: "g" },
    { name: "Canned Black Beans", category: "Legumes", defaultUnit: "g" },
    { name: "Red Lentils", category: "Legumes", defaultUnit: "g" },
    { name: "Tofu (Firm)", category: "Plant Protein", defaultUnit: "g" },
    { name: "Salmon Fillet", category: "Meat & Fish", defaultUnit: "g" },
    { name: "Tuna (Canned)", category: "Meat & Fish", defaultUnit: "g" },
    { name: "Ground Beef", category: "Meat & Fish", defaultUnit: "g" },
  ];

  for (const ing of ingredients) {
    await prisma.ingredient.upsert({
      where: { name: ing.name },
      update: {},
      create: { ...ing, aliases: [] },
    });
  }

  console.log(`Seeded ${ingredients.length} ingredients.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
