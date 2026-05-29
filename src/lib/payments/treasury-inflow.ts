import { prisma } from "@/lib/prisma";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";

const db = prisma as any;

export async function getPlatformTreasuryUserId(): Promise<string> {
  const treasury = await db.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!treasury?.id) {
    throw new Error("Platform treasury admin account is missing.");
  }
  return treasury.id;
}

/** Credit Story Time treasury when a gateway payment succeeds (payer wallet is never credited). */
export async function creditTreasuryFromGatewayPayment(paymentRecord: {
  id: string;
  amount: number;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);

  await postBalancedLedgerBatch({
    idempotencyKey: `payment_record_success_${paymentRecord.id}`,
    referenceType: paymentRecord.relatedEntityType || "PAYMENT_RECORD",
    referenceId: paymentRecord.relatedEntityId || paymentRecord.id,
    metadata: { paymentRecordId: paymentRecord.id, flow: "gateway_inflow" },
    entries: [
      {
        userId: treasuryUserId,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount: paymentRecord.amount,
        description: "Gateway payment received",
      },
      {
        userId: treasuryUserId,
        direction: "DEBIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "incoming_payment",
        amount: paymentRecord.amount,
        description: "Platform revenue pool bookkeeping",
      },
    ],
  });
}
