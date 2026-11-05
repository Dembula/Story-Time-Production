import "server-only";

/** Play Console owner / API access account (not the IAM service account). */
export const GOOGLE_PLAY_CONSOLE_ACCOUNT_EMAIL =
  process.env.GOOGLE_PLAY_CONSOLE_ACCOUNT_EMAIL?.trim() ||
  "storytime.streamingplatform@gmail.com";

export function googlePlayUniversePackageName(): string {
  return (
    process.env.GOOGLE_PLAY_PACKAGE_UNIVERSE?.trim() ||
    process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim() ||
    "com.storytime.universe"
  );
}

export function googlePlayCreatorsPackageName(): string {
  return (
    process.env.GOOGLE_PLAY_PACKAGE_CREATORS?.trim() ||
    "online.storytime.creators"
  );
}

export function resolveGooglePlayPackageName(
  hint?: string | null,
  app: "universe" | "creators" = "universe",
): string {
  const fromClient = String(hint ?? "").trim();
  if (fromClient) return fromClient;
  return app === "creators" ? googlePlayCreatorsPackageName() : googlePlayUniversePackageName();
}

export function isGooglePlayVerificationConfigured(): boolean {
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim()) return true;
  const email = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  return Boolean(email && key);
}

export function allowUnverifiedGooglePlayPurchases(): boolean {
  return process.env.GOOGLE_PLAY_ALLOW_UNVERIFIED === "true";
}
