import { PrismaClient } from "../generated/prisma";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^\"(.*)\"$/, "$1");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const prisma = new PrismaClient();
const db = prisma as any;

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  const users = await db.user.findMany({
    where: { role: { not: "SUBSCRIBER" } },
    select: { id: true },
  });

  for (const user of users) {
    const wallet = await db.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    for (const accountType of ["AVAILABLE", "PENDING", "LOCKED", "PLATFORM_REVENUE", "CREATOR_REVENUE"]) {
      await db.walletAccount.upsert({
        where: {
          walletId_accountType_currency: {
            walletId: wallet.id,
            accountType,
            currency: "ZAR",
          },
        },
        create: {
          walletId: wallet.id,
          accountType,
          currency: "ZAR",
        },
        update: {},
      });
    }
  }

  console.log(`Backfilled wallets for ${users.length} non-viewer users.`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
