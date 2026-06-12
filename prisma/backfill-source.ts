import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  console.log("Adding 'source' column to recipes table...");

  await prisma.$executeRaw`
    ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user'
  `;

  console.log("Marking TheMealDB recipes...");

  const count = await prisma.$executeRaw`
    UPDATE recipes
    SET source = 'themealdb'
    WHERE image_url LIKE 'https://www.themealdb.com/%'
       OR (image_url IS NULL AND description LIKE 'A % recipe from % cuisine.')
  `;

  console.log(`Done — marked ${count} recipes as 'themealdb'. All others remain 'user'.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
