import { prisma } from "@/lib/prisma";
import type { FunderVerificationStatus } from "@/lib/funder-verification-shared";

export * from "@/lib/funder-verification-shared";

export async function getFunderVerificationStatus(userId: string): Promise<FunderVerificationStatus | null> {
  const profile = await prisma.funderProfile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  });
  if (!profile) return null;
  return profile.verificationStatus as FunderVerificationStatus;
}

export async function assertFunderVerificationApproved(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const profile = await prisma.funderProfile.findUnique({
    where: { userId },
    select: {
      verificationStatus: true,
      verifications: {
        where: { status: "REJECTED" },
        orderBy: { reviewedAt: "desc" },
        take: 1,
        select: { note: true },
      },
    },
  });
  if (!profile || profile.verificationStatus !== "APPROVED") {
    const note = profile?.verifications?.[0]?.note?.trim();
    return {
      ok: false,
      code: "FUNDER_VERIFICATION_REQUIRED",
      error: note
        ? `Investing is locked until verification is approved: ${note}`
        : "Complete funder verification and wait for admin approval before investing, signing deals, or funding payouts.",
    };
  }
  return { ok: true };
}
