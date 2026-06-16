export type CaptureProtectionMode = "standard" | "drm";

export type MultiDrmConfig = {
  widevineLicenseUrl: string | null;
  playreadyLicenseUrl: string | null;
  fairplayLicenseUrl: string | null;
  fairplayCertificateUrl: string | null;
};

export type CaptureProtectionConfig = {
  enabled: boolean;
  mode: CaptureProtectionMode;
  drmLicenseUrl: string | null;
  drmAuthToken: string | null;
  watermarkEnabled: boolean;
  multiDrm: MultiDrmConfig;
};

/** Client-safe flags (no secrets). */
export function getClientCaptureProtectionConfig(): Pick<
  CaptureProtectionConfig,
  "enabled" | "mode" | "watermarkEnabled"
> & { drmConfigured: boolean } {
  const enabled = process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_ENABLED !== "false";
  const mode =
    process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard";
  const drmConfigured = Boolean(process.env.NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED === "true");
  return {
    enabled,
    mode,
    watermarkEnabled: process.env.NEXT_PUBLIC_CAPTURE_WATERMARK_ENABLED !== "false",
    drmConfigured,
  };
}

/** Server-only DRM license forwarding config. */
export function getServerCaptureProtectionConfig(): CaptureProtectionConfig {
  const enabled = process.env.CAPTURE_PROTECTION_ENABLED !== "false";
  const mode =
    process.env.CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard";
  const multiDrm: MultiDrmConfig = {
    widevineLicenseUrl: process.env.STORYTIME_DRM_WIDEVINE_LICENSE_URL?.trim() || null,
    playreadyLicenseUrl: process.env.STORYTIME_DRM_PLAYREADY_LICENSE_URL?.trim() || null,
    fairplayLicenseUrl: process.env.STORYTIME_DRM_FAIRPLAY_LICENSE_URL?.trim() || null,
    fairplayCertificateUrl: process.env.STORYTIME_DRM_FAIRPLAY_CERT_URL?.trim() || null,
  };
  const drmLicenseUrl = process.env.STORYTIME_DRM_LICENSE_URL?.trim() || null;
  return {
    enabled,
    mode,
    drmLicenseUrl:
      drmLicenseUrl ??
      multiDrm.widevineLicenseUrl ??
      multiDrm.playreadyLicenseUrl ??
      multiDrm.fairplayLicenseUrl,
    drmAuthToken: process.env.STORYTIME_DRM_AUTH_TOKEN?.trim() || null,
    watermarkEnabled: process.env.CAPTURE_WATERMARK_ENABLED !== "false",
    multiDrm,
  };
}
