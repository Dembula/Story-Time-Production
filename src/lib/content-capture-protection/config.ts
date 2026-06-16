export type CaptureProtectionMode = "standard" | "drm";

export type DrmSystemKey = "widevine" | "playready" | "fairplay";

/**
 * Per-DRM-system upstream endpoints. Values may contain the `{uid}` token, which
 * is replaced at request time with the asset's Cloudflare Stream / provider UID.
 * This keeps the platform DRM-provider agnostic (Cloudflare Stream DRM, EZDRM,
 * Axinom, BuyDRM/PallyCon, etc.).
 */
export type DrmServerConfig = {
  /** Generic fallback license server used when a per-system URL is not set. */
  licenseUrl: string | null;
  /** Optional bearer token attached to upstream license/cert requests. */
  authToken: string | null;
  widevineLicenseUrl: string | null;
  playreadyLicenseUrl: string | null;
  fairplayLicenseUrl: string | null;
  /** DER-encoded Apple FairPlay application certificate URL (required for FairPlay). */
  fairplayCertificateUrl: string | null;
};

export type CaptureProtectionConfig = {
  enabled: boolean;
  mode: CaptureProtectionMode;
  watermarkEnabled: boolean;
  drm: DrmServerConfig;
  /** Backwards-compatible accessor for the generic license URL. */
  drmLicenseUrl: string | null;
  drmAuthToken: string | null;
};

const PROXY_BASE = "/api/content/drm-license";

/** Internal proxy paths the client uses (secrets never leave the server). */
export const DRM_LICENSE_PROXY_PATHS = {
  widevine: `${PROXY_BASE}?system=widevine`,
  playready: `${PROXY_BASE}?system=playready`,
  fairplay: `${PROXY_BASE}?system=fairplay`,
  fairplayCertificate: `${PROXY_BASE}?system=fairplay&cert=1`,
} as const;

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Client-safe flags (no secrets, no upstream URLs). */
export function getClientCaptureProtectionConfig(): {
  enabled: boolean;
  mode: CaptureProtectionMode;
  watermarkEnabled: boolean;
  drmConfigured: boolean;
} {
  const enabled = process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_ENABLED !== "false";
  const mode = process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard";
  const drmConfigured = process.env.NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED === "true";
  return {
    enabled,
    mode,
    watermarkEnabled: process.env.NEXT_PUBLIC_CAPTURE_WATERMARK_ENABLED !== "false",
    drmConfigured,
  };
}

/** Server-only DRM/license forwarding config. */
export function getServerCaptureProtectionConfig(): CaptureProtectionConfig {
  const enabled = process.env.CAPTURE_PROTECTION_ENABLED !== "false";
  const mode = process.env.CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard";

  const licenseUrl = readEnv("STORYTIME_DRM_LICENSE_URL");
  const drm: DrmServerConfig = {
    licenseUrl,
    authToken: readEnv("STORYTIME_DRM_AUTH_TOKEN"),
    widevineLicenseUrl: readEnv("STORYTIME_DRM_WIDEVINE_LICENSE_URL") ?? licenseUrl,
    playreadyLicenseUrl: readEnv("STORYTIME_DRM_PLAYREADY_LICENSE_URL") ?? licenseUrl,
    fairplayLicenseUrl: readEnv("STORYTIME_DRM_FAIRPLAY_LICENSE_URL") ?? licenseUrl,
    fairplayCertificateUrl: readEnv("STORYTIME_DRM_FAIRPLAY_CERTIFICATE_URL"),
  };

  return {
    enabled,
    mode,
    watermarkEnabled: process.env.CAPTURE_WATERMARK_ENABLED !== "false",
    drm,
    drmLicenseUrl: drm.licenseUrl,
    drmAuthToken: drm.authToken,
  };
}

/** Is at least one DRM system fully configured on the server? */
export function isServerDrmConfigured(config: CaptureProtectionConfig): boolean {
  if (!config.enabled || config.mode !== "drm") return false;
  const { drm } = config;
  return Boolean(
    drm.widevineLicenseUrl ||
      drm.playreadyLicenseUrl ||
      (drm.fairplayLicenseUrl && drm.fairplayCertificateUrl),
  );
}

/** Resolve the upstream license URL for a given DRM system, applying the `{uid}` token. */
export function resolveUpstreamLicenseUrl(
  config: CaptureProtectionConfig,
  system: DrmSystemKey,
  uid?: string | null,
): string | null {
  const { drm } = config;
  const raw =
    system === "widevine"
      ? drm.widevineLicenseUrl
      : system === "playready"
        ? drm.playreadyLicenseUrl
        : drm.fairplayLicenseUrl;
  if (!raw) return null;
  return uid ? raw.replace(/\{uid\}/g, encodeURIComponent(uid)) : raw;
}

export function resolveUpstreamFairplayCertificateUrl(
  config: CaptureProtectionConfig,
  uid?: string | null,
): string | null {
  const raw = config.drm.fairplayCertificateUrl;
  if (!raw) return null;
  return uid ? raw.replace(/\{uid\}/g, encodeURIComponent(uid)) : raw;
}
