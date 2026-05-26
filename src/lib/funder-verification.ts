import { prisma } from "@/lib/prisma";

export type FunderVerificationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export function isFunderRole(role?: string | null): boolean {
  return role === "FUNDER" || role === "ADMIN";
}

export function funderInvestingUnlocked(status?: FunderVerificationStatus | null): boolean {
  return status === "APPROVED";
}

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

export type FunderVerificationBannerVariant = "not_submitted" | "pending" | "under_review" | "rejected";

export type FunderVerificationBannerContent = {
  variant: FunderVerificationBannerVariant;
  title: string;
  body: string;
  ctaLabel: string;
};

/** Platform use allowed; investing / deal funding locked until APPROVED. */
export function getFunderVerificationBannerContent(input: {
  verificationStatus?: FunderVerificationStatus | null;
  hasSubmittedProfile?: boolean;
  reviewNote?: string | null;
}): FunderVerificationBannerContent | null {
  const status = input.verificationStatus;
  if (status === "APPROVED") return null;

  const platformNote =
    "You can browse opportunities, messages, and your dashboard normally. Investing, deal funding, and capital payouts stay locked until compliance approves your verification.";

  if (!input.hasSubmittedProfile && !status) {
    return {
      variant: "not_submitted",
      title: "Funder verification required",
      body: `${platformNote} Submit your KYC application when you are ready to invest.`,
      ctaLabel: "Start verification",
    };
  }

  if (status === "REJECTED") {
    return {
      variant: "rejected",
      title: "Verification needs attention",
      body: input.reviewNote?.trim()
        ? `${platformNote} Reason: ${input.reviewNote.trim()}`
        : `${platformNote} Please update your documents and resubmit.`,
      ctaLabel: "Update verification",
    };
  }

  if (status === "UNDER_REVIEW") {
    return {
      variant: "under_review",
      title: "Verification under review",
      body: `${platformNote} Our team is reviewing your submission.`,
      ctaLabel: "View submission",
    };
  }

  return {
    variant: "pending",
    title: "Verification submitted",
    body: `${platformNote} Investing unlocks after approval.`,
    ctaLabel: "View submission",
  };
}
