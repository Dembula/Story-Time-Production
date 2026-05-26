import type { KycVerificationStatus } from "@/lib/payout-kyc";

export type PayoutKycBannerVariant =
  | "not_submitted"
  | "pending"
  | "under_review"
  | "rejected"
  | "approved";

export type PayoutKycBannerContent = {
  variant: PayoutKycBannerVariant;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  tone: "info" | "warning" | "success" | "error";
  payoutsLocked: boolean;
};

export function resolvePayoutKycBannerVariant(
  status: KycVerificationStatus | null | undefined,
  hasProfile: boolean,
): PayoutKycBannerVariant {
  if (status === "APPROVED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "UNDER_REVIEW") return "under_review";
  if (status === "PENDING" && hasProfile) return "pending";
  return "not_submitted";
}

export function getPayoutKycBannerContent(
  status: KycVerificationStatus | null | undefined,
  hasProfile: boolean,
  reviewNote?: string | null,
): PayoutKycBannerContent | null {
  const variant = resolvePayoutKycBannerVariant(status, hasProfile);
  if (variant === "approved") return null;

  const ctaHref = "/payout-verification";
  const platformNote =
    "You can keep using Story Time — projects, listings, messages, and uploads are not blocked.";

  if (variant === "not_submitted") {
    return {
      variant,
      title: "Payout verification required",
      body: `${platformNote} Complete identity and banking verification so our team can review you before any withdrawals or marketplace payouts.`,
      ctaLabel: "Start verification",
      ctaHref,
      tone: "warning",
      payoutsLocked: true,
    };
  }

  if (variant === "pending") {
    return {
      variant,
      title: "Verification submitted — payouts on hold",
      body: `${platformNote} Your documents are in the queue. Withdrawals and payouts stay locked until an admin approves your profile.`,
      ctaLabel: "View or update submission",
      ctaHref,
      tone: "info",
      payoutsLocked: true,
    };
  }

  if (variant === "under_review") {
    return {
      variant,
      title: "Verification under review",
      body: `${platformNote} Our compliance team is reviewing your submission. Payouts remain disabled until approval.`,
      ctaLabel: "View submission",
      ctaHref,
      tone: "info",
      payoutsLocked: true,
    };
  }

  return {
    variant: "rejected",
    title: "Verification needs attention",
    body: `${platformNote} Payouts are still locked.${reviewNote?.trim() ? ` Reason: ${reviewNote.trim()}` : " Please update your documents and resubmit."}`,
    ctaLabel: "Fix and resubmit",
    ctaHref,
    tone: "error",
    payoutsLocked: true,
  };
}
