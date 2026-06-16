"use client";

import type { DrmClientHint, DrmSystem } from "@/lib/playback/drm";

export type ClientDrmConfig = NonNullable<ReturnType<typeof buildClientDrmConfig>>;

type HlsConfig = Record<string, unknown>;

function buildLicenseUrl(hint: DrmClientHint, system: DrmSystem, params: { contentId: string; videoUrl?: string | null }): string {
  const url = new URL(`${hint.proxy.licensePath}/${system}`, window.location.origin);
  url.searchParams.set("contentId", params.contentId);
  if (params.videoUrl) url.searchParams.set("videoUrl", params.videoUrl);
  return url.toString();
}

function buildCertUrl(hint: DrmClientHint, params: { videoUrl?: string | null }): string {
  const url = new URL(hint.proxy.fairplayCertPath, window.location.origin);
  if (params.videoUrl) url.searchParams.set("videoUrl", params.videoUrl);
  return url.toString();
}

/**
 * Build EME/DRM config for hls.js consumption. Hardware-backed robustness keeps decoded
 * frames in a protected compositor path so screen capture shows black on macOS / Windows
 * / Android, while playback stays visible to the viewer.
 */
export function buildClientDrmConfig(params: {
  drm: DrmClientHint | null | undefined;
  contentId: string;
  videoUrl?: string | null;
}): HlsConfig | null {
  if (!params.drm?.enabled || params.drm.systems.length === 0) return null;
  if (typeof window === "undefined") return null;

  const drmSystems: HlsConfig = {};
  for (const system of params.drm.systems) {
    if (system === "widevine") {
      drmSystems["com.widevine.alpha"] = {
        licenseUrl: buildLicenseUrl(params.drm, "widevine", { contentId: params.contentId, videoUrl: params.videoUrl }),
        videoRobustness: "HW_SECURE_DECODE",
        audioRobustness: "SW_SECURE_CRYPTO",
      };
    } else if (system === "playready") {
      drmSystems["com.microsoft.playready"] = {
        licenseUrl: buildLicenseUrl(params.drm, "playready", { contentId: params.contentId, videoUrl: params.videoUrl }),
        videoRobustness: "3000",
        audioRobustness: "2000",
      };
    } else if (system === "fairplay") {
      drmSystems["com.apple.fps"] = {
        licenseUrl: buildLicenseUrl(params.drm, "fairplay", { contentId: params.contentId, videoUrl: params.videoUrl }),
        serverCertificateUrl: buildCertUrl(params.drm, { videoUrl: params.videoUrl }),
      };
    }
  }

  return {
    emeEnabled: true,
    drmSystemOptions: {
      audioEncryptionScheme: "cbcs",
      videoEncryptionScheme: "cbcs",
    },
    drmSystems,
  };
}

/**
 * Apply Netflix/Prime-style production hls.js tuning. These values prioritize stability,
 * fast first-frame paint, and graceful degradation on flaky networks.
 */
export function applyProductionHlsConfig(instance: unknown): void {
  const hls = instance as { config?: HlsConfig } | null;
  if (!hls?.config) return;
  Object.assign(hls.config, {
    enableWorker: true,
    lowLatencyMode: false,
    backBufferLength: 90,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    maxBufferSize: 60 * 1000 * 1000,
    startLevel: -1,
    capLevelToPlayerSize: true,
    abrEwmaDefaultEstimate: 2_000_000,
    nudgeMaxRetry: 8,
    manifestLoadingTimeOut: 12_000,
    manifestLoadingMaxRetry: 6,
    levelLoadingTimeOut: 12_000,
    fragLoadingTimeOut: 30_000,
    fragLoadingMaxRetry: 8,
    appendErrorMaxRetry: 6,
  });
}

export function mergeHlsConfig(instance: unknown, partial: HlsConfig | null | undefined): void {
  if (!partial) return;
  const hls = instance as { config?: HlsConfig } | null;
  if (!hls?.config) return;
  Object.assign(hls.config, partial);
}
