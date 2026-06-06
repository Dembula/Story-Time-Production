import { prisma } from "@/lib/prisma";
import type { KycPayload, KycVerificationStatus } from "@/lib/payout-kyc-shared";

export * from "@/lib/payout-kyc-shared";

export async function getPayoutKycStatus(userId: string): Promise<KycVerificationStatus | null> {
  const profile = await prisma.payoutKycProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  });
  if (!profile) return null;
  return profile.verificationStatus as KycVerificationStatus;
}

export async function assertPayoutKycApproved(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await prisma.payoutKycProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true, reviewNote: true },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    const note = profile?.reviewNote?.trim();
    return {
      ok: false,
      error: note
        ? `Payout verification required: ${note}`
        : "Complete payout verification and wait for admin approval before requesting withdrawals.",
    };
  }
  return { ok: true };
}

export type { KycPayload };
