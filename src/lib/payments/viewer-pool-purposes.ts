/** Payment purposes that fund the viewer subscription / PPV creator revenue pool. */
export const VIEWER_POOL_PAYMENT_PURPOSES = [
  "viewer_subscription",
  "viewer_subscription_renewal",
  "viewer_subscription_reactivate",
  "viewer_subscription_plan_change",
  "viewer_ppv",
  // Universe iOS (StoreKit) — must count toward admin revenue + creator pool
  "viewer_subscription_apple_iap",
  "viewer_ppv_apple_iap",
  // Universe Android (Google Play Billing)
  "viewer_subscription_google_play",
  "viewer_ppv_google_play",
  // Manual / console remittance imports for Google Play earnings
  "viewer_google_play_console_remittance",
] as const;

export type ViewerPoolPaymentPurpose = (typeof VIEWER_POOL_PAYMENT_PURPOSES)[number];

export function isViewerPoolPaymentPurpose(purpose: string | null | undefined): boolean {
  return VIEWER_POOL_PAYMENT_PURPOSES.includes((purpose ?? "") as ViewerPoolPaymentPurpose);
}
