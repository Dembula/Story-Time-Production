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

export const CREATOR_LICENSE_CONFIG = {
  YEARLY: {
    label: "Yearly distribution license",
    price: 99.99,
  },
  PER_UPLOAD: {
    label: "Pay per upload",
    price: 24.99,
  },
} as const;

export function normalizeCreatorLicenseType(type?: string | null) {
  if (!type) return "YEARLY" as const;
  if (type === "PER_UPLOAD" || type === "PER_UPLOAD_R10" || type === "PER_UPLOAD_R24_99") return "PER_UPLOAD" as const;
  return "YEARLY" as const;
}

export function getCreatorLicenseConfig(type?: string | null) {
  return CREATOR_LICENSE_CONFIG[normalizeCreatorLicenseType(type)];
}

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
