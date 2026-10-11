import { prisma } from "@/lib/prisma";
import { ensureWalletForUser } from "@/lib/payments/wallet";

const db = prisma as any;

/**
 * Platform treasury identity for gateway inflow + creator-pool contra entries.
 * Prefer PLATFORM_TREASURY_USER_ID; otherwise the oldest ADMIN (never a creator role).
 */
export async function getPlatformTreasuryUserId(): Promise<string> {
  const configured = process.env.PLATFORM_TREASURY_USER_ID?.trim();
  if (configured) {
    const user = await db.user.findUnique({
      where: { id: configured },
      select: { id: true, role: true },
    });
    if (!user?.id) {
      throw new Error("PLATFORM_TREASURY_USER_ID does not match a user.");
    }
    if (user.role === "CONTENT_CREATOR" || user.role === "MUSIC_CREATOR") {
      throw new Error("PLATFORM_TREASURY_USER_ID must not be a creator account.");
    }
    return user.id;
  }

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

export async function isPlatformTreasuryUser(userId: string): Promise<boolean> {
  try {
    const treasuryUserId = await getPlatformTreasuryUserId();
    return treasuryUserId === userId;
  } catch {
    return false;
  }
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
