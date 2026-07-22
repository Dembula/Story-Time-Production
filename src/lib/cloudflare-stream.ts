import { buildStreamIngestMeta } from "@/lib/stream-ingest-meta";

type CloudflareStreamConfig = {
  accountId: string;
  apiToken: string;
  customerSubdomain: string;
};

type CloudflareCopyResult = {
  uid: string;
  status?: {
    state?: string;
  };
};

function normalizeSubdomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "");
  }
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export function getCloudflareStreamApiCredentials(): { accountId: string; apiToken: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ?? "";
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

export function getCloudflareStreamConfig(): CloudflareStreamConfig | null {
  const api = getCloudflareStreamApiCredentials();
  const customerSubdomainRaw = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ?? "";
  if (!api || !customerSubdomainRaw) return null;
  const customerSubdomain = normalizeSubdomain(customerSubdomainRaw);
  if (!customerSubdomain) return null;
  return { ...api, customerSubdomain };
}

export function isCloudflareStreamUrl(url: string): boolean {
  return /cloudflarestream\.com|videodelivery\.net/i.test(url);
}

export function extractCloudflareStreamUid(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (/videodelivery\.net/i.test(u.hostname)) {
      const first = u.pathname.split("/").filter(Boolean)[0];
      if (!first || first.split(".").length >= 3) return null;
      return first;
    }
    if (/cloudflarestream\.com/i.test(u.hostname)) {
      const first = u.pathname.split("/").filter(Boolean)[0];
      if (!first || first.split(".").length >= 3) return null;
      return first;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildCloudflarePlaybackUrls(uid: string, customerSubdomain: string) {
  const subdomainBase = normalizeSubdomain(customerSubdomain);
  return {
    iframeUrl: `${subdomainBase}/${uid}/iframe`,
    hlsUrl: `https://videodelivery.net/${uid}/manifest/video.m3u8`,
    dashUrl: `https://videodelivery.net/${uid}/manifest/video.mpd`,
    mp4Url: `https://videodelivery.net/${uid}/downloads/default.mp4`,
    thumbnailUrl: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg`,
  };
}

export async function ingestToCloudflareStreamFromUrl(
  sourceUrl: string,
  meta?: Record<string, string>,
): Promise<{
  uid: string;
  state: string;
  iframeUrl: string;
  hlsUrl: string;
  dashUrl: string;
  mp4Url: string;
  thumbnailUrl: string;
}> {
  const cfg = getCloudflareStreamConfig();
  if (!cfg) {
    throw new Error("Cloudflare Stream env is incomplete. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN, CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN.");
  }

  const streamMeta = buildStreamIngestMeta({
    ...meta,
    name: meta?.name ?? meta?.fileName ?? meta?.contentTitle ?? meta?.episodeTitle,
    source: meta?.source ?? "storytime-ingest",
    mime: meta?.mime,
  });

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream/copy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: sourceUrl,
        meta: streamMeta,
      }),
      cache: "no-store",
    },
  );

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
    result?: CloudflareCopyResult;
  };

  if (!res.ok || !payload.success || !payload.result?.uid) {
    const msg =
      payload.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      "Cloudflare Stream ingestion failed.";
    throw new Error(msg);
  }

  const urls = buildCloudflarePlaybackUrls(payload.result.uid, cfg.customerSubdomain);
  return {
    uid: payload.result.uid,
    state: payload.result.status?.state ?? "queued",
    ...urls,
  };
}

export async function ensureCloudflareStreamPlaybackUrl(
  url: string | null | undefined,
  meta?: Record<string, string>,
): Promise<string | null> {
  if (!url) return null;
  if (isCloudflareStreamUrl(url)) return url;
  const cfg = getCloudflareStreamConfig();
  if (!cfg) return url;
  const result = await ingestToCloudflareStreamFromUrl(url, meta);
  // Prefer mp4 delivery URL for compatibility with existing <video src>.
  return result.mp4Url;
}

export type CloudflareStreamVideoDetails = {
  uid: string;
  state: string;
  pctComplete: number | null;
  readyToStream: boolean;
  errorReasonText: string | null;
};

/** Live Stream video details (includes encoding pctComplete when available). */
export async function getCloudflareStreamVideoDetails(
  uid: string,
): Promise<CloudflareStreamVideoDetails | null> {
  const api = getCloudflareStreamApiCredentials();
  if (!api || !uid.trim()) return null;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${api.accountId}/stream/${encodeURIComponent(uid.trim())}`,
    {
      headers: { Authorization: `Bearer ${api.apiToken}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudflare Stream details failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (await res.json()) as {
    result?: {
      uid?: string;
      readyToStream?: boolean;
      status?: {
        state?: string;
        pctComplete?: string | number;
        errorReasonText?: string;
      };
    };
  };
  const result = payload.result;
  if (!result?.uid) return null;
  const rawPct = result.status?.pctComplete;
  const pct =
    typeof rawPct === "number"
      ? rawPct
      : typeof rawPct === "string" && rawPct.trim()
        ? Number.parseFloat(rawPct)
        : null;
  return {
    uid: result.uid,
    state: result.status?.state ?? "unknown",
    pctComplete: Number.isFinite(pct) ? Math.max(0, Math.min(100, pct as number)) : null,
    readyToStream: Boolean(result.readyToStream),
    errorReasonText: result.status?.errorReasonText?.trim() || null,
  };
}

