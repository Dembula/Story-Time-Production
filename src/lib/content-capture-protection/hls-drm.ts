import type { CaptureProtectionConfig } from "./config";

type HlsConfig = Record<string, unknown>;

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

  const widevineLicenseUrl = config.multiDrm.widevineLicenseUrl ?? config.drmLicenseUrl;
  const playreadyLicenseUrl = config.multiDrm.playreadyLicenseUrl ?? config.drmLicenseUrl;
  const fairplayLicenseUrl = config.multiDrm.fairplayLicenseUrl ?? config.drmLicenseUrl;
  const fairplayCertificateUrl = config.multiDrm.fairplayCertificateUrl;
  const authToken = config.drmAuthToken;
  const drmSystems: Record<string, Record<string, unknown>> = {};

  if (widevineLicenseUrl) {
    drmSystems["com.widevine.alpha"] = {
      licenseUrl: withDrmSystemQuery(widevineLicenseUrl, "widevine"),
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_ALL",
    };
  }
  if (playreadyLicenseUrl) {
    drmSystems["com.microsoft.playready"] = {
      licenseUrl: withDrmSystemQuery(playreadyLicenseUrl, "playready"),
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_ALL",
    };
  }
  if (fairplayLicenseUrl) {
    const fairplayConfig = {
      licenseUrl: withDrmSystemQuery(fairplayLicenseUrl, "fairplay"),
      serverCertificateUrl: fairplayCertificateUrl ?? undefined,
    };
    drmSystems["com.apple.fps"] = fairplayConfig;
    drmSystems["com.apple.fps.1_0"] = fairplayConfig;
  }

  if (Object.keys(drmSystems).length === 0) return null;

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

function withDrmSystemQuery(licenseUrl: string, system: "widevine" | "playready" | "fairplay"): string {
  try {
    const resolved = new URL(
      licenseUrl,
      typeof window !== "undefined" ? window.location.origin : "https://storytime.local",
    );
    resolved.searchParams.set("system", system);
    return resolved.toString();
  } catch {
    const delimiter = licenseUrl.includes("?") ? "&" : "?";
    return `${licenseUrl}${delimiter}system=${system}`;
  }
}
