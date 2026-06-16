/**
 * Unified playback manifest returned by the playback-bundle API.
 *
 * The client picks the first source whose `keySystem` is supported by the
 * device, falling back gracefully (FairPlay on Apple, Widevine on Chrome/
 * Android/Firefox, PlayReady on Microsoft/Xbox, clear HLS otherwise).
 *
 * This shape is intentionally close to MPEG-CMAF/CMAF-CENC industry norms so
 * that the same descriptor works with hls.js, dash.js, shaka-player, AVPlayer
 * (native HLS) and ExoPlayer (when we ship native apps).
 */
export type PlaybackContainerKind =
  | "hls"
  | "dash"
  | "mp4"
  | "webm"
  | "smooth-streaming";

export type DrmKeySystemId =
  | "com.widevine.alpha"
  | "com.microsoft.playready"
  | "com.microsoft.playready.recommendation"
  | "com.apple.fps"
  | "com.apple.fps.1_0"
  | "com.apple.fps.2_0"
  | "org.w3.clearkey";

export type PlaybackMimeType =
  | "application/x-mpegurl"
  | "application/vnd.apple.mpegurl"
  | "application/dash+xml"
  | "video/mp4"
  | "video/webm";

export type DrmRobustness =
  | "HW_SECURE_ALL"
  | "HW_SECURE_DECODE"
  | "HW_SECURE_CRYPTO"
  | "SW_SECURE_DECODE"
  | "SW_SECURE_CRYPTO";

export type PlaybackDrmDescriptor = {
  /** Standardised key system identifier (EME). */
  keySystem: DrmKeySystemId;
  /** Backend-proxied license URL the player must POST license challenges to. */
  licenseUrl: string;
  /** FairPlay-only: backend-proxied URL that serves the application certificate. */
  certificateUrl?: string | null;
  /** FairPlay-only: content-id parser hint (skd:// URL or explicit ID). */
  contentIdHint?: string | null;
  /** Optional HTTP headers the player must add when fetching the license. */
  licenseRequestHeaders?: Record<string, string>;
  /** Optional HTTP headers the player must add when fetching the certificate. */
  certificateRequestHeaders?: Record<string, string>;
  /** Optional EME robustness levels. */
  videoRobustness?: DrmRobustness;
  audioRobustness?: DrmRobustness;
  /** "cenc" (CTR) or "cbcs" (CBC). FairPlay always uses cbcs. */
  encryptionScheme?: "cenc" | "cbcs";
  /** Whether the persistent state is required (CDM session persistence). */
  persistentState?: "required" | "optional" | "not-allowed";
};

export type PlaybackSourceDescriptor = {
  /** Canonical playback URL (HLS manifest, DASH MPD, or progressive MP4). */
  src: string;
  /** MIME type for `<source>` / Vidstack `src.type` selection. */
  type: PlaybackMimeType;
  /** Container family (`hls`, `dash`, `mp4`). */
  container: PlaybackContainerKind;
  /** Optional DRM requirement for this source. */
  drm?: PlaybackDrmDescriptor | null;
  /** Selection priority. Lower number = preferred. */
  priority: number;
  /** Human label for diagnostics / dev tools. */
  label?: string;
  /** Optional CDN origins so the player can warm up TCP/TLS. */
  warmupOrigins?: string[];
};

export type PlaybackSubtitleTrack = {
  id: string;
  language: string;
  label: string;
  src: string;
  /** WEBVTT is universal; SRT will be converted server-side when uploaded. */
  type: "text/vtt" | "text/srt";
  isDefault?: boolean;
  isForced?: boolean;
  /** SDH/CC track flag (closed captions for hearing impaired). */
  closedCaptions?: boolean;
};

export type PlaybackAudioTrack = {
  id: string;
  language: string;
  label: string;
  channels?: number;
  isDefault?: boolean;
};

export type PlaybackThumbnailTrack = {
  /** WebVTT thumbnail track (Cloudflare Stream emits this automatically). */
  src: string;
  type: "text/vtt";
  spriteUrl?: string | null;
};

export type PlaybackAbrHints = {
  /** Initial bitrate (bps) to request — bias low for instant start. */
  startBitrate?: number;
  /** Hard ceiling so cellular devices don't blow data budgets. */
  maxBitrateMobile?: number;
  /** Player buffer length goal (seconds). */
  bufferGoalSeconds?: number;
  /** Maximum seekable buffer ahead (seconds). */
  maxBufferAheadSeconds?: number;
};

export type PlaybackInstantStart = {
  /** Server-recommended preload strategy. */
  preload: "auto" | "metadata" | "none";
  /** Whether the client should prefetch the first segment ahead of playback. */
  warmFirstSegment: boolean;
  /** Optional explicit first-segment URL hint (for warm-up). */
  firstSegmentUrl?: string | null;
  /** Whether the player can autoplay on this device family. */
  autoplayAllowed: boolean;
};

export type PlaybackComplianceMetadata = {
  /** Whether the manifest is served via signed/expiring URLs. */
  signedPlayback: boolean;
  /** Token TTL in seconds (when signed). */
  expiresInSeconds?: number | null;
  /** Issued at (ISO) — useful for client-side refresh scheduling. */
  issuedAt?: string;
  /** Whether playback is concurrent-session enforced. */
  concurrentSessionsEnforced: boolean;
  /** Whether forensic watermark is being injected (overlay / per-session token). */
  watermarkActive: boolean;
  /** Whether the manifest is protected by hardware-backed DRM. */
  hardwareDrm: boolean;
  /** Apple FairPlay readiness flag for App Store / Apple TV approval audits. */
  fairPlayReady: boolean;
};

export type PlaybackSessionDescriptor = {
  /** Opaque session id used for analytics + heartbeat + concurrent-session cap. */
  sessionId: string;
  /** When the client should next refresh the manifest (epoch ms). */
  refreshAt: number | null;
};

export type PlaybackManifest = {
  /** Unified ordered list of playable sources (best-first). */
  sources: PlaybackSourceDescriptor[];
  /** Primary subtitle tracks. */
  subtitles: PlaybackSubtitleTrack[];
  /** Optional alternate audio tracks. */
  audioTracks: PlaybackAudioTrack[];
  /** Thumbnail / sprite track for scrubbing UX. */
  thumbnails?: PlaybackThumbnailTrack | null;
  /** ABR + buffering hints for the player. */
  abr: PlaybackAbrHints;
  /** Instant-start guidance (preload + warm first segment). */
  instantStart: PlaybackInstantStart;
  /** Compliance metadata surfaced to the player and analytics. */
  compliance: PlaybackComplianceMetadata;
  /** Optional session descriptor (heartbeat + manifest refresh). */
  session?: PlaybackSessionDescriptor;
};

/** Order DRM key systems by typical device coverage (FairPlay first on Apple). */
export const DRM_KEY_SYSTEM_PRIORITY: DrmKeySystemId[] = [
  "com.apple.fps",
  "com.apple.fps.1_0",
  "com.apple.fps.2_0",
  "com.widevine.alpha",
  "com.microsoft.playready.recommendation",
  "com.microsoft.playready",
  "org.w3.clearkey",
];

/** Determine whether a container is HLS (Apple FairPlay native). */
export function isHlsContainer(container: PlaybackContainerKind): boolean {
  return container === "hls";
}

/** Determine whether a container is DASH (Widevine / PlayReady CMAF). */
export function isDashContainer(container: PlaybackContainerKind): boolean {
  return container === "dash";
}
