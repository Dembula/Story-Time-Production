import { getStorageConfig } from "./storage-config";

const URL_PROTOCOL = /^https?:\/\//i;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseBaseUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (!normalized) return null;
  const withProtocol = URL_PROTOCOL.test(normalized) ? normalized : `https://${normalized}`;
  try {
    const url = new URL(withProtocol);
    return trimTrailingSlash(url.toString());
  } catch {
    return null;
  }
}

function getCloudflareAllowedBases(): string[] {
  const values = new Set<string>();
  const raw = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (raw) {
    const base = parseBaseUrl(raw);
    if (base) values.add(base);
  }
  values.add("https://videodelivery.net");
  values.add("https://watch.cloudflarestream.com");
  return [...values];
}

export function getAllowedStorageBaseUrls(): string[] {
  const values = new Set<string>();
  const storage = getStorageConfig();

  const publicBase = parseBaseUrl(storage.publicBaseUrl);
  if (publicBase) values.add(publicBase);

  const bucket = storage.bucket;
  const region = storage.region;
  if (bucket && region) {
    values.add(`https://${bucket}.s3.${region}.amazonaws.com`);
  }

  const endpoint = parseBaseUrl(storage.endpoint);
  if (endpoint && bucket) {
    values.add(`${endpoint}/${encodeURIComponent(bucket)}`);
  }

  return [...values];
}

export function isAllowedStorageUrl(url: string): boolean {
  if (!URL_PROTOCOL.test(url)) return false;
  const normalizedUrl = trimTrailingSlash(url.trim());
  const allowedBases = [...getAllowedStorageBaseUrls(), ...getCloudflareAllowedBases()];
  if (allowedBases.length === 0) return false;
  return allowedBases.some((base) => normalizedUrl === base || normalizedUrl.startsWith(`${base}/`));
}

export function validateStorageUrlField(
  value: unknown,
  field: string,
  options?: { allowNull?: boolean },
): string | null {
  if (value == null || value === "") {
    return options?.allowNull === false ? `${field} is required.` : null;
  }
  if (typeof value !== "string") return `${field} must be a URL string.`;
  if (!isAllowedStorageUrl(value)) {
    return `${field} must be an uploaded storage URL from this platform.`;
  }
  return null;
}

export function validateStorageUrlList(value: unknown, field: string): string | null {
  if (value == null) return null;
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : null;
  if (!list) return `${field} must be a URL or list of URLs.`;
  for (const item of list) {
    if (typeof item !== "string" || !isAllowedStorageUrl(item)) {
      return `${field} must contain only uploaded storage URLs from this platform.`;
    }
  }
  return null;
}
