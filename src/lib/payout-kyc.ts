import { prisma } from "@/lib/prisma";

export type KycVerificationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

/** Roles that receive marketplace payouts and must complete KYC (funders use FunderProfile). */
export const PAYOUT_KYC_ROLES = new Set([
  "CONTENT_CREATOR",
  "MUSIC_CREATOR",
  "EQUIPMENT_COMPANY",
  "LOCATION_OWNER",
  "CREW_TEAM",
  "CASTING_AGENCY",
  "CATERING_COMPANY",
]);

export function requiresPayoutKyc(role?: string | null): boolean {
  return !!role && PAYOUT_KYC_ROLES.has(role);
}

export function payoutKycHomePath(role?: string | null): string {
  switch (role) {
    case "MUSIC_CREATOR":
      return "/music-creator/dashboard";
    case "EQUIPMENT_COMPANY":
      return "/equipment-company/dashboard";
    case "LOCATION_OWNER":
      return "/location-owner/dashboard";
    case "CREW_TEAM":
      return "/crew-team/dashboard";
    case "CASTING_AGENCY":
      return "/casting-agency/dashboard";
    case "CATERING_COMPANY":
      return "/company/onboarding/subscription";
    case "CONTENT_CREATOR":
    default:
      return "/creator/command-center";
  }
}

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

export type KycPayload = {
  basicIdentity?: {
    fullName?: string;
    idNumber?: string;
    dateOfBirth?: string;
    nationality?: string;
    phoneNumber?: string;
    emailAddress?: string;
  };
  addressInfo?: {
    residentialAddress?: string;
    city?: string;
    provinceState?: string;
    postalCode?: string;
    country?: string;
  };
  identityVerification?: {
    idFrontUrl?: string;
    idBackUrl?: string;
    selfieUrl?: string;
  };
  businessVerification?: {
    isBusinessApplicant?: boolean;
    companyName?: string;
    registrationNumber?: string;
    roleInCompany?: string;
    companyDocsUrl?: string;
    proofOfAddressUrl?: string;
  };
  financialInfo?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    accountType?: string;
    branchCode?: string;
    incomeRange?: string;
    sourceOfFunds?: string;
  };
  riskCompliance?: {
    politicallyExposedPerson?: boolean;
    sanctionsDeclarationAccepted?: boolean;
    termsAccepted?: boolean;
    popiaConsentAccepted?: boolean;
  };
};

export function parsePayoutKycRiskLevel(payload: KycPayload): "LOW" | "MEDIUM" | "HIGH" {
  if (payload.riskCompliance?.politicallyExposedPerson) return "HIGH";
  return "LOW";
}

export type PayoutKycBannerVariant = "not_submitted" | "pending" | "under_review" | "rejected";

export type PayoutKycBannerContent = {
  variant: PayoutKycBannerVariant;
  title: string;
  body: string;
  ctaLabel: string;
};

/** UI copy for payout KYC — platform use is allowed; payouts stay locked until APPROVED. */
export function getPayoutKycBannerContent(input: {
  verificationStatus?: KycVerificationStatus | null;
  hasSubmittedProfile?: boolean;
  reviewNote?: string | null;
}): PayoutKycBannerContent | null {
  const status = input.verificationStatus;
  if (status === "APPROVED") return null;

  const platformNote =
    "You can keep using Story Time normally. Withdrawals and marketplace payouts stay locked until compliance approves your verification.";

  if (!input.hasSubmittedProfile && !status) {
    return {
      variant: "not_submitted",
      title: "Payout verification required",
      body: `${platformNote} Complete identity and banking verification to submit your application for review.`,
      ctaLabel: "Start payout verification",
    };
  }

  if (status === "REJECTED") {
    return {
      variant: "rejected",
      title: "Payout verification needs attention",
      body: input.reviewNote?.trim()
        ? `${platformNote} Reason: ${input.reviewNote.trim()}`
        : `${platformNote} Please update your documents and resubmit.`,
      ctaLabel: "Update verification",
    };
  }

  if (status === "UNDER_REVIEW") {
    return {
      variant: "under_review",
      title: "Payout verification under review",
      body: `${platformNote} Our team is reviewing your submission — we will notify you when payouts are unlocked.`,
      ctaLabel: "View submission",
    };
  }

  return {
    variant: "pending",
    title: "Payout verification submitted",
    body: `${platformNote} Your documents are queued for review. Payouts unlock after approval.`,
    ctaLabel: "View submission",
  };
}

export function payoutKycBlocksWithdrawals(status?: KycVerificationStatus | null): boolean {
  return status !== "APPROVED";
}
