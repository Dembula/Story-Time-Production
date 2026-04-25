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

export function getCloudflareStreamConfig(): CloudflareStreamConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? "";
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ?? "";
  const customerSubdomainRaw = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ?? "";
  if (!accountId || !apiToken || !customerSubdomainRaw) return null;
  const customerSubdomain = normalizeSubdomain(customerSubdomainRaw);
  if (!customerSubdomain) return null;
  return { accountId, apiToken, customerSubdomain };
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
      return first || null;
    }
    if (/cloudflarestream\.com/i.test(u.hostname)) {
      const first = u.pathname.split("/").filter(Boolean)[0];
      return first || null;
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
        meta: meta ?? {},
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

