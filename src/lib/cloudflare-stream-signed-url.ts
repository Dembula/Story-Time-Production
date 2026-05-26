import { createSign, createPrivateKey, type JsonWebKey } from "node:crypto";
import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
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
  return process.env.CLOUDFLARE_STREAM_SIGNED_URLS === "true";
}

function buildSignedHlsUrl(token: string, customerSubdomain?: string): string {
  const base = customerSubdomain?.replace(/\/+$/, "") || "https://videodelivery.net";
  return `${base}/${token}/manifest/video.m3u8`;
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
  const cfg = getCloudflareStreamConfig();
  if (!cfg) return null;

  const exp = Math.floor(Date.now() / 1000) + Math.max(300, options?.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const body: Record<string, unknown> = { exp };
  if (options?.downloadable === false) body.downloadable = false;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream/${videoUid}/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
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
}

export async function buildSignedCloudflarePlaybackSource(
  videoUrl: string | null | undefined,
  options?: { ttlSeconds?: number },
): Promise<PlaybackSource | null> {
  if (!isCloudflareSignedPlaybackEnabled()) return null;

  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (!uid) return null;

  const cfg = getCloudflareStreamConfig();
  const subdomain =
    cfg?.customerSubdomain ??
    (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "https://videodelivery.net");

  const token =
    signCloudflareStreamTokenLocally(uid, { ttlSeconds: options?.ttlSeconds, downloadable: false }) ??
    (await fetchCloudflareStreamTokenFromApi(uid, { ttlSeconds: options?.ttlSeconds, downloadable: false }));

  if (!token) return null;

  return {
    src: buildSignedHlsUrl(token, subdomain),
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
