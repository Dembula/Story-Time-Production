import type { PlaybackDrmDescriptor } from "./drm-systems";

type HlsConfig = Record<string, unknown>;

/**
 * hls.js EME / DRM configuration for Widevine, PlayReady and (where hls.js
 * drives playback) FairPlay.
 *
 * On hardware-backed DRM (Widevine L1, PlayReady SL3000, FairPlay) the
 * decrypted frames stay inside a protected compositor path, so screen capture
 * records black while playback stays visible to the viewer — the bar Apple,
 * Netflix and Prime Video hold studio content to.
 *
 * NOTE: Apple platforms (Safari / iOS / iPadOS / visionOS) play HLS natively
 * and do NOT run hls.js, so FairPlay there is wired separately through native
 * EME — see `fairplay-native.ts`. This config still emits FairPlay settings for
 * the rare non-Safari hls.js + FairPlay combinations.
 */
export function buildHlsDrmConfig(descriptor: PlaybackDrmDescriptor | null | undefined): HlsConfig | null {
  if (!descriptor?.enabled || descriptor.systems.length === 0) return null;

  const drmSystems: Record<string, unknown> = {};

  if (descriptor.widevineLicenseUrl && descriptor.systems.includes("widevine")) {
    drmSystems["com.widevine.alpha"] = {
      licenseUrl: descriptor.widevineLicenseUrl,
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_ALL",
      persistentState: "optional",
    };
  }

  if (descriptor.playreadyLicenseUrl && descriptor.systems.includes("playready")) {
    drmSystems["com.microsoft.playready"] = {
      licenseUrl: descriptor.playreadyLicenseUrl,
      videoRobustness: "3000",
      audioRobustness: "2000",
    };
  }

  if (
    descriptor.fairplayLicenseUrl &&
    descriptor.fairplayCertificateUrl &&
    descriptor.systems.includes("fairplay")
  ) {
    drmSystems["com.apple.fps"] = {
      licenseUrl: descriptor.fairplayLicenseUrl,
      serverCertificateUrl: descriptor.fairplayCertificateUrl,
    };
  }

  if (Object.keys(drmSystems).length === 0) return null;

  return {
    emeEnabled: true,
    drmSystemOptions: {
      // cbcs is the common scheme across CMAF / fMP4 for all three systems.
      audioEncryptionScheme: "cbcs",
      videoEncryptionScheme: "cbcs",
    },
    drmSystems,
    requestMediaKeySystemAccessFunc: (
      keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[],
    ) => {
      const configs = supportedConfigurations.map((entry) => ({
        ...entry,
        videoCapabilities: entry.videoCapabilities?.map((cap) => ({
          ...cap,
          robustness: cap.robustness || (keySystem.includes("widevine") ? "HW_SECURE_ALL" : cap.robustness),
        })),
        audioCapabilities: entry.audioCapabilities?.map((cap) => ({
          ...cap,
          robustness: cap.robustness || (keySystem.includes("widevine") ? "HW_SECURE_ALL" : cap.robustness),
        })),
      }));
      return navigator.requestMediaKeySystemAccess(keySystem, configs).catch(() => {
        // Fall back to software robustness if hardware DRM is unavailable on the device.
        return navigator.requestMediaKeySystemAccess(keySystem, supportedConfigurations);
      });
    },
  };
}
