import { buildSignedCloudflarePlaybackSource } from "@/lib/cloudflare-stream-signed-url";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";
import type { PlaybackSource } from "@/lib/playback-sources";
import { resolvePlaybackSources } from "@/lib/playback-sources";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);
const SIGNED_TOKEN_RE = /\/([A-Za-z0-9._-]{20,})\/manifest\/video\.m3u8/;

export type PlaybackSourceBundle = {
  /** Primary source picked for current device fallback (HLS preferred). */
  primary: PlaybackSource;
  /** All available delivery formats; clients pick the best supported on their platform. */
  formats: {
    hls?: PlaybackSource;
    dash?: PlaybackSource;
    mp4?: PlaybackSource;
  };
  /** Cloudflare Stream UID when applicable — useful for DRM URL builders + thumbnails. */
  streamUid: string | null;
  /** True when the manifest URL embeds a signed playback token (cleartext access blocked). */
  signed: boolean;
  /** Thumbnail / sprite preview for hover scrubbing. */
  previews: {
    posterUrl: string | null;
    spriteUrl: string | null;
    storyboardUrl: string | null;
  };
};

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

function detectSigned(url: string): boolean {
  // Cloudflare signed HLS path: https://customer-X.cloudflarestream.com/<JWT>/manifest/video.m3u8
  const m = SIGNED_TOKEN_RE.exec(url);
  if (!m) return false;
  const token = m[1];
  // Bare UIDs are 32 chars hex; signed JWTs contain dots.
  return token.includes(".");
}

function buildDashUrlFromHls(hlsUrl: string): string | null {
  // Cloudflare Stream: same path tail, .mpd instead of .m3u8.
  if (/\/manifest\/video\.m3u8($|\?)/.test(hlsUrl)) {
    return hlsUrl.replace(/\/manifest\/video\.m3u8/, "/manifest/video.mpd");
  }
  return null;
}

function buildPreviews(uid: string | null): PlaybackSourceBundle["previews"] {
  if (!uid) return { posterUrl: null, spriteUrl: null, storyboardUrl: null };
  return {
    posterUrl: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=15s&height=720`,
    spriteUrl: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=15s&height=120`,
    storyboardUrl: `https://videodelivery.net/${uid}/manifest/spritesheet.vtt`,
  };
}

/** Resolve a stored video URL into a full multi-format playback bundle (server-only). */
export async function resolvePlaybackBundle(
  videoUrl: string | null | undefined,
): Promise<PlaybackSourceBundle | null> {
  const url = videoUrl?.trim();
  if (!url) return null;

  const signedDirect = await buildSignedCloudflarePlaybackSource(url);
  if (signedDirect) {
    const uid = extractCloudflareStreamUid(url);
    const dashUrl = buildDashUrlFromHls(signedDirect.src);
    return {
      primary: signedDirect,
      formats: {
        hls: signedDirect,
        dash: dashUrl ? { src: dashUrl, type: "application/dash+xml" } : undefined,
      },
      streamUid: uid,
      signed: detectSigned(signedDirect.src),
      previews: buildPreviews(uid),
    };
  }

  if (!isCloudflareStreamUrl(url)) {
    const asset = await findStreamAssetBySourceUrl(url);
    const streamUrl = isReadyStreamState(asset?.status)
      ? asset?.hlsUrl ?? asset?.playbackUrl
      : null;
    if (streamUrl) {
      const signedAsset = await buildSignedCloudflarePlaybackSource(streamUrl);
      if (signedAsset) {
        const uid = extractCloudflareStreamUid(streamUrl);
        const dashUrl = buildDashUrlFromHls(signedAsset.src);
        return {
          primary: signedAsset,
          formats: {
            hls: signedAsset,
            dash: dashUrl ? { src: dashUrl, type: "application/dash+xml" } : undefined,
          },
          streamUid: uid,
          signed: detectSigned(signedAsset.src),
          previews: buildPreviews(uid),
        };
      }
      return buildBundleFromUnsigned(streamUrl);
    }
  }

  return buildBundleFromUnsigned(url);
}

function buildBundleFromUnsigned(url: string): PlaybackSourceBundle | null {
  const source = resolvePlaybackSources(url);
  if (!source) return null;
  const uid = extractCloudflareStreamUid(url);
  const cfg = getCloudflareStreamConfig();

  if (uid) {
    const subdomain = cfg?.customerSubdomain ?? "https://videodelivery.net";
    const urls = buildCloudflarePlaybackUrls(uid, subdomain);
    return {
      primary: source,
      formats: {
        hls: { src: urls.hlsUrl, type: "application/x-mpegurl" },
        dash: { src: urls.dashUrl, type: "application/dash+xml" },
        mp4: { src: urls.mp4Url, type: "video/mp4" },
      },
      streamUid: uid,
      signed: false,
      previews: buildPreviews(uid),
    };
  }

  const formats: PlaybackSourceBundle["formats"] = {};
  if (source.type === "application/x-mpegurl") formats.hls = source;
  if (source.type === "video/mp4") formats.mp4 = source;
  return {
    primary: source,
    formats,
    streamUid: null,
    signed: false,
    previews: { posterUrl: null, spriteUrl: null, storyboardUrl: null },
  };
}
