import { prisma } from "@/lib/prisma";
import { cosineSimilarity, embedText, parseStoredEmbedding } from "@/lib/ai-metadata/embeddings";
import { rankSearchResults } from "@/lib/browse-search";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export async function semanticSearchCatalogue(options: {
  query: string;
  limit?: number;
  profileAge?: number | null;
}) {
  const q = options.query.trim();
  const limit = options.limit ?? 16;
  if (q.length < 2) return [];

  const ageFilter = options.profileAge != null ? { minAge: { lte: options.profileAge } } : {};

  const queryEmbedding = await embedText(q);

  if (queryEmbedding) {
    const enriched = await prisma.content.findMany({
      where: {
        published: true,
        ...ageFilter,
        enrichment: { status: "READY" },
      },
      include: {
        enrichment: { select: { embedding: true, moodTags: true, atmosphere: true } },
        creator: { select: { name: true } },
        _count: { select: { ratings: true } },
      },
      take: 80,
    });

    const scored = enriched
      .map((c) => {
        const vec = parseStoredEmbedding(c.enrichment?.embedding);
        const semantic = vec ? cosineSimilarity(queryEmbedding, vec) : 0;
        const lexical = rankSearchResults([c], q).length > 0 ? 0.25 : 0;
        return { c, score: semantic * 0.75 + lexical };
      })
      .filter((x) => x.score > 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length > 0) {
      return scored.map(({ c }) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        category: c.category,
        year: c.year,
        posterUrl: getDisplayPosterUrl(c),
        creatorName: c.creator?.name ?? null,
        moodTags: c.enrichment?.moodTags,
        atmosphere: c.enrichment?.atmosphere ?? null,
        ratingCount: c._count.ratings,
      }));
    }
  }

  const fallback = await prisma.content.findMany({
    where: {
      published: true,
      ...ageFilter,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { contains: q, mode: "insensitive" } },
        { enrichment: { atmosphere: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      creator: { select: { name: true } },
      _count: { select: { ratings: true } },
      enrichment: { select: { moodTags: true, atmosphere: true } },
    },
    take: 48,
  });

  return rankSearchResults(fallback, q)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      category: c.category,
      year: c.year,
      posterUrl: getDisplayPosterUrl(c),
      creatorName: c.creator?.name ?? null,
      moodTags: c.enrichment?.moodTags,
      atmosphere: c.enrichment?.atmosphere ?? null,
      ratingCount: c._count.ratings,
    }));
}
