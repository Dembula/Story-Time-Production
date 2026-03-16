import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seeding disabled: no data is created.
  // Run migrations to create tables; add your own data via the app or separate scripts.
  console.log("Seed skipped (no data seeded).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
