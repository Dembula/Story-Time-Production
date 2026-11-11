import { buildPublicAppUrl, getCanonicalPublicBaseUrl } from "@/lib/app-url";

export type SeoCrewMember = {
  name: string;
  role: string;
  creditPersonId?: string | null;
};

export type SeoContentInput = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  category?: string | null;
  tags?: string | null;
  language?: string | null;
  country?: string | null;
  ageRating?: string | null;
  minAge?: number | null;
  year?: number | null;
  duration?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  creator?: { id: string; name?: string | null } | null;
  crewMembers?: SeoCrewMember[];
};

const APP_STORE_URL = "https://apps.apple.com/za/app/story-time-universe/id6792273306";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.storytime.universe&pcampaignid=web_share";

function absoluteMediaUrl(url: string | null | undefined, base: string): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
}

function isoDurationFromMinutes(minutes: number | null | undefined): string | undefined {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return undefined;
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return `PT${h}H${m}M`;
  if (h > 0) return `PT${h}H`;
  return `PT${m}M`;
}

function splitList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

/** Primary creative directors — exclude photography/art/casting/AD department noise. */
function isPrimaryDirectorRole(role: string): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r === "director" || r === "co-director" || r === "codirector") return true;
  if (r === "series director" || r === "episode director") return true;
  if (r === "director / producer (doc)" || r === "self-shooting director" || r === "field director") {
    return true;
  }
  if (/\b(assistant|1st|2nd|3rd|floor|crowd|key|train(?:ee)?|set|additional)\s+ad\b/.test(r)) {
    return false;
  }
  if (r.includes("assistant director")) return false;
  if (r.includes("director of photography") || r === "dop" || r.includes("u/w dop")) return false;
  if (r.includes("art director") || r.includes("casting director")) return false;
  if (r.includes("creative director") || r.includes("technical director")) return false;
  if (r.includes("animation director") || r.includes("choir director") || r.includes("studio director")) {
    return false;
  }
  if (r.includes("multi-cam director") || r.includes("vision mixer")) return false;
  if (r.includes("unit director") || r.includes("stage director") || r.includes("theatre director")) {
    return false;
  }
  if (r.includes("director's assistant") || r.includes("attaché") || r.includes("shadow director")) {
    return false;
  }
  return r === "director" || /^co[-\s]?director$/.test(r);
}

function isActorRole(role: string): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r.includes("actor") || r.includes("actress")) return true;
  if (r === "cast" || r === "lead" || r === "co-lead" || r === "supporting") return true;
  if (r.includes("cameo") || r.includes("extra") || r.includes("background performer")) return true;
  return false;
}

function isWriterRole(role: string): string | false {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r === "writer" || r === "screenwriter" || r === "scriptwriter") return "Writer";
  if (r.includes("screenplay") || r.includes("writer")) return "Writer";
  return false;
}

function isProducerRole(role: string): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (r.includes("casting")) return false;
  return (
    r === "producer" ||
    r === "executive producer" ||
    r === "co-producer" ||
    r === "line producer" ||
    r === "associate producer" ||
    r.includes("producer")
  );
}

function personNode(
  name: string,
  opts?: { url?: string; jobTitle?: string },
): Record<string, unknown> {
  return {
    "@type": "Person",
    name,
    ...(opts?.url ? { url: opts.url } : {}),
    ...(opts?.jobTitle ? { jobTitle: opts.jobTitle } : {}),
  };
}

function schemaTypeForContent(type: string): "Movie" | "TVSeries" | "TVEpisode" | "CreativeWork" {
  const t = type.trim().toUpperCase();
  if (t === "SERIES" || t === "SHOW" || t === "TV" || t === "TV_SERIES") return "TVSeries";
  if (t === "EPISODE") return "TVEpisode";
  if (t === "MOVIE" || t === "SHORT" || t === "DOCUMENTARY" || t === "FILM") return "Movie";
  if (t === "PODCAST") return "CreativeWork";
  return "Movie";
}

export function contentPublicPath(id: string): string {
  return `/browse/content/${id}`;
}

export function buildContentJsonLd(input: SeoContentInput): Record<string, unknown> {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const pageUrl = buildPublicAppUrl(contentPublicPath(input.id));
  const poster = absoluteMediaUrl(input.posterUrl, base);
  const backdrop = absoluteMediaUrl(input.backdropUrl, base);
  const images = [poster, backdrop].filter(Boolean) as string[];
  const genres = [
    ...splitList(input.category),
    ...splitList(input.tags),
  ].filter((g, i, arr) => arr.findIndex((x) => x.toLowerCase() === g.toLowerCase()) === i);

  const crew = input.crewMembers ?? [];
  const directors = crew
    .filter((c) => isPrimaryDirectorRole(c.role) && c.name.trim())
    .map((c) =>
      personNode(c.name.trim(), {
        url: c.creditPersonId ? buildPublicAppUrl(`/browse/people/${c.creditPersonId}`) : undefined,
        jobTitle: c.role,
      }),
    );
  const actors = crew
    .filter((c) => isActorRole(c.role) && c.name.trim())
    .map((c) =>
      personNode(c.name.trim(), {
        url: c.creditPersonId ? buildPublicAppUrl(`/browse/people/${c.creditPersonId}`) : undefined,
        jobTitle: c.role,
      }),
    );
  const writers = crew
    .filter((c) => isWriterRole(c.role) && c.name.trim())
    .map((c) =>
      personNode(c.name.trim(), {
        url: c.creditPersonId ? buildPublicAppUrl(`/browse/people/${c.creditPersonId}`) : undefined,
        jobTitle: c.role,
      }),
    );
  const producers = crew
    .filter((c) => isProducerRole(c.role) && c.name.trim())
    .map((c) =>
      personNode(c.name.trim(), {
        url: c.creditPersonId ? buildPublicAppUrl(`/browse/people/${c.creditPersonId}`) : undefined,
        jobTitle: c.role,
      }),
    );

  // Capture remaining credited people as contributor so we don't drop filmmaker credits.
  const claimed = new Set(
    [...directors, ...actors, ...writers, ...producers].map((p) => String(p.name).toLowerCase()),
  );
  const contributors = crew
    .filter((c) => c.name.trim() && !claimed.has(c.name.trim().toLowerCase()))
    .map((c) =>
      personNode(c.name.trim(), {
        url: c.creditPersonId ? buildPublicAppUrl(`/browse/people/${c.creditPersonId}`) : undefined,
        jobTitle: c.role,
      }),
    );

  const schemaType = schemaTypeForContent(input.type);
  const duration = isoDurationFromMinutes(input.duration);
  const dateCreated =
    input.year != null
      ? String(input.year)
      : input.createdAt
        ? new Date(input.createdAt).toISOString().slice(0, 10)
        : undefined;

  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${pageUrl}#title`,
    name: input.title,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(images.length === 1 ? { image: images[0] } : images.length > 1 ? { image: images } : {}),
    ...(dateCreated ? { dateCreated, copyrightYear: input.year ?? undefined } : {}),
    ...(duration ? { duration } : {}),
    ...(genres.length ? { genre: genres.length === 1 ? genres[0] : genres } : {}),
    ...(input.language?.trim() ? { inLanguage: input.language.trim() } : {}),
    ...(input.country?.trim()
      ? { countryOfOrigin: { "@type": "Country", name: input.country.trim() } }
      : {}),
    ...(input.ageRating?.trim()
      ? { contentRating: input.ageRating.trim() }
      : {}),
    ...(directors.length
      ? { director: directors.length === 1 ? directors[0] : directors }
      : {}),
    ...(actors.length ? { actor: actors.length === 1 ? actors[0] : actors } : {}),
    ...(writers.length
      ? { author: writers.length === 1 ? writers[0] : writers }
      : {}),
    ...(producers.length
      ? { producer: producers.length === 1 ? producers[0] : producers }
      : {}),
    ...(contributors.length
      ? { contributor: contributors.length === 1 ? contributors[0] : contributors }
      : {}),
    ...(input.creator?.name
      ? {
          creator: personNode(input.creator.name, {
            jobTitle: "Filmmaker",
          }),
        }
      : {}),
    productionCompany: {
      "@type": "Organization",
      name: "Story Time Universe",
      url: base,
    },
    potentialAction: {
      "@type": "WatchAction",
      target: pageUrl,
    },
    isAccessibleForFree: false,
    offers: {
      "@type": "Offer",
      url: pageUrl,
      availability: "https://schema.org/InStock",
      category: "subscription",
    },
  };

  return graph;
}

export function buildTrailerVideoObjectJsonLd(
  input: SeoContentInput,
): Record<string, unknown> | null {
  if (!input.trailerUrl?.trim()) return null;
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const pageUrl = buildPublicAppUrl(contentPublicPath(input.id));
  const poster = absoluteMediaUrl(input.posterUrl, base);
  const trailer = absoluteMediaUrl(input.trailerUrl, base);
  if (!trailer) return null;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": `${pageUrl}#trailer`,
    name: `${input.title} — Trailer`,
    description: input.description?.trim() || `Trailer for ${input.title} on Story Time Universe`,
    thumbnailUrl: poster,
    uploadDate: input.createdAt
      ? new Date(input.createdAt).toISOString()
      : input.year
        ? `${input.year}-01-01`
        : undefined,
    contentUrl: trailer,
    embedUrl: pageUrl,
    url: pageUrl,
  };
}

export function buildOrganizationJsonLd(): Record<string, unknown> {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const sameAs = [
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim(),
    process.env.NEXT_PUBLIC_SOCIAL_TIKTOK?.trim(),
    process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE?.trim(),
    process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK?.trim(),
    process.env.NEXT_PUBLIC_SOCIAL_X?.trim(),
    process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN?.trim(),
    APP_STORE_URL,
    PLAY_STORE_URL,
  ].filter(Boolean) as string[];

  const legalName = process.env.NEXT_PUBLIC_ORG_LEGAL_NAME?.trim();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "Story Time Universe",
    alternateName: ["Story Time", "Story Time Studios"],
    ...(legalName ? { legalName } : {}),
    url: base,
    logo: {
      "@type": "ImageObject",
      url: `${base}/logo.png`,
    },
    image: `${base}/logo.png`,
    description:
      "Story Time Universe is a streaming platform for African films, series, shorts, and documentaries from independent filmmakers.",
    foundingLocation: {
      "@type": "Place",
      name: "South Africa",
    },
    sameAs,
  };
}

export function buildPersonJsonLd(input: {
  id: string;
  displayName: string;
  bio?: string | null;
  imageUrl?: string | null;
  jobTitles?: string[];
}): Record<string, unknown> {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const pageUrl = buildPublicAppUrl(`/browse/people/${input.id}`);
  const image = absoluteMediaUrl(input.imageUrl, base);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${pageUrl}#person`,
    name: input.displayName,
    url: pageUrl,
    ...(input.bio?.trim() ? { description: input.bio.trim() } : {}),
    ...(image ? { image } : {}),
    ...(input.jobTitles?.length
      ? { jobTitle: input.jobTitles.length === 1 ? input.jobTitles[0] : input.jobTitles }
      : {}),
  };
}

export function jsonLdScriptContent(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
