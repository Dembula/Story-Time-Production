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
  PER_FILM: "CREATOR_PER_FILM_R99_99",
  UPLOAD_ONLY_YEARLY: "CREATOR_UPLOAD_ONLY_R599_Y",
  PIPELINE_YEARLY: "CREATOR_PIPELINE_R1999_Y",
  PIPELINE_MONTHLY: "CREATOR_PIPELINE_R209_M",
} as const;

/** One-time fee per catalogue film submission (pay-per-film plan). */
export const CREATOR_PER_FILM_UPLOAD_PRICE = 99.99;

/** React Query key — invalidate/set after license POST so sidebar & gates see fresh access. */
export const CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY = ["creator-distribution-license"] as const;

export const CREATOR_STUDIO_PROFILES_QUERY_KEY = ["creator-studio-profiles"] as const;

export const CREATOR_ONBOARDING_PLANS = {
  PER_FILM: {
    id: "PER_FILM" as const,
    label: "Pay per film",
    headline: "Catalogue upload only — pay when you submit each title",
    price: CREATOR_PER_FILM_UPLOAD_PRICE,
    interval: "film" as const,
    includesPipeline: false,
  },
  UPLOAD_YEARLY: {
    id: "UPLOAD_YEARLY" as const,
    label: "Catalogue unlimited",
    headline: "Unlimited catalogue uploads for one year",
    price: 599.99,
    interval: "year" as const,
    includesPipeline: false,
  },
  /** @deprecated Use UPLOAD_YEARLY — kept for imports that still reference UPLOAD_ONLY */
  UPLOAD_ONLY: {
    id: "UPLOAD_YEARLY" as const,
    label: "Catalogue unlimited",
    headline: "Unlimited catalogue uploads for one year",
    price: 599.99,
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
    label: "Yearly catalogue license",
    price: CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price,
  },
  PER_FILM: {
    label: "Pay per film",
    price: CREATOR_PER_FILM_UPLOAD_PRICE,
  },
  PER_UPLOAD: {
    label: "Pay per film",
    price: CREATOR_PER_FILM_UPLOAD_PRICE,
  },
} as const;

/** Whether this account may use pre/production/post tools and project pipeline routes. */
export function creatorHasPipelineAccess(rawType: string | null | undefined): boolean {
  if (!rawType) return false;
  if (rawType.startsWith("CREATOR_PIPELINE_")) return true;
  if (rawType.startsWith("CREATOR_UPLOAD_")) return false;
  if (rawType.startsWith("CREATOR_PER_FILM")) return false;
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

export function isCreatorPerFilmLicense(rawType: string | null | undefined): boolean {
  if (!rawType) return false;
  if (rawType === CREATOR_LICENSE_TYPE.PER_FILM) return true;
  return (
    rawType === "PER_UPLOAD" ||
    rawType === "PER_UPLOAD_R10" ||
    rawType === "PER_UPLOAD_R24_99" ||
    rawType.includes("PER_UPLOAD") ||
    rawType.includes("PER_FILM")
  );
}

/** @deprecated Use isCreatorPerFilmLicense */
export function isCreatorPerUploadLicense(rawType: string | null | undefined): boolean {
  return isCreatorPerFilmLicense(rawType);
}

export function isCreatorYearlyCatalogueLicense(rawType: string | null | undefined): boolean {
  if (!rawType) return false;
  if (rawType === CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY) return true;
  if (rawType === "CREATOR_UPLOAD_ONLY_R99_Y") return true;
  return rawType === "YEARLY" || rawType === "YEARLY_R89";
}

/** License period still valid (uses yearlyExpiresAt for all timed plans). */
export function isCreatorLicensePeriodActive(license: {
  type: string;
  yearlyExpiresAt: Date | string | null;
  status?: string | null;
}): boolean {
  if (license.status === "CANCELLED" || license.status === "PAST_DUE") return false;
  if (isCreatorPerFilmLicense(license.type)) return true;
  if (!license.yearlyExpiresAt) return true;
  const end = new Date(license.yearlyExpiresAt);
  return end.getTime() > Date.now();
}

export function normalizeCreatorLicenseType(type?: string | null) {
  if (!type) return "YEARLY" as const;
  if (isCreatorPerFilmLicense(type)) return "PER_FILM" as const;
  return "YEARLY" as const;
}

export function getCreatorLicenseConfig(type?: string | null) {
  const normalized = normalizeCreatorLicenseType(type);
  if (normalized === "PER_FILM") return CREATOR_LICENSE_CONFIG.PER_FILM;
  return CREATOR_LICENSE_CONFIG.YEARLY;
}

export function formatCreatorLicenseSummary(rawType: string | null | undefined): string {
  if (!rawType) return "No plan";
  switch (rawType) {
    case CREATOR_LICENSE_TYPE.PER_FILM:
      return `Pay per film · ${formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} per submission`;
    case CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY:
      return `Catalogue unlimited · ${formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price)}/year`;
    case CREATOR_LICENSE_TYPE.PIPELINE_YEARLY:
      return `Full pipeline · ${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price)}/year`;
    case CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY:
      return `Full pipeline · ${formatZar(CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price)}/month`;
    default:
      break;
  }
  if (isCreatorPerFilmLicense(rawType)) {
    return `Pay per film · ${formatZar(CREATOR_PER_FILM_UPLOAD_PRICE)} per submission`;
  }
  if (rawType === "CREATOR_UPLOAD_ONLY_R99_Y") {
    return `Catalogue unlimited · ${formatZar(CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price)}/year`;
  }
  if (rawType === "YEARLY" || rawType === "YEARLY_R89") {
    return `Catalogue unlimited · ${formatZar(CREATOR_LICENSE_CONFIG.YEARLY.price)}/year`;
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
