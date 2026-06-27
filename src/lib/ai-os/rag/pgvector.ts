import { prisma } from "@/lib/prisma";
import type { KnowledgeSourceType, RetrievedKnowledgeChunk } from "./types";
import { vectorToPgLiteral } from "./vector-utils";

let pgvectorCached: boolean | null = null;

/** Whether pgvector extension and embeddingVector column are available. */
export async function isPgvectorAvailable(): Promise<boolean> {
  if (pgvectorCached !== null) return pgvectorCached;
  try {
    const ext = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector' LIMIT 1
    `;
    if (ext.length === 0) {
      pgvectorCached = false;
      return false;
    }
    const col = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'KnowledgeChunk' AND column_name = 'embeddingVector'
      LIMIT 1
    `;
    pgvectorCached = col.length > 0;
  } catch {
    pgvectorCached = false;
  }
  return pgvectorCached;
}

export function resetPgvectorCacheForTests(): void {
  pgvectorCached = null;
}

type PgVectorRow = {
  id: string;
  chunkKey: string;
  sourceType: string;
  title: string | null;
  chunkText: string;
  contentId: string | null;
  projectId: string | null;
  metadata: unknown;
  similarity: number;
};

export async function searchKnowledgePgvector(params: {
  queryVector: number[];
  sourceTypes: KnowledgeSourceType[];
  limit: number;
  minScore: number;
  contentId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  allowedContentIds?: string[] | null;
}): Promise<RetrievedKnowledgeChunk[]> {
  const literal = vectorToPgLiteral(params.queryVector);
  const sourceTypes = params.sourceTypes;

  const rows = await prisma.$queryRawUnsafe<PgVectorRow[]>(
    `
    SELECT
      k."id",
      k."chunkKey",
      k."sourceType",
      k."title",
      k."chunkText",
      k."contentId",
      k."projectId",
      k."metadata",
      (1 - (k."embeddingVector" <=> $1::vector)) AS similarity
    FROM "KnowledgeChunk" k
    WHERE k."embeddingVector" IS NOT NULL
      AND k."sourceType" = ANY($2::text[])
      AND ($3::text IS NULL OR k."contentId" = $3)
      AND ($4::text IS NULL OR k."projectId" = $4)
      AND ($5::text IS NULL OR k."userId" IS NULL OR k."userId" = $5)
      AND (
        $6::text[] IS NULL
        OR k."sourceType" NOT IN ('catalogue', 'scene')
        OR k."contentId" = ANY($6::text[])
      )
    ORDER BY k."embeddingVector" <=> $1::vector
    LIMIT $7
    `,
    literal,
    sourceTypes,
    params.contentId ?? null,
    params.projectId ?? null,
    params.userId ?? null,
    params.allowedContentIds?.length ? params.allowedContentIds : null,
    Math.max(params.limit * 3, params.limit),
  );

  return rows
    .filter((r) => r.similarity >= params.minScore)
    .slice(0, params.limit)
    .map((r) => ({
      id: r.id,
      chunkKey: r.chunkKey,
      sourceType: r.sourceType as KnowledgeSourceType,
      title: r.title,
      chunkText: r.chunkText,
      score: r.similarity,
      contentId: r.contentId,
      projectId: r.projectId,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    }));
}

export async function syncEmbeddingVector(chunkKey: string, embedding: number[]): Promise<void> {
  if (!(await isPgvectorAvailable())) return;
  const literal = vectorToPgLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `UPDATE "KnowledgeChunk" SET "embeddingVector" = $1::vector, "updatedAt" = NOW() WHERE "chunkKey" = $2`,
    literal,
    chunkKey,
  );
}
