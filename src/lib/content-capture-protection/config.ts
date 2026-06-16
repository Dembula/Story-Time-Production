export type CaptureProtectionMode = "standard" | "drm";

export type CaptureProtectionConfig = {
  enabled: boolean;
  mode: CaptureProtectionMode;
  drmLicenseUrl: string | null;
  fairPlayCertificateUrl: string | null;
  drmAuthToken: string | null;
  watermarkEnabled: boolean;
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
  return {
    enabled,
    mode,
    drmLicenseUrl: process.env.STORYTIME_DRM_LICENSE_URL?.trim() || null,
    fairPlayCertificateUrl: process.env.STORYTIME_DRM_FAIRPLAY_CERT_URL?.trim() || null,
    drmAuthToken: process.env.STORYTIME_DRM_AUTH_TOKEN?.trim() || null,
    watermarkEnabled: process.env.CAPTURE_WATERMARK_ENABLED !== "false",
  };
}
