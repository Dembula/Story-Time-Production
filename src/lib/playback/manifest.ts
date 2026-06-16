import { randomBytes, randomUUID } from "node:crypto";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import {
  buildSignedCloudflarePlaybackSource,
  isCloudflareSignedPlaybackEnabled,
} from "@/lib/cloudflare-stream-signed-url";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";
import {
  buildPlaybackDrmDescriptors,
  getDrmProviderConfig,
} from "@/lib/playback/drm-config";
import type {
  PlaybackAudioTrack,
  PlaybackContainerKind,
  PlaybackManifest,
  PlaybackMimeType,
  PlaybackSourceDescriptor,
  PlaybackSubtitleTrack,
  PlaybackThumbnailTrack,
} from "@/lib/playback/manifest-types";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

function safeOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function pushUnique(into: string[], value: string | null): void {
  if (!value) return;
  if (into.includes(value)) return;
  into.push(value);
}

function makeSessionId(): string {
  try {
    return `pbk_${randomUUID().replace(/-/g, "")}`;
  } catch {
    return `pbk_${randomBytes(16).toString("hex")}`;
  }
}

export type BuildPlaybackManifestInput = {
  /** Public-facing absolute origin (used to namespace proxied DRM URLs). */
  baseUrl: string | null;
  /** Stable scope id (content id or `content:episode`). */
  contentScope: string;
  /** Stored video URL (may be S3, Cloudflare Stream, or another HLS host). */
  videoUrl: string | null | undefined;
  /** Subtitle tracks attached to the content. */
  subtitles?: Array<{
    id: string;
    language: string;
    label: string | null;
    vttUrl: string;
    isDefault?: boolean | null;
  }>;
  /** Audio tracks (optional — not all titles have alternates). */
  audioTracks?: PlaybackAudioTrack[];
  /** Watermark active toggle (forensic overlay). */
  watermarkActive?: boolean;
  /** Whether playback concurrent sessions are enforced (Netflix-style). */
  concurrentSessionsEnforced?: boolean;
  /** Device family hint for ABR + autoplay defaults (server cannot read UA reliably; default broad). */
  deviceFamilyHint?: "ios" | "android" | "desktop" | "tv" | "unknown";
};

const DEFAULT_ABR = {
  startBitrate: 1_200_000,
  maxBitrateMobile: 4_000_000,
  bufferGoalSeconds: 30,
  maxBufferAheadSeconds: 90,
};

export async function buildPlaybackManifest(
  input: BuildPlaybackManifestInput,
): Promise<PlaybackManifest> {
  const sources: PlaybackSourceDescriptor[] = [];
  const warmupOrigins: string[] = [];
  const drmConfig = getDrmProviderConfig();
  const sessionId = makeSessionId();
  const signedPlayback = isCloudflareSignedPlaybackEnabled();
  const issuedAt = new Date().toISOString();

  let firstSegmentHint: string | null = null;
  let manifestUid: string | null = null;
  let hasStreamSource = false;

  const rawUrl = input.videoUrl?.trim() ?? "";

  // 1) Cloudflare Stream — preferred path. Generates HLS (+ FairPlay-ready)
  //    and DASH (Widevine/PlayReady CMAF). Both are fetched via signed URLs
  //    when CLOUDFLARE_STREAM_SIGNED_URLS is enabled.
  let resolvedUid = extractCloudflareStreamUid(rawUrl);
  if (!resolvedUid && rawUrl) {
    const asset = await findStreamAssetBySourceUrl(rawUrl);
    if (isReadyStreamState(asset?.status) && asset?.uid) {
      resolvedUid = asset.uid;
    }
  }

  if (resolvedUid) {
    manifestUid = resolvedUid;
    hasStreamSource = true;
    const cfg = getCloudflareStreamConfig();
    const subdomain = cfg?.customerSubdomain ?? "https://videodelivery.net";
    const urls = buildCloudflarePlaybackUrls(resolvedUid, subdomain);

    // Try to produce a signed HLS URL when configured.
    let hlsUrl = urls.hlsUrl;
    if (signedPlayback) {
      const signed = await buildSignedCloudflarePlaybackSource(
        `https://videodelivery.net/${resolvedUid}/manifest/video.m3u8`,
      );
      if (signed?.src) hlsUrl = signed.src;
    }
    const dashUrl = signedPlayback
      ? hlsUrl.replace(/\/manifest\/video\.m3u8(\?|$)/, "/manifest/video.mpd$1")
      : urls.dashUrl;

    // 1a) HLS — FairPlay & native Apple. Highest priority on Apple devices.
    sources.push({
      src: hlsUrl,
      type: "application/x-mpegurl",
      container: "hls",
      priority: 10,
      label: "Cloudflare Stream HLS (CMAF)",
      drm: buildPlaybackDrmDescriptors({
        baseUrl: input.baseUrl,
        contentScope: input.contentScope,
        sessionId,
        container: "hls",
      }).find((d) => d.keySystem.startsWith("com.apple.fps")) ?? null,
    });

    // 1b) DASH — Widevine / PlayReady. Higher priority on non-Apple devices.
    sources.push({
      src: dashUrl,
      type: "application/dash+xml",
      container: "dash",
      priority: 15,
      label: "Cloudflare Stream DASH (CMAF)",
      drm:
        buildPlaybackDrmDescriptors({
          baseUrl: input.baseUrl,
          contentScope: input.contentScope,
          sessionId,
          container: "dash",
        }).find((d) => d.keySystem === "com.widevine.alpha") ??
        buildPlaybackDrmDescriptors({
          baseUrl: input.baseUrl,
          contentScope: input.contentScope,
          sessionId,
          container: "dash",
        }).find((d) => d.keySystem.startsWith("com.microsoft.playready")) ??
        null,
    });

    // 1c) Progressive MP4 fallback for legacy browsers (no DRM).
    if (!drmConfig.enabled) {
      sources.push({
        src: urls.mp4Url,
        type: "video/mp4",
        container: "mp4",
        priority: 90,
        label: "Cloudflare Stream MP4 download",
      });
    }

    pushUnique(warmupOrigins, safeOrigin(hlsUrl));
    pushUnique(warmupOrigins, safeOrigin(dashUrl));
    firstSegmentHint = signedPlayback
      ? null
      : `https://videodelivery.net/${resolvedUid}/manifest/video.m3u8?one=1`;
  }

  // 2) External HLS (e.g. third-party CDN). Preserve as-is when the stored
  //    URL is already a manifest.
  if (!hasStreamSource && /\.m3u8(\?|$)/i.test(rawUrl)) {
    sources.push({
      src: rawUrl,
      type: "application/x-mpegurl",
      container: "hls",
      priority: 20,
      label: "External HLS manifest",
    });
    pushUnique(warmupOrigins, safeOrigin(rawUrl));
  }

  // 3) External DASH.
  if (!hasStreamSource && /\.mpd(\?|$)/i.test(rawUrl)) {
    sources.push({
      src: rawUrl,
      type: "application/dash+xml",
      container: "dash",
      priority: 25,
      label: "External DASH manifest",
    });
    pushUnique(warmupOrigins, safeOrigin(rawUrl));
  }

  // 4) Progressive MP4 fallback (S3 / external host) — last resort, only
  //    when no DRM is configured (clear playback path).
  if (!hasStreamSource && rawUrl && !drmConfig.enabled) {
    const isPlainVideo =
      /\.(mp4|m4v|webm|mov|mpeg)(\?|$)/i.test(rawUrl) ||
      (!/\.m3u8|\.mpd/i.test(rawUrl) && !isCloudflareStreamUrl(rawUrl));
    if (isPlainVideo) {
      sources.push({
        src: rawUrl,
        type: rawUrl.includes(".webm") ? "video/webm" : "video/mp4",
        container: rawUrl.includes(".webm") ? "webm" : "mp4",
        priority: 100,
        label: "Progressive fallback",
      });
      pushUnique(warmupOrigins, safeOrigin(rawUrl));
    }
  }

  // Attach warmup origins to every source.
  for (const src of sources) {
    src.warmupOrigins = warmupOrigins.slice();
  }

  // Sort by priority (lowest first = preferred).
  sources.sort((a, b) => a.priority - b.priority);

  const subtitles: PlaybackSubtitleTrack[] = (input.subtitles ?? [])
    .filter((row) => row?.vttUrl)
    .map((row) => ({
      id: row.id,
      language: row.language,
      label: row.label || row.language?.toUpperCase() || "Subtitles",
      src: row.vttUrl,
      type: "text/vtt",
      isDefault: Boolean(row.isDefault),
    }));

  const thumbnails: PlaybackThumbnailTrack | null = manifestUid
    ? {
        src: `https://videodelivery.net/${manifestUid}/thumbnails/storyboard.vtt`,
        type: "text/vtt",
        spriteUrl: `https://videodelivery.net/${manifestUid}/thumbnails/storyboard.jpg`,
      }
    : null;

  const compliance = {
    signedPlayback,
    expiresInSeconds: signedPlayback ? 4 * 60 * 60 : null,
    issuedAt,
    concurrentSessionsEnforced: Boolean(input.concurrentSessionsEnforced),
    watermarkActive: Boolean(input.watermarkActive),
    hardwareDrm: drmConfig.enabled,
    fairPlayReady: drmConfig.fairplay.enabled,
  };

  return {
    sources,
    subtitles,
    audioTracks: input.audioTracks ?? [],
    thumbnails,
    abr: { ...DEFAULT_ABR },
    instantStart: {
      preload: "auto",
      warmFirstSegment: hasStreamSource,
      firstSegmentUrl: firstSegmentHint,
      autoplayAllowed:
        input.deviceFamilyHint === "desktop" || input.deviceFamilyHint === "tv",
    },
    compliance,
    session: signedPlayback
      ? {
          sessionId,
          refreshAt: Date.now() + (compliance.expiresInSeconds ?? 0) * 1000 - 60_000,
        }
      : { sessionId, refreshAt: null },
  };
}

/** Convenience helper — pick the first preferred MIME type. */
export function pickPrimarySourceType(
  manifest: PlaybackManifest,
): PlaybackMimeType | null {
  return manifest.sources[0]?.type ?? null;
}

/** Convenience helper — pick the first preferred container. */
export function pickPrimaryContainer(
  manifest: PlaybackManifest,
): PlaybackContainerKind | null {
  return manifest.sources[0]?.container ?? null;
}
