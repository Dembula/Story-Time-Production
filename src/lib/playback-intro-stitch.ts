import { readFile } from "node:fs/promises";
import path from "node:path";
import { PLATFORM_INTRO } from "@/lib/platform-intro";

const INTRO_TS_PLAYLIST_PATH = path.join(process.cwd(), "public", "branding", "intro", "index.m3u8");
const INTRO_FMP4_VIDEO_PATH = path.join(process.cwd(), "public", "branding", "intro", "fmp4", "video.m3u8");
const INTRO_FMP4_AUDIO_PATH = path.join(process.cwd(), "public", "branding", "intro", "fmp4", "audio.m3u8");

export const PLATFORM_INTRO_HLS_PUBLIC_PREFIX = "/branding/intro";
export const PLATFORM_INTRO_FMP4_PUBLIC_PREFIX = "/branding/intro/fmp4";

let cachedIntroTsBody: string | null = null;
let cachedIntroFmp4VideoBody: string | null = null;
let cachedIntroFmp4AudioBody: string | null = null;

/** Sum of #EXTINF durations in a media playlist. */
export function measureIntroPlaylistDurationSeconds(introPlaylist: string): number {
  let total = 0;
  for (const line of introPlaylist.split("\n")) {
    const match = line.trim().match(/^#EXTINF:([\d.]+)/i);
    if (match) total += Number(match[1]) || 0;
  }
  return total > 0 ? total : PLATFORM_INTRO.durationSeconds;
}

function parseTargetDuration(body: string): number {
  const match = body.match(/#EXT-X-TARGETDURATION:(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function parseVersion(body: string): number {
  const match = body.match(/#EXT-X-VERSION:(\d+)/i);
  return match ? Number(match[1]) : 3;
}

function absolutizePlaylist(raw: string, publicPrefix: string): string {
  return raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#EXT-X-MAP:")) {
        return line.replace(/URI=("|'|)([^"'\s,]+)\1/i, (_m, _q, uri: string) => {
          if (/^https?:\/\//i.test(uri) || uri.startsWith("/")) return `URI="${uri}"`;
          return `URI="${publicPrefix}/${uri.replace(/^\.\//, "")}"`;
        });
      }
      if (trimmed.startsWith("#")) return line;
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return line;
      return `${publicPrefix}/${trimmed.replace(/^\.\//, "")}`;
    })
    .join("\n");
}

/** Legacy MPEG-TS bumper playlist (non-Stream muxed sources). */
export async function loadPlatformIntroMediaPlaylist(): Promise<string> {
  if (cachedIntroTsBody) return cachedIntroTsBody;
  const raw = await readFile(INTRO_TS_PLAYLIST_PATH, "utf8");
  cachedIntroTsBody = absolutizePlaylist(raw, PLATFORM_INTRO_HLS_PUBLIC_PREFIX);
  return cachedIntroTsBody;
}

export async function loadPlatformIntroFmp4VideoPlaylist(): Promise<string> {
  if (cachedIntroFmp4VideoBody) return cachedIntroFmp4VideoBody;
  const raw = await readFile(INTRO_FMP4_VIDEO_PATH, "utf8");
  cachedIntroFmp4VideoBody = absolutizePlaylist(raw, PLATFORM_INTRO_FMP4_PUBLIC_PREFIX);
  return cachedIntroFmp4VideoBody;
}

export async function loadPlatformIntroFmp4AudioPlaylist(): Promise<string> {
  if (cachedIntroFmp4AudioBody) return cachedIntroFmp4AudioBody;
  const raw = await readFile(INTRO_FMP4_AUDIO_PATH, "utf8");
  cachedIntroFmp4AudioBody = absolutizePlaylist(raw, PLATFORM_INTRO_FMP4_PUBLIC_PREFIX);
  return cachedIntroFmp4AudioBody;
}

/** Make intro segment URIs origin-absolute so native apps resolve them reliably. */
export function withPublicOrigin(playlist: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  if (!base) return playlist;
  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#EXT-X-MAP:")) {
        return line.replace(/URI=("|'|)(\/branding\/[^"'\s,]+)\1/i, (_m, _q, uri: string) => {
          return `URI="${base}${uri}"`;
        });
      }
      if (trimmed.startsWith("#")) return line;
      if (trimmed.startsWith("/branding/")) return `${base}${trimmed}`;
      return line;
    })
    .join("\n");
}

/** Extract MAP + media segment lines (and accompanying tags) for stitching. */
export function extractMediaBodyLines(playlist: string): {
  bodyLines: string[];
  targetDuration: number;
  version: number;
} {
  const targetDuration = parseTargetDuration(playlist) || PLATFORM_INTRO.durationSeconds;
  const version = parseVersion(playlist);
  const bodyLines: string[] = [];
  const lines = playlist.split("\n");
  let sawMapOrInf = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed === "#EXTM3U") continue;
    if (trimmed.startsWith("#EXT-X-VERSION:")) continue;
    if (trimmed.startsWith("#EXT-X-TARGETDURATION:")) continue;
    if (trimmed.startsWith("#EXT-X-MEDIA-SEQUENCE:")) continue;
    if (trimmed.startsWith("#EXT-X-DISCONTINUITY-SEQUENCE:")) continue;
    if (trimmed.startsWith("#EXT-X-PLAYLIST-TYPE:")) continue;
    if (trimmed.startsWith("#EXT-X-INDEPENDENT-SEGMENTS")) continue;
    if (trimmed.startsWith("#EXT-X-PROGRAM-DATE-TIME")) continue;
    if (trimmed === "#EXT-X-ENDLIST") continue;
    if (trimmed.startsWith("#EXT-X-MAP:") || trimmed.startsWith("#EXTINF") || trimmed.startsWith("#EXT-X-KEY:")) {
      sawMapOrInf = true;
    }
    if (!sawMapOrInf && trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("#EXTINF")) {
      bodyLines.push(lines[i]);
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#") && next.trim()) {
        bodyLines.push(next);
        i += 1;
      }
      continue;
    }
    bodyLines.push(lines[i]);
  }
  return { bodyLines, targetDuration, version };
}

/**
 * Prepend bumper to a media playlist (MPEG-TS or fMP4).
 * For fMP4, each side keeps its own #EXT-X-MAP after #EXT-X-DISCONTINUITY.
 */
export function stitchIntroIntoMediaPlaylist(introPlaylist: string, featurePlaylist: string): string {
  const intro = extractMediaBodyLines(introPlaylist);
  const feature = extractMediaBodyLines(featurePlaylist);
  const targetDuration = Math.max(intro.targetDuration, feature.targetDuration, 1);
  const version = Math.max(intro.version, feature.version, 6);

  return [
    "#EXTM3U",
    `#EXT-X-VERSION:${version}`,
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-DISCONTINUITY-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-INDEPENDENT-SEGMENTS",
    ...intro.bodyLines,
    "#EXT-X-DISCONTINUITY",
    ...feature.bodyLines,
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
}

export function playlistIsMaster(body: string): boolean {
  return /#EXT-X-STREAM-INF/i.test(body);
}

export function masterHasDemuxedAudio(body: string): boolean {
  return /#EXT-X-MEDIA\s*:[^\n]*TYPE=AUDIO/i.test(body);
}

export function playlistUsesFragmentedMp4(body: string): boolean {
  return /#EXT-X-MAP:/i.test(body);
}

export function encodeVariantRef(absoluteUrl: string): string {
  return Buffer.from(absoluteUrl, "utf8").toString("base64url");
}

export function decodeVariantRef(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const url = new URL(decoded);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isAllowedHlsVariantUpstream(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("videodelivery.net") ||
      host.endsWith("cloudflarestream.com") ||
      host.endsWith("cloudflare.com")
    );
  } catch {
    return false;
  }
}

/**
 * Rewrite master so video variants + demuxed AUDIO media URIs hit our stitch proxy.
 * Apps that only play playback.src get bumper → feature with matching fMP4 A/V.
 */
export function rewriteMasterPlaylistForIntroStitch(
  masterBody: string,
  options: {
    buildVariantProxyUrl: (absoluteVariantUrl: string) => string;
    buildAudioProxyUrl: (absoluteAudioUrl: string) => string;
  },
): string {
  const lines = masterBody.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("#EXT-X-MEDIA:") && /TYPE=AUDIO/i.test(trimmed)) {
      out.push(
        trimmed.replace(/URI=("|'|)([^"'\s,]+)\1/i, (_m, _q, uri: string) => {
          const absolute = /^https?:\/\//i.test(uri) ? uri : uri;
          if (!/^https?:\/\//i.test(absolute)) return `URI="${uri}"`;
          return `URI="${options.buildAudioProxyUrl(absolute)}"`;
        }),
      );
      continue;
    }

    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      out.push(lines[i]);
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#") && next.trim()) {
        const absolute = next.trim();
        out.push(/^https?:\/\//i.test(absolute) ? options.buildVariantProxyUrl(absolute) : absolute);
        i += 1;
      }
      continue;
    }

    if (trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#")) i += 1;
      continue;
    }

    out.push(lines[i]);
  }
  return out.join("\n");
}
