import type {
  DrmKeySystemId,
  PlaybackDrmDescriptor,
  PlaybackContainerKind,
} from "./manifest-types";

/**
 * Server-side, secret-aware DRM configuration. Reads provider credentials
 * from env and translates them into client-safe descriptors that point at the
 * Story Time license proxy routes (`/api/content/drm/*`).
 *
 * Provider neutrality: we deliberately funnel all upstream traffic through
 * our own proxy so we can swap between BuyDRM (KeyOS), EZDRM, Axinom,
 * Cloudflare Stream DRM, or a self-hosted PlayReady server without changing
 * the client.
 */

const FAIRPLAY_CERTIFICATE_PATH = "/api/content/drm/fairplay/certificate";
const FAIRPLAY_LICENSE_PATH = "/api/content/drm/fairplay/license";
const WIDEVINE_LICENSE_PATH = "/api/content/drm/widevine/license";
const PLAYREADY_LICENSE_PATH = "/api/content/drm/playready/license";

export type DrmProviderConfig = {
  enabled: boolean;
  widevine: {
    enabled: boolean;
    upstreamLicenseUrl: string | null;
    authToken: string | null;
    customDataHeader: string | null;
  };
  playready: {
    enabled: boolean;
    upstreamLicenseUrl: string | null;
    authToken: string | null;
    customDataHeader: string | null;
  };
  fairplay: {
    enabled: boolean;
    upstreamLicenseUrl: string | null;
    upstreamCertificateUrl: string | null;
    authToken: string | null;
    contentIdPrefix: string | null;
  };
  legacyLicenseUrl: string | null;
  legacyAuthToken: string | null;
};

export function getDrmProviderConfig(): DrmProviderConfig {
  const widevineUrl =
    process.env.STORYTIME_WIDEVINE_LICENSE_URL?.trim() ||
    process.env.STORYTIME_DRM_LICENSE_URL?.trim() ||
    null;
  const playreadyUrl =
    process.env.STORYTIME_PLAYREADY_LICENSE_URL?.trim() ||
    process.env.STORYTIME_DRM_LICENSE_URL?.trim() ||
    null;
  const fairplayLicenseUrl =
    process.env.STORYTIME_FAIRPLAY_LICENSE_URL?.trim() ||
    process.env.STORYTIME_DRM_LICENSE_URL?.trim() ||
    null;
  const fairplayCertUrl =
    process.env.STORYTIME_FAIRPLAY_CERTIFICATE_URL?.trim() || null;

  const widevineToken = process.env.STORYTIME_WIDEVINE_AUTH_TOKEN?.trim() || null;
  const playreadyToken = process.env.STORYTIME_PLAYREADY_AUTH_TOKEN?.trim() || null;
  const fairplayToken = process.env.STORYTIME_FAIRPLAY_AUTH_TOKEN?.trim() || null;

  const legacyToken = process.env.STORYTIME_DRM_AUTH_TOKEN?.trim() || null;

  return {
    enabled:
      process.env.CAPTURE_PROTECTION_MODE === "drm" ||
      Boolean(widevineUrl || playreadyUrl || fairplayLicenseUrl),
    widevine: {
      enabled: Boolean(widevineUrl),
      upstreamLicenseUrl: widevineUrl,
      authToken: widevineToken ?? legacyToken,
      customDataHeader:
        process.env.STORYTIME_WIDEVINE_CUSTOM_DATA_HEADER?.trim() || null,
    },
    playready: {
      enabled: Boolean(playreadyUrl),
      upstreamLicenseUrl: playreadyUrl,
      authToken: playreadyToken ?? legacyToken,
      customDataHeader:
        process.env.STORYTIME_PLAYREADY_CUSTOM_DATA_HEADER?.trim() || null,
    },
    fairplay: {
      enabled: Boolean(fairplayLicenseUrl && fairplayCertUrl),
      upstreamLicenseUrl: fairplayLicenseUrl,
      upstreamCertificateUrl: fairplayCertUrl,
      authToken: fairplayToken ?? legacyToken,
      contentIdPrefix:
        process.env.STORYTIME_FAIRPLAY_CONTENT_ID_PREFIX?.trim() || "skd://",
    },
    legacyLicenseUrl:
      process.env.STORYTIME_DRM_LICENSE_URL?.trim() || null,
    legacyAuthToken: legacyToken,
  };
}

/**
 * Build a per-system DRM descriptor scoped to a single content/episode.
 *
 * `contentScope` is included as a custom header so the proxy can authorize
 * the request (entitlement check + watermarking key).
 */
export function buildPlaybackDrmDescriptors(options: {
  baseUrl: string | null;
  contentScope: string;
  sessionId: string;
  container: PlaybackContainerKind;
}): PlaybackDrmDescriptor[] {
  const drm = getDrmProviderConfig();
  if (!drm.enabled) return [];

  const base = (options.baseUrl ?? "").replace(/\/+$/, "");
  const join = (path: string) => (base ? `${base}${path}` : path);

  const sessionHeaders: Record<string, string> = {
    "X-Storytime-Content": options.contentScope,
    "X-Storytime-Session": options.sessionId,
  };

  const descriptors: PlaybackDrmDescriptor[] = [];

  if (drm.fairplay.enabled && options.container === "hls") {
    descriptors.push({
      keySystem: "com.apple.fps",
      licenseUrl: `${join(FAIRPLAY_LICENSE_PATH)}?c=${encodeURIComponent(options.contentScope)}`,
      certificateUrl: `${join(FAIRPLAY_CERTIFICATE_PATH)}?c=${encodeURIComponent(options.contentScope)}`,
      contentIdHint: drm.fairplay.contentIdPrefix,
      licenseRequestHeaders: { ...sessionHeaders, Accept: "application/octet-stream" },
      certificateRequestHeaders: { ...sessionHeaders, Accept: "application/octet-stream" },
      encryptionScheme: "cbcs",
      persistentState: "optional",
    });
  }

  if (drm.widevine.enabled && (options.container === "dash" || options.container === "hls")) {
    descriptors.push({
      keySystem: "com.widevine.alpha",
      licenseUrl: `${join(WIDEVINE_LICENSE_PATH)}?c=${encodeURIComponent(options.contentScope)}`,
      licenseRequestHeaders: { ...sessionHeaders, Accept: "application/octet-stream" },
      videoRobustness: "HW_SECURE_ALL",
      audioRobustness: "HW_SECURE_CRYPTO",
      encryptionScheme: options.container === "hls" ? "cbcs" : "cenc",
      persistentState: "optional",
    });
  }

  if (drm.playready.enabled && options.container === "dash") {
    descriptors.push({
      keySystem: "com.microsoft.playready.recommendation",
      licenseUrl: `${join(PLAYREADY_LICENSE_PATH)}?c=${encodeURIComponent(options.contentScope)}`,
      licenseRequestHeaders: { ...sessionHeaders, "Content-Type": "text/xml; charset=utf-8" },
      videoRobustness: "HW_SECURE_DECODE",
      audioRobustness: "SW_SECURE_DECODE",
      encryptionScheme: "cenc",
      persistentState: "optional",
    });
  }

  return descriptors;
}

/**
 * Resolve the upstream license URL for a given key system. Used by the proxy
 * routes to forward the player's license challenge.
 */
export function resolveUpstreamLicenseTarget(keySystem: DrmKeySystemId): {
  url: string | null;
  authToken: string | null;
  customDataHeader: string | null;
} {
  const drm = getDrmProviderConfig();

  if (
    keySystem === "com.apple.fps" ||
    keySystem === "com.apple.fps.1_0" ||
    keySystem === "com.apple.fps.2_0"
  ) {
    return {
      url: drm.fairplay.upstreamLicenseUrl ?? drm.legacyLicenseUrl,
      authToken: drm.fairplay.authToken,
      customDataHeader: null,
    };
  }

  if (keySystem === "com.widevine.alpha") {
    return {
      url: drm.widevine.upstreamLicenseUrl ?? drm.legacyLicenseUrl,
      authToken: drm.widevine.authToken,
      customDataHeader: drm.widevine.customDataHeader,
    };
  }

  if (
    keySystem === "com.microsoft.playready" ||
    keySystem === "com.microsoft.playready.recommendation"
  ) {
    return {
      url: drm.playready.upstreamLicenseUrl ?? drm.legacyLicenseUrl,
      authToken: drm.playready.authToken,
      customDataHeader: drm.playready.customDataHeader,
    };
  }

  return { url: drm.legacyLicenseUrl, authToken: drm.legacyAuthToken, customDataHeader: null };
}

export function resolveUpstreamFairPlayCertificateUrl(): string | null {
  const drm = getDrmProviderConfig();
  return drm.fairplay.upstreamCertificateUrl;
}
