import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export type LandingSpotlightItem = {
  id: string;
  title: string;
  type: string;
  year: number | null;
  category: string | null;
  posterUrl: string | null;
  creatorName: string | null;
};

function popularityScore(item: {
  featured: boolean;
  createdAt: Date;
  ratings: { score: number }[];
  _count: { ratings: number; watchSessions: number };
}): number {
  const avgRating =
    item.ratings.length > 0
      ? item.ratings.reduce((sum, r) => sum + r.score, 0) / item.ratings.length
      : 0;
  const watchBoost = Math.min(item._count.watchSessions, 500) * 0.02;
  const ratingBoost = item._count.ratings * 0.15;
  const featuredBoost = item.featured ? 1.25 : 0;
  const recencyDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 2 - recencyDays / 45);
  return avgRating * 2 + watchBoost + ratingBoost + featuredBoost + recencyBoost;
}

export async function getLandingSpotlight(limit = 10): Promise<LandingSpotlightItem[]> {
  const pool = await prisma.content.findMany({
    where: { published: true },
    include: {
      creator: { select: { name: true } },
      ratings: { select: { score: true } },
      _count: { select: { ratings: true, watchSessions: true } },
    },
    take: 80,
    orderBy: { createdAt: "desc" },
  });

  if (pool.length === 0) return [];

  const ranked = [...pool]
    .sort((a, b) => popularityScore(b) - popularityScore(a))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      year: item.year ?? new Date(item.createdAt).getFullYear(),
      category: item.category,
      posterUrl: getDisplayPosterUrl(item),
      creatorName: item.creator?.name ?? null,
    }));

  return ranked;
}
