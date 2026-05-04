import { prisma } from "@/lib/prisma";
import { PAYMENT_CURRENCY } from "@/lib/payments/config";
const db = prisma as any;

const DEFAULT_ACCOUNTS = ["AVAILABLE", "PENDING", "LOCKED", "PLATFORM_REVENUE", "CREATOR_REVENUE"] as const;

export async function ensureWalletForUser(userId: string) {
  const wallet = await db.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  await Promise.all(
    DEFAULT_ACCOUNTS.map((accountType) =>
      db.walletAccount.upsert({
        where: {
          walletId_accountType_currency: {
            walletId: wallet.id,
            accountType,
            currency: PAYMENT_CURRENCY,
          },
        },
        create: {
          walletId: wallet.id,
          accountType,
          currency: PAYMENT_CURRENCY,
          balance: 0,
        },
        update: {},
      }),
    ),
  );
  return wallet;
}

export async function ensureWalletsForAllNonViewers() {
  const users = await db.user.findMany({
    where: { role: { not: "SUBSCRIBER" } },
    select: { id: true },
  });
  for (const user of users) {
    await ensureWalletForUser(user.id);
  }
}

export async function getWalletSnapshot(userId: string) {
  const wallet = await db.wallet.findUnique({
    where: { userId },
    include: {
      accounts: true,
      payoutRequests: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return wallet;
}
