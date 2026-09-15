import { createSign, createPrivateKey, type JsonWebKey } from "node:crypto";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamApiCredentials,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import type { PlaybackSource } from "@/lib/playback-sources";

const DEFAULT_TTL_SECONDS = 4 * 60 * 60;

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeSigningJwk(): JsonWebKey | null {
  const raw = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("{")) return JSON.parse(raw) as JsonWebKey;
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as JsonWebKey;
  } catch {
    return null;
  }
}

function decodeSigningPem(): string | null {
  const raw = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM?.trim();
  if (!raw) return null;
  try {
    if (raw.includes("BEGIN")) return raw;
    return Buffer.from(raw, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function isCloudflareSignedPlaybackEnabled(): boolean {
  const flag = process.env.CLOUDFLARE_STREAM_SIGNED_URLS?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return Boolean(process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim());
}

/** Stream accounts with API credentials should not serve unsigned manifests (redirect-loop). */
export function requiresSignedStreamPlayback(): boolean {
  const flag = process.env.CLOUDFLARE_STREAM_SIGNED_URLS?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  if (process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim()) return true;
  return Boolean(getCloudflareStreamApiCredentials());
}

/** Signed manifests must use videodelivery.net — customer subdomains redirect-loop with JWT tokens. */
function buildSignedHlsUrl(token: string): string {
  return `https://videodelivery.net/${token}/manifest/video.m3u8`;
}

export function signCloudflareStreamTokenLocally(
  videoUid: string,
  options?: { ttlSeconds?: number; downloadable?: boolean },
): string | null {
  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim();
  if (!keyId) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.max(300, options?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const header = { alg: "RS256", kid: keyId };
  const payload: Record<string, unknown> = {
    sub: videoUid,
    kid: keyId,
    exp,
    nbf: now - 30,
  };
  if (options?.downloadable === false) {
    payload.downloadable = false;
  }

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;

  const pem = decodeSigningPem();
  const jwk = decodeSigningJwk();

  try {
    const keyObject = pem
      ? createPrivateKey(pem)
      : jwk
        ? createPrivateKey({ key: jwk, format: "jwk" })
        : null;
    if (!keyObject) return null;

    const signature = createSign("RSA-SHA256").update(signingInput).sign(keyObject);
    return `${signingInput}.${signature.toString("base64url")}`;
  } catch (err) {
    console.error("Cloudflare Stream local signing failed:", err);
    return null;
  }
}

export async function fetchCloudflareStreamTokenFromApi(
  videoUid: string,
  options?: { ttlSeconds?: number; downloadable?: boolean },
): Promise<string | null> {
  const api = getCloudflareStreamApiCredentials();
  if (!api) return null;

  try {
    const exp = Math.floor(Date.now() / 1000) + Math.max(300, options?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
    const body: Record<string, unknown> = { exp };
    if (options?.downloadable === false) body.downloadable = false;

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${api.accountId}/stream/${videoUid}/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${api.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const payload = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      result?: { token?: string };
      errors?: Array<{ message?: string }>;
    };

    if (!res.ok || !payload.success || !payload.result?.token) {
      const msg = payload.errors?.map((e) => e.message).filter(Boolean).join("; ");
      console.error("Cloudflare Stream token API failed:", msg || res.status);
      return null;
    }

    return payload.result.token;
  } catch (err) {
    console.error("Cloudflare Stream token API request failed:", err);
    return null;
  }
}

type CachedSignedPlayback = {
  src: string;
  expiresAtMs: number;
};

/** Reuse signed HLS URLs across playback-bundle + hls-manifest on the same isolate. */
const signedPlaybackCache = new Map<string, CachedSignedPlayback>();
const SIGNED_CACHE_SKEW_MS = 5 * 60 * 1000;

function getCachedSignedPlayback(uid: string): PlaybackSource | null {
  const hit = signedPlaybackCache.get(uid);
  if (!hit) return null;
  if (hit.expiresAtMs - SIGNED_CACHE_SKEW_MS <= Date.now()) {
    signedPlaybackCache.delete(uid);
    return null;
  }
  return { src: hit.src, type: "application/x-mpegurl" };
}

function putCachedSignedPlayback(uid: string, src: string, ttlSeconds: number) {
  signedPlaybackCache.set(uid, {
    src,
    expiresAtMs: Date.now() + Math.max(300, ttlSeconds) * 1000,
  });
  // Bound memory on long-lived Node isolates.
  if (signedPlaybackCache.size > 500) {
    const first = signedPlaybackCache.keys().next().value;
    if (first) signedPlaybackCache.delete(first);
  }
}

export async function buildSignedCloudflarePlaybackSource(
  videoUrl: string | null | undefined,
  options?: { ttlSeconds?: number },
): Promise<PlaybackSource | null> {
  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (!uid) return null;

  const cached = getCachedSignedPlayback(uid);
  if (cached) return cached;

  const hasLocalSigning = Boolean(process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim());
  const api = getCloudflareStreamApiCredentials();
  if (!hasLocalSigning && !api) return null;

  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const signOpts = { ttlSeconds, downloadable: false as const };
  const token =
    (hasLocalSigning ? signCloudflareStreamTokenLocally(uid, signOpts) : null) ??
    (api ? await fetchCloudflareStreamTokenFromApi(uid, signOpts) : null);

  if (!token) return null;

  const src = buildSignedHlsUrl(token);
  putCachedSignedPlayback(uid, src, ttlSeconds);
  return {
    src,
    type: "application/x-mpegurl",
  };
}

function deriveSubdomainFromStreamUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/cloudflarestream\.com/i.test(u.hostname)) {
      return `https://${u.hostname}`;
    }
  } catch {
    // ignore
  }
  return "https://videodelivery.net";
}

/** Unsigned fallback reference URLs (admin/debug). */
export function buildUnsignedCloudflarePlaybackSource(videoUrl: string | null | undefined): PlaybackSource | null {
  const url = videoUrl?.trim();
  if (!url) return null;
  const uid = extractCloudflareStreamUid(url);
  if (!uid) return null;
  const cfg = getCloudflareStreamConfig();
  const subdomain =
    cfg?.customerSubdomain ??
    (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "https://videodelivery.net");
  const urls = buildCloudflarePlaybackUrls(uid, subdomain);
  return { src: urls.hlsUrl, type: "application/x-mpegurl" };
}
