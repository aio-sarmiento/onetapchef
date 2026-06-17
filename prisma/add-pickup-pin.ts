import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  console.log("Adding 'pickup_pin' column to orders table...");
  await prisma.$executeRaw`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS pickup_pin TEXT
  `;
  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
