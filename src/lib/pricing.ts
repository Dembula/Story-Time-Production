import { formatZar } from "./format-currency-zar";

export const VIEWER_PLAN_CONFIG = {
  BASE_1: {
    label: "Basic",
    price: 29.99,
    deviceCount: 1,
    profileLimit: 1,
    deviceLabel: "1",
  },
  STANDARD_3: {
    label: "Standard",
    price: 89.99,
    deviceCount: 3,
    profileLimit: 3,
    deviceLabel: "3",
  },
  FAMILY_5: {
    label: "Premium",
    price: 119.99,
    deviceCount: 5,
    profileLimit: 5,
    deviceLabel: "5+",
  },
  PPV_FILM: {
    label: "Pay Per View",
    price: 49.99,
    deviceCount: 1,
    profileLimit: 1,
    deviceLabel: "1",
  },
} as const;

export function getViewerPlanConfigById(plan?: string | null) {
  return VIEWER_PLAN_CONFIG[(plan ?? "BASE_1") as keyof typeof VIEWER_PLAN_CONFIG] ?? VIEWER_PLAN_CONFIG.BASE_1;
}

/** Stored in CreatorDistributionLicense.type */
export const CREATOR_LICENSE_TYPE = {
  UPLOAD_ONLY_YEARLY: "CREATOR_UPLOAD_ONLY_R99_Y",
  PIPELINE_YEARLY: "CREATOR_PIPELINE_R1999_Y",
  PIPELINE_MONTHLY: "CREATOR_PIPELINE_R209_M",
} as const;

/** React Query key — invalidate/set after license POST so sidebar & gates see fresh access. */
export const CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY = ["creator-distribution-license"] as const;

export const CREATOR_STUDIO_PROFILES_QUERY_KEY = ["creator-studio-profiles"] as const;

export const CREATOR_ONBOARDING_PLANS = {
  UPLOAD_ONLY: {
    id: "UPLOAD_ONLY" as const,
    label: "Upload & originals",
    headline: "For filmmakers who only distribute on Story Time",
    price: 99.99,
    interval: "year" as const,
    includesPipeline: false,
  },
  PIPELINE_YEARLY: {
    id: "PIPELINE_YEARLY" as const,
    label: "Full production pipeline",
    headline: "Pre-production, production & post-production workspace",
    price: 1999.99,
    interval: "year" as const,
    includesPipeline: true,
  },
  PIPELINE_MONTHLY: {
    id: "PIPELINE_MONTHLY" as const,
    label: "Full production pipeline",
    headline: "Same pipeline access, billed monthly",
    price: 209.99,
    interval: "month" as const,
    includesPipeline: true,
  },
} as const;

/** Reference annual total if paying monthly every month (for savings copy). */
export const CREATOR_PIPELINE_MONTHLY_ANNUAL_TOTAL =
  CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price * 12;

/** Rand saved vs paying monthly every month for a full year (same pipeline access). */
export const CREATOR_PIPELINE_YEARLY_SAVINGS_VS_12_MONTHLY =
  CREATOR_PIPELINE_MONTHLY_ANNUAL_TOTAL - CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price;

/** Legacy config — kept for old license strings & music creator flow. */
export const CREATOR_LICENSE_CONFIG = {
  YEARLY: {
    label: "Yearly distribution license",
    price: CREATOR_ONBOARDING_PLANS.UPLOAD_ONLY.price,
  },
  PER_UPLOAD: {
    label: "Pay per upload (legacy)",
    price: 24.99,
  },
} as const;

/** Whether this account may use pre/production/post tools and project pipeline routes. */
export function creatorHasPipelineAccess(rawType: string | null | undefined): boolean {
  if (!rawType) return false;
  if (rawType.startsWith("CREATOR_PIPELINE_")) return true;
  if (rawType.startsWith("CREATOR_UPLOAD_")) return false;
  if (
    rawType === "PER_UPLOAD" ||
    rawType === "PER_UPLOAD_R10" ||
    rawType === "PER_UPLOAD_R24_99" ||
    rawType.includes("PER_UPLOAD")
  ) {
    return false;
  }
  if (rawType === "YEARLY" || rawType === "YEARLY_R89") return true;
  return false;
}

export function isCreatorPerUploadLicense(rawType: string | null | undefined): boolean {
  if (!rawType) return false;
  return (
    rawType === "PER_UPLOAD" ||
    rawType === "PER_UPLOAD_R10" ||
    rawType === "PER_UPLOAD_R24_99" ||
    rawType.includes("PER_UPLOAD")
  );
}

/** License period still valid (uses yearlyExpiresAt for all timed plans). */
export function isCreatorLicensePeriodActive(license: {
  type: string;
  yearlyExpiresAt: Date | string | null;
}): boolean {
  if (isCreatorPerUploadLicense(license.type)) return true;
  if (!license.yearlyExpiresAt) return true;
  const end = new Date(license.yearlyExpiresAt);
  return end.getTime() > Date.now();
}

export function normalizeCreatorLicenseType(type?: string | null) {
  if (!type) return "YEARLY" as const;
  if (isCreatorPerUploadLicense(type)) return "PER_UPLOAD" as const;
  return "YEARLY" as const;
}

export function getCreatorLicenseConfig(type?: string | null) {
  return CREATOR_LICENSE_CONFIG[normalizeCreatorLicenseType(type)];
}

export function formatCreatorLicenseSummary(rawType: string | null | undefined): string {
  if (!rawType) return "No plan";
  switch (rawType) {
    case CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY:
      return `Upload & originals · ${formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_ONLY.price)}/year`;
    case CREATOR_LICENSE_TYPE.PIPELINE_YEARLY:
      return `Full pipeline · ${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price)}/year`;
    case CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY:
      return `Full pipeline · ${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price)}/month`;
    default:
      break;
  }
  if (isCreatorPerUploadLicense(rawType)) {
    return `Legacy · Pay per upload (${formatZar(CREATOR_LICENSE_CONFIG.PER_UPLOAD.price)})`;
  }
  if (rawType === "YEARLY" || rawType === "YEARLY_R89") {
    return `Legacy · Yearly (${formatZar(CREATOR_LICENSE_CONFIG.YEARLY.price)})`;
  }
  return rawType;
}

/** One-off Story Time executive script review submission (pre-production). */
export const EXECUTIVE_SCRIPT_REVIEW_FEE_ZAR = 599.99;

/** Casting portal: confirm hire / contract acquisition (simulated payment). */
export const CASTING_ACQUISITION_FEE_ZAR = 19.99;

/** Casting portal: publish audition listing to agencies (simulated payment). */
export const AUDITION_LISTING_FEE_ZAR = 99.99;

export const COMPANY_PLAN_CONFIG = {
  STANDARD: {
    label: "Normal listing",
    price: 24.99,
    featured: false,
  },
  FEATURED: {
    label: "Featured listing",
    price: 44.99,
    featured: true,
  },
} as const;

export function normalizeCompanyPlan(plan?: string | null) {
  if (!plan) return "STANDARD" as const;
  if (plan === "FEATURED" || plan === "PROMOTED_R49" || plan === "PROMOTED_R44_99") return "FEATURED" as const;
  return "STANDARD" as const;
}

export function getCompanyPlanConfig(plan?: string | null) {
  return COMPANY_PLAN_CONFIG[normalizeCompanyPlan(plan)];
}

export function isFeaturedCompanyPlan(plan?: string | null) {
  return getCompanyPlanConfig(plan).featured;
}
