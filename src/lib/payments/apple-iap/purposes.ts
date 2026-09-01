/** Apple IAP payment purposes written by activate-creator / activate-viewer. */

export const CREATOR_APPLE_IAP_LICENSE_PURPOSE = "creator_distribution_license_apple_iap";
export const CREATOR_APPLE_IAP_UPLOAD_PURPOSE = "creator_film_upload_apple_iap";

export const VIEWER_APPLE_IAP_SUBSCRIPTION_PURPOSE = "viewer_subscription_apple_iap";
export const VIEWER_APPLE_IAP_PPV_PURPOSE = "viewer_ppv_apple_iap";

export const CREATOR_APPLE_IAP_PURPOSES = [
  CREATOR_APPLE_IAP_LICENSE_PURPOSE,
  CREATOR_APPLE_IAP_UPLOAD_PURPOSE,
] as const;

export function isCreatorAppleIapLicensePurpose(purpose: string | null | undefined): boolean {
  return purpose === CREATOR_APPLE_IAP_LICENSE_PURPOSE;
}

export function isCreatorAppleIapUploadPurpose(purpose: string | null | undefined): boolean {
  return purpose === CREATOR_APPLE_IAP_UPLOAD_PURPOSE;
}
