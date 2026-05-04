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

  const wallets = await db.wallet.findMany({
    include: { accounts: true },
  });

  let mismatches = 0;
  for (const wallet of wallets as any[]) {
    const available = Number(
      wallet.accounts.find((a: any) => a.accountType === "AVAILABLE")?.balance ?? 0,
    );
    const pending = Number(
      wallet.accounts.find((a: any) => a.accountType === "PENDING")?.balance ?? 0,
    );
    const locked = Number(
      wallet.accounts.find((a: any) => a.accountType === "LOCKED")?.balance ?? 0,
    );
    if (
      Math.abs(Number(wallet.availableBalance) - available) > 0.001 ||
      Math.abs(Number(wallet.pendingBalance) - pending) > 0.001 ||
      Math.abs(Number(wallet.lockedBalance) - locked) > 0.001
    ) {
      mismatches += 1;
      console.warn(
        `[mismatch] wallet=${wallet.id} available(${wallet.availableBalance}/${available}) pending(${wallet.pendingBalance}/${pending}) locked(${wallet.lockedBalance}/${locked})`,
      );
    }
  }

  console.log(
    `[reconcile-ledger] scanned=${wallets.length} mismatches=${mismatches} status=${mismatches === 0 ? "OK" : "ATTENTION"}`,
  );
}

main()
  .catch((error) => {
    console.error("[reconcile-ledger] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
