import type { Metadata } from "next";
import { buildPublicAppUrl, getCanonicalPublicBaseUrl } from "@/lib/app-url";
import { contentPublicPath, type SeoContentInput } from "@/lib/seo/content-json-ld";

function absoluteMediaUrl(url: string | null | undefined, base: string): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/")) return `${base}${u}`;
  return u;
}

/** Per-title Open Graph / Twitter / document metadata for public catalogue pages. */
export function buildContentPageMetadata(input: SeoContentInput): Metadata {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const pageUrl = buildPublicAppUrl(contentPublicPath(input.id));
  const description =
    input.description?.trim() ||
    `Watch ${input.title} on Story Time Universe — African film streaming.`;
  const poster = absoluteMediaUrl(input.posterUrl, base);
  const yearBit = input.year ? ` (${input.year})` : "";
  const genreBit = input.category?.trim() ? ` · ${input.category.trim()}` : "";
  const title = `${input.title}${yearBit}`;

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "video.other",
      locale: "en_ZA",
      url: pageUrl,
      siteName: "Story Time Universe",
      title: `${input.title}${yearBit}${genreBit}`,
      description,
      images: poster
        ? [
            {
              url: poster,
              alt: `${input.title} poster`,
            },
          ]
        : [{ url: `${base}/logo.png`, alt: "Story Time Universe" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${input.title}${yearBit}`,
      description,
      images: poster ? [poster] : [`${base}/logo.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
