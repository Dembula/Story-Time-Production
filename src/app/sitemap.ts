import type { MetadataRoute } from "next";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/** Public catalogue URLs for Google — unpublished / taken-down titles are omitted. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/auth/signin`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const [titles, people] = await Promise.all([
      prisma.content.findMany({
        where: { published: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 40_000,
      }),
      prisma.creditPerson.findMany({
        where: {
          crewMembers: { some: { content: { published: true } } },
        },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20_000,
      }),
    ]);

    const titleEntries: MetadataRoute.Sitemap = titles.map((c) => ({
      url: `${base}/browse/content/${c.id}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const peopleEntries: MetadataRoute.Sitemap = people.map((p) => ({
      url: `${base}/browse/people/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.55,
    }));

    return [...staticEntries, ...titleEntries, ...peopleEntries];
  } catch (err) {
    console.error("[sitemap] failed to load catalogue URLs", err);
    return staticEntries;
  }
}
