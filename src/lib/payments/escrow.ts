import { prisma } from "@/lib/prisma";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { netAfterPlatformFee } from "@/lib/payments/fees";
const db = prisma as any;

export async function createEscrowHold(args: {
  buyerUserId: string;
  sellerUserId: string;
  amount: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
}) {
  const buyerWallet = await ensureWalletForUser(args.buyerUserId);
  const sellerWallet = await ensureWalletForUser(args.sellerUserId);
  const escrow = await db.escrowAccount.upsert({
    where: {
      referenceType_referenceId: {
        referenceType: args.referenceType,
        referenceId: args.referenceId,
      },
    },
    create: {
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      buyerWalletId: buyerWallet.id,
      sellerWalletId: sellerWallet.id,
      amount: args.amount,
      status: "HELD",
      releaseTrigger: "MANUAL_CONFIRMATION",
    },
    update: {},
  });

  await postBalancedLedgerBatch({
    idempotencyKey: args.idempotencyKey,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    entries: [
      {
        userId: args.buyerUserId,
        direction: "DEBIT",
        accountType: "AVAILABLE",
        transactionType: "escrow_hold",
        amount: args.amount,
      },
      {
        userId: args.buyerUserId,
        direction: "CREDIT",
        accountType: "LOCKED",
        transactionType: "escrow_hold",
        amount: args.amount,
      },
    ],
  });

  return escrow;
}

export async function releaseEscrow(args: {
  escrowId: string;
  idempotencyKey: string;
}) {
  const escrow = await db.escrowAccount.findUnique({ where: { id: args.escrowId } });
  if (!escrow) throw new Error("Escrow not found.");
  if (escrow.status !== "HELD") return escrow;

  const buyerWallet = await db.wallet.findUnique({ where: { id: escrow.buyerWalletId } });
  const sellerWallet = await db.wallet.findUnique({ where: { id: escrow.sellerWalletId } });
  if (!buyerWallet || !sellerWallet) throw new Error("Escrow wallets missing.");
  const treasuryUser =
    (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ??
    ({ id: buyerWallet.userId } as { id: string });
  await ensureWalletForUser(treasuryUser.id);
  const { fee, net } = netAfterPlatformFee(escrow.amount);

  await postBalancedLedgerBatch({
    idempotencyKey: args.idempotencyKey,
    referenceType: escrow.referenceType,
    referenceId: escrow.referenceId,
    entries: [
      {
        userId: buyerWallet.userId,
        direction: "DEBIT",
        accountType: "LOCKED",
        transactionType: "escrow_release",
        amount: escrow.amount,
      },
      {
        userId: sellerWallet.userId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "creator_earnings",
        amount: net,
      },
      {
        userId: treasuryUser.id,
        direction: "CREDIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "platform_fee",
        amount: fee,
      },
    ],
  });

  return db.escrowAccount.update({
    where: { id: escrow.id },
    data: {
      status: "RELEASED",
      releasedAt: new Date(),
    },
  });
}

export async function markEscrowDisputed(escrowId: string) {
  return db.escrowAccount.update({
    where: { id: escrowId },
    data: { status: "DISPUTED", disputedAt: new Date() },
  });
}
