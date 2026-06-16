import type { CaptureProtectionConfig } from "./config";

type HlsConfig = Record<string, unknown>;
const ROBUSTNESS_LADDER = ["HW_SECURE_ALL", "HW_SECURE_DECODE", "SW_SECURE_DECODE", "SW_SECURE_CRYPTO", ""] as const;

function withRobustness(
  supportedConfigurations: MediaKeySystemConfiguration[],
  robustness: (typeof ROBUSTNESS_LADDER)[number],
): MediaKeySystemConfiguration[] {
  return supportedConfigurations.map((entry) => ({
    ...entry,
    videoCapabilities: entry.videoCapabilities?.map((cap) => ({
      ...cap,
      robustness: robustness || undefined,
    })),
    audioCapabilities: entry.audioCapabilities?.map((cap) => ({
      ...cap,
      robustness: robustness || undefined,
    })),
  }));
}

/**
 * hls.js DRM configuration for Widevine / PlayReady / FairPlay.
 * On devices with hardware-backed DRM (Widevine L1, FairPlay), decrypted frames
 * stay in a protected compositor path — screen capture shows black while playback
 * remains visible to the viewer.
 */
export function buildHlsDrmConfig(config: CaptureProtectionConfig): HlsConfig | null {
  if (!config.enabled || config.mode !== "drm" || !config.drmLicenseUrl) {
    return null;
  }

  const licenseUrl = config.drmLicenseUrl;
  const authToken = config.drmAuthToken;

  return {
    emeEnabled: true,
    drmSystemOptions: {
      audioEncryptionScheme: "cbcs",
      videoEncryptionScheme: "cbcs",
    },
    drmSystems: {
      "com.widevine.alpha": {
        licenseUrl,
        videoRobustness: "HW_SECURE_ALL",
        audioRobustness: "HW_SECURE_ALL",
      },
      "com.microsoft.playready": {
        licenseUrl,
        videoRobustness: "HW_SECURE_DECODE",
        audioRobustness: "HW_SECURE_DECODE",
      },
      "com.apple.fps": {
        licenseUrl,
        serverCertificateUrl: config.fairPlayCertificateUrl ?? undefined,
      },
    },
    licenseXhrSetup: (xhr: XMLHttpRequest) => {
      if (authToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
      }
    },
    requestMediaKeySystemAccessFunc: async (
      keySystem: string,
      supportedConfigurations: MediaKeySystemConfiguration[],
    ) => {
      if (keySystem === "com.apple.fps") {
        return navigator.requestMediaKeySystemAccess(keySystem, supportedConfigurations);
      }

      let lastError: unknown = null;
      for (const robustness of ROBUSTNESS_LADDER) {
        try {
          return await navigator.requestMediaKeySystemAccess(
            keySystem,
            withRobustness(supportedConfigurations, robustness),
          );
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError instanceof Error ? lastError : new Error(`DRM key system unavailable: ${keySystem}`);
    },
  };
}
