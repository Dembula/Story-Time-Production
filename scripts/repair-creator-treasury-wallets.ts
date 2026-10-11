/**
 * One-time repair: strip platform-treasury balances off creator wallets that were
 * historically used as treasury (or received gateway postings), move residual
 * AVAILABLE cash to the current ADMIN treasury, and zero creator-facing wallets
 * that have no creator_earnings.
 *
 * Usage: npx tsx scripts/repair-creator-treasury-wallets.ts
 */
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
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = value;
  }
}

const prisma = new PrismaClient();
const db = prisma as any;

const TREASURY_TYPES = [
  "incoming_payment",
  "gateway_balance",
  "viewer_creator_pool",
  "viewer_platform_share",
  "viewer_platform_hold_while_paused",
  "creator_pool_payout",
  "creator_pool_balance",
  "manual_payout",
  "manual_payout_balance",
];

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function ensureWallet(userId: string) {
  const wallet = await db.wallet.upsert({
    where: { userId },
    create: { userId },
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
      create: { walletId: wallet.id, accountType, currency: "ZAR", balance: 0 },
      update: {},
    });
  }
  return wallet;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));

  const configuredTreasury = process.env.PLATFORM_TREASURY_USER_ID?.trim();
  const treasuryUser = configuredTreasury
    ? await db.user.findUnique({ where: { id: configuredTreasury }, select: { id: true, email: true, role: true } })
    : await db.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true, role: true },
      });

  if (!treasuryUser?.id) {
    throw new Error("No ADMIN treasury user found.");
  }
  if (treasuryUser.role === "CONTENT_CREATOR" || treasuryUser.role === "MUSIC_CREATOR") {
    throw new Error("Treasury user must not be a creator role.");
  }

  console.log(`Treasury target: ${treasuryUser.email} (${treasuryUser.id})`);
  const treasuryWallet = await ensureWallet(treasuryUser.id);

  const creators = await db.user.findMany({
    where: {
      role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] },
      id: { not: treasuryUser.id },
    },
    select: {
      id: true,
      email: true,
      wallet: {
        select: {
          id: true,
          availableBalance: true,
          pendingBalance: true,
          lockedBalance: true,
          totalEarnings: true,
          totalWithdrawn: true,
        },
      },
    },
  });

  let movedAvailable = 0;
  let repaired = 0;

  for (const creator of creators) {
    if (!creator.wallet) continue;

    const pollutionCount = await db.ledgerEntry.count({
      where: {
        userId: creator.id,
        transactionType: { in: TREASURY_TYPES },
      },
    });
    if (pollutionCount === 0) continue;

    const earnings = await db.ledgerEntry.aggregate({
      where: {
        userId: creator.id,
        transactionType: "creator_earnings",
        direction: "CREDIT",
        accountType: "AVAILABLE",
      },
      _sum: { amount: true },
    });
    const earningsTotal = roundMoney(Number(earnings._sum?.amount ?? 0));

    // Creator-facing remaining = earnings − already withdrawn (completed) − open pending holds.
    const withdrawn = await db.ledgerEntry.aggregate({
      where: {
        userId: creator.id,
        transactionType: "withdrawal_completed",
        direction: "DEBIT",
        accountType: "PENDING",
      },
      _sum: { amount: true },
    });
    const withdrawnTotal = roundMoney(Number(withdrawn._sum?.amount ?? 0));

    const pendingHold = await db.ledgerEntry.aggregate({
      where: {
        userId: creator.id,
        transactionType: "withdrawal_hold",
        accountType: "PENDING",
      },
      _sum: { amount: true },
    });
    // Net pending from holds: credits − debits on PENDING for withdrawal_hold / completed already counted
    const pendingEntries = await db.ledgerEntry.findMany({
      where: {
        userId: creator.id,
        transactionType: { in: ["withdrawal_hold", "withdrawal_completed", "withdrawal_declined"] },
        accountType: "PENDING",
      },
      select: { direction: true, amount: true },
    });
    let pendingFacing = 0;
    for (const e of pendingEntries) {
      pendingFacing += e.direction === "CREDIT" ? e.amount : -e.amount;
    }
    pendingFacing = Math.max(0, roundMoney(pendingFacing));

    const availableFacing = Math.max(0, roundMoney(earningsTotal - withdrawnTotal - pendingFacing));
    void pendingHold;

    const prevAvailable = roundMoney(Number(creator.wallet.availableBalance ?? 0));
    const prevPending = roundMoney(Number(creator.wallet.pendingBalance ?? 0));
    const prevLocked = roundMoney(Number(creator.wallet.lockedBalance ?? 0));
    const phantomAvailable = roundMoney(prevAvailable - availableFacing);
    const phantomPending = roundMoney(prevPending - pendingFacing);

    if (
      Math.abs(phantomAvailable) < 0.005 &&
      Math.abs(phantomPending) < 0.005 &&
      Math.abs(prevLocked) < 0.005 &&
      Math.abs(Number(creator.wallet.totalEarnings ?? 0) - earningsTotal) < 0.005
    ) {
      continue;
    }

    console.log(
      `Repair ${creator.email}: available ${prevAvailable}→${availableFacing}, pending ${prevPending}→${pendingFacing}, locked ${prevLocked}→0, earnings→${earningsTotal} (treasury txs=${pollutionCount})`,
    );

    // Move residual non-earnings AVAILABLE to real treasury (cash that belonged to the platform).
    if (phantomAvailable > 0.004) {
      await db.wallet.update({
        where: { id: treasuryWallet.id },
        data: { availableBalance: { increment: phantomAvailable } },
      });
      await db.walletAccount.update({
        where: {
          walletId_accountType_currency: {
            walletId: treasuryWallet.id,
            accountType: "AVAILABLE",
            currency: "ZAR",
          },
        },
        data: { balance: { increment: phantomAvailable } },
      });
      movedAvailable = roundMoney(movedAvailable + phantomAvailable);
    }

    // Move residual PLATFORM_REVENUE / CREATOR_REVENUE account balances to treasury.
    const accounts = await db.walletAccount.findMany({
      where: { walletId: creator.wallet.id },
      select: { accountType: true, balance: true },
    });
    for (const account of accounts) {
      if (account.accountType !== "PLATFORM_REVENUE" && account.accountType !== "CREATOR_REVENUE") continue;
      const bal = roundMoney(Number(account.balance ?? 0));
      if (Math.abs(bal) < 0.005) continue;
      await db.walletAccount.update({
        where: {
          walletId_accountType_currency: {
            walletId: treasuryWallet.id,
            accountType: account.accountType,
            currency: "ZAR",
          },
        },
        data: { balance: { increment: bal } },
      });
      await db.walletAccount.update({
        where: {
          walletId_accountType_currency: {
            walletId: creator.wallet.id,
            accountType: account.accountType,
            currency: "ZAR",
          },
        },
        data: { balance: 0 },
      });
    }

    await db.wallet.update({
      where: { id: creator.wallet.id },
      data: {
        availableBalance: availableFacing,
        pendingBalance: pendingFacing,
        lockedBalance: 0,
        totalEarnings: earningsTotal,
        totalWithdrawn: withdrawnTotal,
      },
    });

    for (const accountType of ["AVAILABLE", "PENDING", "LOCKED"] as const) {
      const next =
        accountType === "AVAILABLE"
          ? availableFacing
          : accountType === "PENDING"
            ? pendingFacing
            : 0;
      await db.walletAccount.update({
        where: {
          walletId_accountType_currency: {
            walletId: creator.wallet.id,
            accountType,
            currency: "ZAR",
          },
        },
        data: { balance: next },
      });
    }

    repaired += 1;
  }

  console.log(`Repaired ${repaired} creator wallet(s). Moved R${movedAvailable.toFixed(2)} AVAILABLE to treasury.`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
