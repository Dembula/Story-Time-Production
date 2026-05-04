import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";
import { getOrCreateLedgerBatch } from "@/lib/payments/idempotency";
import { ensureWalletForUser } from "@/lib/payments/wallet";
const db = prisma as any;

type LedgerDirection = "DEBIT" | "CREDIT";
type AccountType = "AVAILABLE" | "PENDING" | "LOCKED" | "PLATFORM_REVENUE" | "CREATOR_REVENUE";

export type LedgerPosting = {
  userId: string;
  direction: LedgerDirection;
  accountType: AccountType;
  transactionType: string;
  amount: number;
  status?: string;
  description?: string;
  counterpartyWalletId?: string;
};

function signedAmount(direction: LedgerDirection, amount: number) {
  return direction === "CREDIT" ? amount : -amount;
}

export async function postBalancedLedgerBatch(args: {
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  entries: LedgerPosting[];
  metadata?: Record<string, unknown>;
}) {
  const total = roundMoney(
    args.entries.reduce((sum, entry) => sum + signedAmount(entry.direction, entry.amount), 0),
  );
  if (Math.abs(total) > 0.001) {
    throw new Error("Unbalanced ledger batch.");
  }
  const batch = await getOrCreateLedgerBatch({
    idempotencyKey: args.idempotencyKey,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    metadata: args.metadata,
  });

  const existingCount = await db.ledgerEntry.count({ where: { batchId: batch.id } });
  if (existingCount > 0) {
    return batch;
  }

  const walletByUserId = new Map<string, { id: string }>();
  const uniqueUserIds = [...new Set(args.entries.map((entry) => entry.userId))];
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const wallet = await ensureWalletForUser(userId);
      walletByUserId.set(userId, { id: wallet.id });
    }),
  );

  await prisma.$transaction(async (tx) => {
    for (const entry of args.entries) {
      const wallet = walletByUserId.get(entry.userId);
      if (!wallet) {
        throw new Error(`Wallet missing for user ${entry.userId}`);
      }
      await (tx as any).ledgerEntry.create({
        data: {
          batchId: batch.id,
          walletId: wallet.id,
          userId: entry.userId,
          direction: entry.direction,
          accountType: entry.accountType,
          transactionType: entry.transactionType,
          amount: roundMoney(entry.amount),
          status: entry.status ?? "COMPLETED",
          description: entry.description ?? null,
          counterpartyWalletId: entry.counterpartyWalletId ?? null,
        },
      });

      const delta = signedAmount(entry.direction, entry.amount);
      await (tx as any).walletAccount.update({
        where: {
          walletId_accountType_currency: {
            walletId: wallet.id,
            accountType: entry.accountType,
            currency: "ZAR",
          },
        },
        data: { balance: { increment: delta } },
      });

      if (entry.accountType === "AVAILABLE") {
        await (tx as any).wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: { increment: delta } },
        });
      } else if (entry.accountType === "PENDING") {
        await (tx as any).wallet.update({
          where: { id: wallet.id },
          data: { pendingBalance: { increment: delta } },
        });
      } else if (entry.accountType === "LOCKED") {
        await (tx as any).wallet.update({
          where: { id: wallet.id },
          data: { lockedBalance: { increment: delta } },
        });
      }
    }
  }, { timeout: 20000, maxWait: 20000 });

  return batch;
}
