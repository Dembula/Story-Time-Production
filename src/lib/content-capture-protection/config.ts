export type CaptureProtectionMode = "standard" | "drm";

export type CaptureProtectionConfig = {
  enabled: boolean;
  mode: CaptureProtectionMode;
  drmLicenseUrl: string | null;
  drmAuthToken: string | null;
  /** Apple FairPlay Streaming application certificate (URL the platform proxies). */
  fairplayCertificateUrl: string | null;
  /** Inline base64 FairPlay certificate (alternative to a URL). */
  fairplayCertificateBase64: string | null;
  watermarkEnabled: boolean;
};

/** True when an Apple FairPlay application certificate is available to serve. */
export function hasFairPlayCertificate(config: CaptureProtectionConfig): boolean {
  return Boolean(config.fairplayCertificateUrl || config.fairplayCertificateBase64);
}

/** Client-safe flags (no secrets). */
export function getClientCaptureProtectionConfig(): Pick<
  CaptureProtectionConfig,
  "enabled" | "mode" | "watermarkEnabled"
> & { drmConfigured: boolean; fairplayConfigured: boolean } {
  const enabled = process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_ENABLED !== "false";
  const mode =
    process.env.NEXT_PUBLIC_CAPTURE_PROTECTION_MODE === "drm" ? "drm" : "standard";
  const drmConfigured = Boolean(process.env.NEXT_PUBLIC_CAPTURE_DRM_CONFIGURED === "true");
  const fairplayConfigured = Boolean(process.env.NEXT_PUBLIC_CAPTURE_FAIRPLAY_CONFIGURED === "true");
  return {
    enabled,
    mode,
    watermarkEnabled: process.env.NEXT_PUBLIC_CAPTURE_WATERMARK_ENABLED !== "false",
    drmConfigured,
    fairplayConfigured,
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
    drmAuthToken: process.env.STORYTIME_DRM_AUTH_TOKEN?.trim() || null,
    fairplayCertificateUrl: process.env.STORYTIME_FAIRPLAY_CERT_URL?.trim() || null,
    fairplayCertificateBase64: process.env.STORYTIME_FAIRPLAY_CERT_BASE64?.trim() || null,
    watermarkEnabled: process.env.CAPTURE_WATERMARK_ENABLED !== "false",
  };
}
