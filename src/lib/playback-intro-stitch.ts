import { readFile } from "node:fs/promises";
import path from "node:path";
import { PLATFORM_INTRO } from "@/lib/platform-intro";

const INTRO_PLAYLIST_PATH = path.join(process.cwd(), "public", "branding", "intro", "index.m3u8");

/** Public path prefix for intro .ts segments (path-absolute — safe from any same-origin manifest). */
export const PLATFORM_INTRO_HLS_PUBLIC_PREFIX = "/branding/intro";

let cachedIntroMediaBody: string | null = null;

function parseTargetDuration(body: string): number {
  const match = body.match(/#EXT-X-TARGETDURATION:(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function parseVersion(body: string): number {
  const match = body.match(/#EXT-X-VERSION:(\d+)/i);
  return match ? Number(match[1]) : 3;
}

/** Load platform bumper media playlist with site-root-absolute segment URIs. */
export async function loadPlatformIntroMediaPlaylist(): Promise<string> {
  if (cachedIntroMediaBody) return cachedIntroMediaBody;
  const raw = await readFile(INTRO_PLAYLIST_PATH, "utf8");
  cachedIntroMediaBody = raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return line;
      return `${PLATFORM_INTRO_HLS_PUBLIC_PREFIX}/${trimmed.replace(/^\.\//, "")}`;
    })
    .join("\n");
  return cachedIntroMediaBody;
}

export function extractIntroSegmentBlock(introPlaylist: string): {
  segmentLines: string[];
  targetDuration: number;
  version: number;
} {
  const targetDuration = parseTargetDuration(introPlaylist) || PLATFORM_INTRO.durationSeconds;
  const version = parseVersion(introPlaylist);
  const lines = introPlaylist.split("\n");
  const segmentLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#EXTINF")) {
      segmentLines.push(lines[i]);
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#")) {
        segmentLines.push(next);
        i += 1;
      }
    }
  }
  return { segmentLines, targetDuration, version };
}

/**
 * Prepend the platform bumper to a media (non-master) playlist.
 * Uses #EXT-X-DISCONTINUITY between bumper and feature.
 */
export function stitchIntroIntoMediaPlaylist(introPlaylist: string, featurePlaylist: string): string {
  const intro = extractIntroSegmentBlock(introPlaylist);
  const featureTarget = parseTargetDuration(featurePlaylist);
  const featureVersion = parseVersion(featurePlaylist);
  const targetDuration = Math.max(intro.targetDuration, featureTarget, 1);
  const version = Math.max(intro.version, featureVersion, 3);

  const featureLines = featurePlaylist.split("\n");
  const featureBody: string[] = [];
  let sawMedia = false;
  for (const line of featureLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === "#EXTM3U") continue;
    if (trimmed.startsWith("#EXT-X-VERSION:")) continue;
    if (trimmed.startsWith("#EXT-X-TARGETDURATION:")) continue;
    if (trimmed.startsWith("#EXT-X-MEDIA-SEQUENCE:")) continue;
    if (trimmed.startsWith("#EXT-X-PLAYLIST-TYPE:")) continue;
    if (trimmed === "#EXT-X-ENDLIST") continue;
    if (
      !sawMedia &&
      (trimmed.startsWith("#EXT-X-INDEPENDENT-SEGMENTS") ||
        trimmed.startsWith("#EXT-X-MAP:") ||
        trimmed.startsWith("#EXT-X-KEY:"))
    ) {
      featureBody.push(line);
      continue;
    }
    if (trimmed.startsWith("#EXTINF")) sawMedia = true;
    if (sawMedia || trimmed.startsWith("#EXT-X-")) {
      featureBody.push(line);
    }
  }

  return [
    "#EXTM3U",
    `#EXT-X-VERSION:${version}`,
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    ...intro.segmentLines,
    "#EXT-X-DISCONTINUITY",
    ...featureBody,
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
}

export function playlistIsMaster(body: string): boolean {
  return /#EXT-X-STREAM-INF/i.test(body);
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

/** Only allow Stream / delivery hosts (prevent SSRF via variant=). */
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
 * Rewrite a master playlist so each variant URI hits our stitch proxy
 * (`variant=` carries the absolute upstream media playlist URL).
 */
export function rewriteMasterPlaylistForIntroStitch(
  masterBody: string,
  buildVariantProxyUrl: (absoluteVariantUrl: string) => string,
): string {
  const lines = masterBody.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      out.push(lines[i]);
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#") && next.trim()) {
        const absolute = next.trim();
        out.push(/^https?:\/\//i.test(absolute) ? buildVariantProxyUrl(absolute) : absolute);
        i += 1;
      }
      continue;
    }
    // Skip iframe playlists — they would bypass the bumper.
    if (trimmed.startsWith("#EXT-X-I-FRAME-STREAM-INF")) {
      const next = lines[i + 1];
      if (next && !next.trim().startsWith("#")) i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join("\n");
}
