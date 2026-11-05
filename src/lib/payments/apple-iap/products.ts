/**
 * App Store product IDs ↔ Story Time plan / license codes.
 * Always verify productId from decoded Apple JWS; never trust client-only plan fields.
 */

import { CREATOR_LICENSE_TYPE, VIEWER_PLAN_CONFIG } from "@/lib/pricing";

/** Universe (viewer) subscription products */
export const APPLE_UNIVERSE_SUBSCRIPTION_PRODUCTS: Record<
  string,
  { planCode: keyof typeof VIEWER_PLAN_CONFIG; profileLimit: number; billingInterval: "month" | "year" }
> = {
  "com.storytime.universe.sub.base.monthly": {
    planCode: "BASE_1",
    profileLimit: 1,
    billingInterval: "month",
  },
  "com.storytime.universe.sub.base.yearly": {
    planCode: "BASE_1",
    profileLimit: 1,
    billingInterval: "year",
  },
  "com.storytime.universe.sub.standard.monthly": {
    planCode: "STANDARD_3",
    profileLimit: 3,
    billingInterval: "month",
  },
  "com.storytime.universe.sub.standard.yearly": {
    planCode: "STANDARD_3",
    profileLimit: 3,
    billingInterval: "year",
  },
  "com.storytime.universe.sub.family.monthly": {
    planCode: "FAMILY_5",
    profileLimit: 5,
    billingInterval: "month",
  },
  "com.storytime.universe.sub.family.yearly": {
    planCode: "FAMILY_5",
    profileLimit: 5,
    billingInterval: "year",
  },
};

export const APPLE_UNIVERSE_PPV_PRODUCT_ID = "com.storytime.universe.ppv.unlock";

/** Creator app products */
export const APPLE_CREATOR_PRODUCTS: Record<
  string,
  {
    kind: "creator_license" | "content_upload";
    package?: "UPLOAD_YEARLY" | "PIPELINE_MONTHLY" | "PIPELINE_YEARLY";
    licenseType?: string;
    billing?: "YEARLY" | "MONTHLY";
  }
> = {
  "online.storytime.creators.sub.upload.yearly": {
    kind: "creator_license",
    package: "UPLOAD_YEARLY",
    licenseType: CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY,
    billing: "YEARLY",
  },
  "online.storytime.creators.sub.pipeline.monthly": {
    kind: "creator_license",
    package: "PIPELINE_MONTHLY",
    licenseType: CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY,
    billing: "MONTHLY",
  },
  "online.storytime.creators.sub.pipeline.yearly": {
    kind: "creator_license",
    package: "PIPELINE_YEARLY",
    licenseType: CREATOR_LICENSE_TYPE.PIPELINE_YEARLY,
    billing: "YEARLY",
  },
  "online.storytime.creators.upload.perfilm": {
    kind: "content_upload",
  },
};

export function resolveUniverseSubscriptionProduct(productId: string) {
  return APPLE_UNIVERSE_SUBSCRIPTION_PRODUCTS[productId.trim()] ?? null;
}

export function resolveCreatorAppleProduct(productId: string) {
  return APPLE_CREATOR_PRODUCTS[productId.trim()] ?? null;
}

/** Google Play Universe subscription products (Android app). */
export const GOOGLE_UNIVERSE_SUBSCRIPTION_PRODUCTS: Record<
  string,
  { planCode: keyof typeof VIEWER_PLAN_CONFIG; profileLimit: number; billingInterval: "month" | "year" }
> = {
  "stu.sub.base.monthly": { planCode: "BASE_1", profileLimit: 1, billingInterval: "month" },
  "stu.sub.base.yearly": { planCode: "BASE_1", profileLimit: 1, billingInterval: "year" },
  "stu.sub.standard.monthly": { planCode: "STANDARD_3", profileLimit: 3, billingInterval: "month" },
  "stu.sub.standard.yearly": { planCode: "STANDARD_3", profileLimit: 3, billingInterval: "year" },
  "stu.sub.premium.monthly": { planCode: "FAMILY_5", profileLimit: 5, billingInterval: "month" },
  "stu.sub.premium.yearly": { planCode: "FAMILY_5", profileLimit: 5, billingInterval: "year" },
};

export const GOOGLE_UNIVERSE_PPV_PRODUCT_ID = "stu.ppv.unlock";

export function resolveGoogleUniverseSubscriptionProduct(productId: string) {
  return GOOGLE_UNIVERSE_SUBSCRIPTION_PRODUCTS[productId.trim()] ?? null;
}

/** Creator Google Play product IDs (Play Console). */
export const GOOGLE_CREATOR_PRODUCTS: Record<
  string,
  {
    kind: "creator_license" | "content_upload";
    package?: "UPLOAD_YEARLY" | "PIPELINE_MONTHLY" | "PIPELINE_YEARLY";
    licenseType?: string;
    billing?: "YEARLY" | "MONTHLY";
  }
> = {
  "st.creators.catalogue.yearly": {
    kind: "creator_license",
    package: "UPLOAD_YEARLY",
    licenseType: CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY,
    billing: "YEARLY",
  },
  "st.creators.pipeline.monthly": {
    kind: "creator_license",
    package: "PIPELINE_MONTHLY",
    licenseType: CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY,
    billing: "MONTHLY",
  },
  "st.creators.pipeline.yearly": {
    kind: "creator_license",
    package: "PIPELINE_YEARLY",
    licenseType: CREATOR_LICENSE_TYPE.PIPELINE_YEARLY,
    billing: "YEARLY",
  },
  "st.creators.perfilm": {
    kind: "content_upload",
  },
};

export function resolveGoogleCreatorProduct(productId: string) {
  const id = productId.trim();
  return GOOGLE_CREATOR_PRODUCTS[id] ?? resolveCreatorAppleProduct(id);
}

export function isGoogleUniverseSubscriptionProduct(productId: string): boolean {
  return Boolean(resolveGoogleUniverseSubscriptionProduct(productId));
}

export function isGoogleUniversePpvProduct(productId: string): boolean {
  const id = productId.trim();
  return id === GOOGLE_UNIVERSE_PPV_PRODUCT_ID || id.includes("ppv");
}

export function isGoogleCreatorSubscriptionProduct(productId: string): boolean {
  const mapped = resolveGoogleCreatorProduct(productId);
  return mapped?.kind === "creator_license";
}

export function allowedAppleBundleIds(): string[] {
  const raw =
    process.env.APPLE_IAP_BUNDLE_IDS?.trim() ||
    [
      process.env.APPLE_BUNDLE_ID_UNIVERSE?.trim(),
      process.env.APPLE_BUNDLE_ID_CREATORS?.trim(),
      "com.storytime.universe",
      "online.storytime.creators",
    ]
      .filter(Boolean)
      .join(",");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
