import type { CaptureProtectionConfig } from "./config";
import type { DrmKeySystem } from "@/lib/playback/device-drm";

type HlsConfig = Record<string, unknown>;

/**
 * hls.js DRM configuration for Widevine / PlayReady / FairPlay.
 * On devices with hardware-backed DRM (Widevine L1, FairPlay), decrypted frames
 * stay in a protected compositor path — screen capture shows black while playback
 * remains visible to the viewer.
 */
export function buildHlsDrmConfig(
  config: CaptureProtectionConfig,
  preferredKeySystems?: DrmKeySystem[],
): HlsConfig | null {
  if (!config.enabled || config.mode !== "drm" || !config.drmLicenseUrl) {
    return null;
  }

  const licenseUrl = config.drmLicenseUrl;
  const authToken = config.drmAuthToken;
  const keySystems = preferredKeySystems ?? [
    "com.widevine.alpha",
    "com.microsoft.playready",
    "com.apple.fps",
  ];

  const drmSystems: Record<string, Record<string, unknown>> = {};

  if (keySystems.includes("com.widevine.alpha")) {
    drmSystems["com.widevine.alpha"] = {
      licenseUrl,
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_ALL",
    };
  }

  if (keySystems.includes("com.microsoft.playready")) {
    drmSystems["com.microsoft.playready"] = {
      licenseUrl,
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_ALL",
    };
  }

  if (keySystems.includes("com.apple.fps")) {
    drmSystems["com.apple.fps"] = {
      licenseUrl,
      ...(config.fairPlayCertificateUrl
        ? { serverCertificateUrl: config.fairPlayCertificateUrl }
        : {}),
    };
  }

  return {
    emeEnabled: true,
    drmSystemOptions: {
      audioEncryptionScheme: "cbcs",
      videoEncryptionScheme: "cbcs",
    },
    drmSystems,
    licenseXhrSetup: (xhr: XMLHttpRequest) => {
      if (authToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
      }
    },
    requestMediaKeySystemAccessFunc: (
      keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[],
    ) => {
      const configs = supportedConfigurations.map((entry) => ({
        ...entry,
        videoCapabilities: entry.videoCapabilities?.map((cap) => ({
          ...cap,
          robustness: cap.robustness ?? "HW_SECURE_ALL",
        })),
        audioCapabilities: entry.audioCapabilities?.map((cap) => ({
          ...cap,
          robustness: cap.robustness ?? "HW_SECURE_ALL",
        })),
      }));
      return navigator.requestMediaKeySystemAccess(keySystem, configs);
    },
  };
}
