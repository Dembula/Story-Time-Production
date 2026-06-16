import {
  getServerCaptureProtectionConfig,
  isServerDrmConfigured,
  type CaptureProtectionConfig,
  type DrmSystemKey,
} from "./config";
import type { PlaybackDrmDescriptor } from "./drm-systems";

export type DrmDescriptorContext = {
  contentId: string;
  episodeId?: string | null;
  isTrailer?: boolean;
};

function proxyUrl(system: DrmSystemKey, ctx: DrmDescriptorContext, cert = false): string {
  const params = new URLSearchParams({ system, contentId: ctx.contentId });
  if (ctx.episodeId) params.set("episodeId", ctx.episodeId);
  if (ctx.isTrailer) params.set("trailer", "1");
  if (cert) params.set("cert", "1");
  return `/api/content/drm-license?${params.toString()}`;
}

/**
 * Build the client-facing DRM descriptor. All license/certificate URLs point at
 * the first-party proxy (`/api/content/drm-license`) so upstream secrets stay on
 * the server. Returns a disabled descriptor when DRM isn't configured.
 */
export function buildClientDrmDescriptor(
  ctx: DrmDescriptorContext,
  config: CaptureProtectionConfig = getServerCaptureProtectionConfig(),
): PlaybackDrmDescriptor {
  if (!isServerDrmConfigured(config)) {
    return { enabled: false, systems: [] };
  }

  const systems: DrmSystemKey[] = [];
  const descriptor: PlaybackDrmDescriptor = { enabled: true, systems };

  if (config.drm.widevineLicenseUrl) {
    systems.push("widevine");
    descriptor.widevineLicenseUrl = proxyUrl("widevine", ctx);
  }
  if (config.drm.playreadyLicenseUrl) {
    systems.push("playready");
    descriptor.playreadyLicenseUrl = proxyUrl("playready", ctx);
  }
  if (config.drm.fairplayLicenseUrl && config.drm.fairplayCertificateUrl) {
    systems.push("fairplay");
    descriptor.fairplayLicenseUrl = proxyUrl("fairplay", ctx);
    descriptor.fairplayCertificateUrl = proxyUrl("fairplay", ctx, true);
  }

  descriptor.enabled = systems.length > 0;
  return descriptor;
}
