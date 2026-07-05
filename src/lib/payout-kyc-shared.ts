export type KycVerificationStatus = "DRAFT" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

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
    /** ISO date (YYYY-MM-DD) of the bank statement period end — must be within the last 3 months. */
    bankStatementAsOf?: string;
    bankStatementUrl?: string;
    bankConfirmationLetterUrl?: string;
  };
  riskCompliance?: {
    politicallyExposedPerson?: boolean;
    sanctionsDeclarationAccepted?: boolean;
    termsAccepted?: boolean;
    popiaConsentAccepted?: boolean;
  };
};

/** Bank statement must be dated within this many days of submission. */
export const BANK_STATEMENT_MAX_AGE_DAYS = 90;

/** True when statement date is present and not older than BANK_STATEMENT_MAX_AGE_DAYS. */
export function isBankStatementRecent(statementAsOf?: string | null, now = new Date()): boolean {
  if (!statementAsOf?.trim()) return false;
  const d = new Date(statementAsOf);
  if (Number.isNaN(d.getTime())) return false;
  const ageMs = now.getTime() - d.getTime();
  if (ageMs < 0) return false; // future dates not allowed
  return ageMs <= BANK_STATEMENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

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

  if (!input.hasSubmittedProfile) {
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
    const isDraft = status === "DRAFT" || Boolean(status);
    return {
      variant: "not_submitted",
      title: isDraft ? "Continue payout verification" : "Payout verification required",
      body: `${platformNote} Complete identity and banking verification to submit your application for review.`,
      ctaLabel: isDraft ? "Continue payout verification" : "Start payout verification",
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
