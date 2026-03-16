import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const contentCount = await prisma.content.count();
  console.log(JSON.stringify({ ok: true, userCount, contentCount }, null, 2));
}

main()
  .catch((err) => {
    console.error("DB check failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

