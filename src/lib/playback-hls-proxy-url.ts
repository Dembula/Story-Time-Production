import {
  decodeVariantRef,
  encodeVariantRef,
  isAllowedHlsVariantUpstream,
} from "@/lib/playback-intro-stitch";

/**
 * Encode a signed Cloudflare HLS URL into the same-origin proxy query so
 * `/hls-manifest` can skip a second DB resolve + Stream re-sign on first play.
 */
export function encodeUpstreamPlaybackRef(absoluteUrl: string): string {
  return encodeVariantRef(absoluteUrl);
}

export function decodeUpstreamPlaybackRef(value: string | null | undefined): string | null {
  const decoded = value?.trim() ? decodeVariantRef(value.trim()) : null;
  if (!decoded || !isAllowedHlsVariantUpstream(decoded)) return null;
  if (!/\.m3u8(\?|$)/i.test(decoded) && !/\/manifest\/video\.m3u8/i.test(decoded)) {
    return null;
  }
  return decoded;
}

export function buildHlsManifestProxyUrl(
  contentId: string,
  options?: {
    episodeId?: string | null;
    trailer?: boolean;
    /** Signed videodelivery/cloudflarestream master URL from playback-bundle. */
    upstreamSrc?: string | null;
    /** Opt out of platform bumper stitch (faster first frame). */
    intro?: boolean;
  },
): string {
  const params = new URLSearchParams();
  if (options?.episodeId) params.set("episodeId", options.episodeId);
  if (options?.trailer) params.set("trailer", "1");
  if (options?.intro === false) params.set("intro", "0");
  if (options?.upstreamSrc && isAllowedHlsVariantUpstream(options.upstreamSrc)) {
    params.set("u", encodeUpstreamPlaybackRef(options.upstreamSrc));
  }
  const qs = params.toString();
  return `/api/content/${contentId}/hls-manifest${qs ? `?${qs}` : ""}`;
}
