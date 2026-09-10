import {
  formatCreatorLicenseSummary,
  getCompanyPlanConfig,
} from "@/lib/pricing";
import {
  subscriptionStatusBadgeClass,
  type AdminSubscriptionStatusLabel,
} from "@/lib/admin/viewer-subscription-status";

export { subscriptionStatusBadgeClass };

export const COMPANY_ROLE_TYPES = [
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
] as const;

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  CREW_TEAM: "Crew team",
  CASTING_AGENCY: "Casting agency",
  LOCATION_OWNER: "Location owner",
  EQUIPMENT_COMPANY: "Equipment company",
  CATERING_COMPANY: "Catering company",
};

export type AdminCreatorLicenseSnapshot = {
  type: string;
  status: string;
  yearlyExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: string | null;
  lastPaymentAt: string | null;
  lastPaymentError: string | null;
  pastDueSince: string | null;
};

export type AdminCompanySubscriptionSnapshot = {
  companyType: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: string | null;
  lastPaymentAt: string | null;
  lastPaymentError: string | null;
  pastDueSince: string | null;
};

export type AdminFunderProfileSnapshot = {
  verificationStatus: string;
  limitedAccessEnabled: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
};

function periodEnded(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso) <= new Date();
}

export function describeAdminCreatorLicense(
  license: AdminCreatorLicenseSnapshot | null | undefined,
): AdminSubscriptionStatusLabel {
  if (!license) {
    return { label: "No creator package", detail: "No distribution licence record", tone: "slate" };
  }

  const planLabel = formatCreatorLicenseSummary(license.type);

  if (license.status === "PAST_DUE") {
    return {
      label: "Creator payment past due",
      detail: `${planLabel}${license.lastPaymentError ? ` · ${license.lastPaymentError}` : ""}`,
      tone: "red",
    };
  }

  if (license.status === "CANCELLED") {
    return { label: "Creator package cancelled", detail: planLabel, tone: "red" };
  }

  if (license.status === "ACTIVE" && periodEnded(license.yearlyExpiresAt)) {
    return {
      label: "Creator package lapsed",
      detail: `${planLabel} · period ended`,
      tone: "amber",
    };
  }

  if (license.cancelAtPeriodEnd) {
    return {
      label: "Creator · cancelling",
      detail: `${planLabel} · until ${license.yearlyExpiresAt ? new Date(license.yearlyExpiresAt).toLocaleDateString() : "period end"}`,
      tone: "amber",
    };
  }

  if (license.status === "ACTIVE") {
    return {
      label: "Creator package active",
      detail: `${planLabel}${license.yearlyExpiresAt ? ` · renews ${new Date(license.yearlyExpiresAt).toLocaleDateString()}` : ""}`,
      tone: "emerald",
    };
  }

  return {
    label: license.status.replace(/_/g, " "),
    detail: planLabel,
    tone: "slate",
  };
}

export function describeAdminCompanySubscription(
  sub: AdminCompanySubscriptionSnapshot | null | undefined,
): AdminSubscriptionStatusLabel {
  if (!sub) {
    return { label: "No company listing", detail: "No company subscription record", tone: "slate" };
  }

  const planConfig = getCompanyPlanConfig(sub.plan);
  const companyLabel = COMPANY_TYPE_LABELS[sub.companyType] ?? sub.companyType.replace(/_/g, " ");
  const planLabel = `${planConfig.label} · ${formatZarLite(planConfig.price)}/mo`;

  if (sub.status === "PAST_DUE") {
    return {
      label: `${companyLabel} · past due`,
      detail: `${planLabel}${sub.lastPaymentError ? ` · ${sub.lastPaymentError}` : ""}`,
      tone: "red",
    };
  }

  if (sub.status === "CANCELLED") {
    return { label: `${companyLabel} · cancelled`, detail: planLabel, tone: "red" };
  }

  if (sub.status === "ACTIVE" && periodEnded(sub.currentPeriodEnd)) {
    return {
      label: `${companyLabel} · lapsed`,
      detail: `${planLabel} · period ended`,
      tone: "amber",
    };
  }

  if (sub.cancelAtPeriodEnd) {
    return {
      label: `${companyLabel} · cancelling`,
      detail: `${planLabel} · until ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "period end"}`,
      tone: "amber",
    };
  }

  if (sub.status === "ACTIVE") {
    return {
      label: `${companyLabel} · paid`,
      detail: `${planLabel}${sub.currentPeriodEnd ? ` · renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}` : ""}`,
      tone: "emerald",
    };
  }

  return {
    label: `${companyLabel} · ${sub.status.replace(/_/g, " ")}`,
    detail: planLabel,
    tone: "slate",
  };
}

export function describeAdminFunderVerification(
  profile: AdminFunderProfileSnapshot | null | undefined,
): AdminSubscriptionStatusLabel {
  if (!profile) {
    return { label: "No funder profile", detail: "Stakeholder KYC not started", tone: "slate" };
  }

  switch (profile.verificationStatus) {
    case "APPROVED":
      return {
        label: "Funder verified",
        detail: profile.reviewedAt
          ? `Approved ${new Date(profile.reviewedAt).toLocaleDateString()}`
          : "KYC approved",
        tone: "emerald",
      };
    case "UNDER_REVIEW":
      return {
        label: "Funder under review",
        detail: profile.submittedAt
          ? `Submitted ${new Date(profile.submittedAt).toLocaleDateString()}`
          : "Awaiting admin review",
        tone: "cyan",
      };
    case "REJECTED":
      return { label: "Funder rejected", detail: "KYC rejected — limited access", tone: "red" };
    case "PENDING":
    default:
      return {
        label: "Funder KYC pending",
        detail: profile.limitedAccessEnabled ? "Limited access until verified" : "Verification pending",
        tone: "amber",
      };
  }
}

function formatZarLite(amount: number): string {
  return `R${amount.toFixed(2).replace(/\.00$/, "")}`;
}

export function userHasCreatorRole(roles: string[]): boolean {
  return roles.includes("CONTENT_CREATOR") || roles.includes("MUSIC_CREATOR");
}

export function userHasCompanyRole(roles: string[]): boolean {
  return roles.some((role) => (COMPANY_ROLE_TYPES as readonly string[]).includes(role));
}
