import "server-only";

export type PexelsPhotoSrc = {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
};

export type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: PexelsPhotoSrc;
  alt: string;
  liked: boolean;
};

export type PexelsSearchResponse = {
  page: number;
  per_page: number;
  total_results: number;
  next_page?: string;
  prev_page?: string;
  photos: PexelsPhoto[];
};

export class PexelsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PexelsApiError";
    this.status = status;
  }
}

export function getPexelsApiKey(): string | null {
  const key = process.env.PEXELS_API_KEY?.trim();
  return key || null;
}

export function isPexelsConfigured(): boolean {
  return Boolean(getPexelsApiKey());
}

export function isAllowedPexelsImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "images.pexels.com" ||
      host.endsWith(".images.pexels.com") ||
      host === "www.pexels.com" ||
      host === "pexels.com"
    );
  } catch {
    return false;
  }
}

async function pexelsFetch(pathWithQuery: string): Promise<Response> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    throw new PexelsApiError("Pexels is not configured. Set PEXELS_API_KEY.", 503);
  }
  return fetch(`https://api.pexels.com/v1${pathWithQuery}`, {
    headers: { Authorization: apiKey, Accept: "application/json" },
    next: { revalidate: 0 },
  });
}

export async function searchPexelsPhotos(options: {
  query: string;
  page?: number;
  perPage?: number;
  orientation?: "landscape" | "portrait" | "square";
}): Promise<PexelsSearchResponse> {
  const query = options.query.trim();
  if (!query) {
    throw new PexelsApiError("Search query is required.", 400);
  }
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(40, Math.max(1, options.perPage ?? 24));
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
  });
  if (options.orientation) params.set("orientation", options.orientation);

  const res = await pexelsFetch(`/search?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new PexelsApiError("Pexels rate limit reached. Try again later.", 429);
    }
    throw new PexelsApiError(body || `Pexels search failed (${res.status})`, res.status);
  }
  return (await res.json()) as PexelsSearchResponse;
}

export async function getPexelsPhoto(id: number): Promise<PexelsPhoto> {
  const res = await pexelsFetch(`/photos/${id}`);
  if (!res.ok) {
    throw new PexelsApiError(`Could not load Pexels photo ${id}`, res.status);
  }
  return (await res.json()) as PexelsPhoto;
}

export function pickPexelsDownloadUrl(photo: PexelsPhoto): string {
  return photo.src.large2x || photo.src.large || photo.src.original;
}

export function formatPexelsCredit(photo: Pick<PexelsPhoto, "photographer" | "url">): string {
  return `Photo by ${photo.photographer} on Pexels`;
}
