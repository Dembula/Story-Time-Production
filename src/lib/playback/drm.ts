import { extractCloudflareStreamUid, getCloudflareStreamConfig } from "@/lib/cloudflare-stream";

export type DrmSystem = "fairplay" | "widevine" | "playready";

export type DrmEndpoints = {
  fairplay: {
    licenseUrl: string;
    certUrl: string;
  } | null;
  widevine: {
    licenseUrl: string;
  } | null;
  playready: {
    licenseUrl: string;
  } | null;
};

export type DrmClientHint = {
  enabled: boolean;
  systems: DrmSystem[];
  /** App routes the player POSTs/GETs to for license + cert. */
  proxy: {
    licensePath: string;
    fairplayCertPath: string;
  };
};

export type DrmConfigSummary = {
  enabled: boolean;
  endpoints: DrmEndpoints;
  /** Bearer token forwarded to license server (never sent to client). */
  authToken: string | null;
};

/** Lookup canonical Cloudflare Stream DRM URLs for a UID (used when CF DRM enterprise add-on is enabled). */
function buildCloudflareStreamDrmEndpoints(uid: string): DrmEndpoints {
  const base = `https://videodelivery.net/${uid}/drm`;
  return {
    fairplay: {
      licenseUrl: `${base}/fairplay`,
      certUrl: `${base}/fairplay/cert`,
    },
    widevine: { licenseUrl: `${base}/widevine` },
    playready: { licenseUrl: `${base}/playready` },
  };
}

function envEndpoint(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

/** Build per-content DRM endpoints with priority: env override → Cloudflare Stream native → legacy single license URL. */
export function resolveDrmEndpoints(videoUrl: string | null | undefined): DrmConfigSummary {
  const drmEnabled = process.env.CAPTURE_PROTECTION_MODE === "drm";
  const legacyLicense = envEndpoint("STORYTIME_DRM_LICENSE_URL");
  const fairplayLicense = envEndpoint("STORYTIME_DRM_FAIRPLAY_LICENSE_URL") ?? legacyLicense;
  const fairplayCert = envEndpoint("STORYTIME_DRM_FAIRPLAY_CERT_URL");
  const widevineLicense = envEndpoint("STORYTIME_DRM_WIDEVINE_LICENSE_URL") ?? legacyLicense;
  const playreadyLicense = envEndpoint("STORYTIME_DRM_PLAYREADY_LICENSE_URL") ?? legacyLicense;
  const useCloudflareNative = process.env.CLOUDFLARE_STREAM_DRM_NATIVE === "true";

  let endpoints: DrmEndpoints = {
    fairplay:
      fairplayLicense && fairplayCert
        ? { licenseUrl: fairplayLicense, certUrl: fairplayCert }
        : null,
    widevine: widevineLicense ? { licenseUrl: widevineLicense } : null,
    playready: playreadyLicense ? { licenseUrl: playreadyLicense } : null,
  };

  if (useCloudflareNative) {
    const uid = extractCloudflareStreamUid(videoUrl ?? "");
    const cfg = getCloudflareStreamConfig();
    if (uid && cfg) {
      const cf = buildCloudflareStreamDrmEndpoints(uid);
      endpoints = {
        fairplay: endpoints.fairplay ?? cf.fairplay,
        widevine: endpoints.widevine ?? cf.widevine,
        playready: endpoints.playready ?? cf.playready,
      };
    }
  }

  return {
    enabled: drmEnabled && (Boolean(endpoints.fairplay) || Boolean(endpoints.widevine) || Boolean(endpoints.playready)),
    endpoints,
    authToken: envEndpoint("STORYTIME_DRM_AUTH_TOKEN"),
  };
}

/** Client-safe summary returned in the playback bundle (no upstream URLs leaked). */
export function buildDrmClientHint(summary: DrmConfigSummary): DrmClientHint {
  const systems: DrmSystem[] = [];
  if (summary.endpoints.fairplay) systems.push("fairplay");
  if (summary.endpoints.widevine) systems.push("widevine");
  if (summary.endpoints.playready) systems.push("playready");

  return {
    enabled: summary.enabled,
    systems,
    proxy: {
      licensePath: "/api/content/drm-license",
      fairplayCertPath: "/api/content/drm-license/fairplay-cert",
    },
  };
}

/** Server-side: pick the upstream URL for a given DRM system. Returns null if not configured. */
export function getDrmUpstreamLicenseUrl(
  summary: DrmConfigSummary,
  system: DrmSystem,
): string | null {
  switch (system) {
    case "fairplay":
      return summary.endpoints.fairplay?.licenseUrl ?? null;
    case "widevine":
      return summary.endpoints.widevine?.licenseUrl ?? null;
    case "playready":
      return summary.endpoints.playready?.licenseUrl ?? null;
  }
}
