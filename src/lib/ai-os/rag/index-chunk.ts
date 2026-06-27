import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import { embedText } from "@/lib/ai-metadata/embeddings";
import { syncEmbeddingVector } from "./pgvector";
import type { UpsertKnowledgeChunkInput } from "./types";
import { estimateTokens } from "./vector-utils";

/** Upsert a knowledge chunk and sync pgvector column when embedding present. */
export async function upsertKnowledgeChunk(input: UpsertKnowledgeChunkInput): Promise<string> {
  const embedding = input.embedding ?? (await embedText(input.chunkText.slice(0, 8000)));
  const tokenEstimate = estimateTokens(input.chunkText);

  const row = await prisma.knowledgeChunk.upsert({
    where: { chunkKey: input.chunkKey },
    create: {
      id: randomUUID(),
      chunkKey: input.chunkKey,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      contentId: input.contentId ?? null,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      title: input.title ?? null,
      chunkText: input.chunkText,
      metadata: (input.metadata ?? undefined) as InputJsonValue | undefined,
      embedding: embedding ?? undefined,
      tokenEstimate,
    },
    update: {
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      contentId: input.contentId ?? null,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      title: input.title ?? null,
      chunkText: input.chunkText,
      metadata: (input.metadata ?? undefined) as InputJsonValue | undefined,
      embedding: embedding ?? undefined,
      tokenEstimate,
      updatedAt: new Date(),
    },
    select: { id: true, chunkKey: true },
  });

  if (embedding?.length) {
    await syncEmbeddingVector(row.chunkKey, embedding).catch(() => {
      /* pgvector optional — JSON embedding remains fallback */
    });
  }

  return row.id;
}
