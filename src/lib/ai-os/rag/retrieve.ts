import "server-only";

import { prisma } from "@/lib/prisma";
import { embedText, cosineSimilarity, parseStoredEmbedding } from "@/lib/ai-metadata/embeddings";
import { upsertKnowledgeChunk } from "./index-chunk";
import { PLATFORM_POLICY_CHUNKS } from "./platform-policies";
import { isPgvectorAvailable, searchKnowledgePgvector } from "./pgvector";
import type {
  KnowledgeSourceType,
  RetrieveKnowledgeParams,
  RetrieveKnowledgeResult,
  RetrievedKnowledgeChunk,
} from "./types";

let platformPoliciesIndexed = false;

async function ensurePlatformPoliciesIndexed(): Promise<void> {
  if (platformPoliciesIndexed) return;
  for (const policy of PLATFORM_POLICY_CHUNKS) {
    await upsertKnowledgeChunk({
      chunkKey: policy.chunkKey,
      sourceType: "platform_policy",
      sourceId: policy.chunkKey,
      title: policy.title,
      chunkText: policy.chunkText,
    });
  }
  platformPoliciesIndexed = true;
}

async function resolveAllowedContentIds(profileAge?: number | null): Promise<string[] | null> {
  if (profileAge == null) return null;
  const rows = await prisma.content.findMany({
    where: { published: true, minAge: { lte: profileAge } },
    select: { id: true },
    take: 5000,
  });
  return rows.map((r) => r.id);
}

async function searchKnowledgeJsonFallback(params: {
  queryVector: number[];
  sourceTypes: KnowledgeSourceType[];
  limit: number;
  minScore: number;
  contentId?: string | null;
  projectId?: string | null;
  allowedContentIds?: string[] | null;
}): Promise<RetrievedKnowledgeChunk[]> {
  const rows = await prisma.knowledgeChunk.findMany({
    where: {
      sourceType: { in: params.sourceTypes },
      ...(params.contentId ? { contentId: params.contentId } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
    },
    take: 500,
    select: {
      id: true,
      chunkKey: true,
      sourceType: true,
      title: true,
      chunkText: true,
      contentId: true,
      projectId: true,
      metadata: true,
      embedding: true,
    },
  });

  const allowed = params.allowedContentIds ? new Set(params.allowedContentIds) : null;

  const scored: RetrievedKnowledgeChunk[] = [];

  for (const row of rows) {
    const vec = parseStoredEmbedding(row.embedding);
    if (!vec) continue;
    if (
      allowed &&
      (row.sourceType === "catalogue" || row.sourceType === "scene") &&
      row.contentId &&
      !allowed.has(row.contentId)
    ) {
      continue;
    }
    const score = cosineSimilarity(params.queryVector, vec);
    if (score < params.minScore) continue;
    scored.push({
      id: row.id,
      chunkKey: row.chunkKey,
      sourceType: row.sourceType as KnowledgeSourceType,
      title: row.title,
      chunkText: row.chunkText,
      score,
      contentId: row.contentId,
      projectId: row.projectId,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, params.limit);
}

/**
 * Retrieve grounded knowledge chunks for RAG injection.
 * Uses pgvector when available; falls back to JSON cosine similarity.
 */
export async function retrieveKnowledge(
  params: RetrieveKnowledgeParams,
): Promise<RetrieveKnowledgeResult> {
  const query = params.query.trim();
  const limit = params.limit ?? 8;
  const minScore = params.minScore ?? 0.15;

  if (query.length < 2 || params.sourceTypes.length === 0) {
    return { chunks: [], queryEmbeddingUsed: false, vectorBackend: "none" };
  }

  if (params.sourceTypes.includes("platform_policy")) {
    await ensurePlatformPoliciesIndexed();
  }

  const queryVector = await embedText(query);
  if (!queryVector) {
    return { chunks: [], queryEmbeddingUsed: false, vectorBackend: "none" };
  }

  const allowedContentIds = await resolveAllowedContentIds(params.profileAge);

  const searchParams = {
    queryVector,
    sourceTypes: params.sourceTypes,
    limit,
    minScore,
    contentId: params.contentId,
    projectId: params.projectId,
    userId: params.userId,
    allowedContentIds,
  };

  if (await isPgvectorAvailable()) {
    const chunks = await searchKnowledgePgvector(searchParams);
    if (chunks.length > 0) {
      return { chunks, queryEmbeddingUsed: true, vectorBackend: "pgvector" };
    }
  }

  const chunks = await searchKnowledgeJsonFallback(searchParams);
  return {
    chunks,
    queryEmbeddingUsed: true,
    vectorBackend: chunks.length > 0 ? "json_cosine" : "none",
  };
}
