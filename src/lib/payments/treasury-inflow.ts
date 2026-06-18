import { prisma } from "@/lib/prisma";
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

/** @deprecated Gateway inflow is booked via allocateGatewayPaymentLedger. */
export async function creditTreasuryFromGatewayPayment(_paymentRecord: {
  id: string;
  amount: number;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);
}
