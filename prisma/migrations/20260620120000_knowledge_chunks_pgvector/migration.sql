-- Story Time AI OS — knowledge chunks + pgvector for RAG retrieval
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "contentId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "title" TEXT,
    "chunkText" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" JSONB,
    "embeddingVector" vector(1536),
    "tokenEstimate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_chunkKey_key" ON "KnowledgeChunk"("chunkKey");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_sourceType_idx" ON "KnowledgeChunk"("sourceType");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_contentId_idx" ON "KnowledgeChunk"("contentId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_projectId_idx" ON "KnowledgeChunk"("projectId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_userId_sourceType_idx" ON "KnowledgeChunk"("userId", "sourceType");

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embeddingVector_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw ("embeddingVector" vector_cosine_ops);

-- Backfill pgvector column from existing JSON embeddings on catalogue chunks (if any pre-exist)
-- Primary backfill runs via scripts/backfill-knowledge-chunks.ts after ContentEnrichment sync.
