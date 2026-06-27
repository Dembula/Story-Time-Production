-- Story Time knowledge graph — entity relationships for search, X-Ray, recommendations
CREATE TABLE IF NOT EXISTS "KnowledgeEdge" (
    "id" TEXT NOT NULL,
    "fromType" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "label" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "contentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEdge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeEdge_fromType_fromId_relation_toType_toId_key"
  ON "KnowledgeEdge"("fromType", "fromId", "relation", "toType", "toId");

CREATE INDEX IF NOT EXISTS "KnowledgeEdge_fromType_fromId_idx"
  ON "KnowledgeEdge"("fromType", "fromId");

CREATE INDEX IF NOT EXISTS "KnowledgeEdge_toType_toId_idx"
  ON "KnowledgeEdge"("toType", "toId");

CREATE INDEX IF NOT EXISTS "KnowledgeEdge_contentId_idx"
  ON "KnowledgeEdge"("contentId");

CREATE INDEX IF NOT EXISTS "KnowledgeEdge_relation_idx"
  ON "KnowledgeEdge"("relation");

-- AI observability (Milestone 9)
CREATE TABLE IF NOT EXISTS "AiRequestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "route" TEXT NOT NULL,
    "agentId" TEXT,
    "modelUsed" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "ragHitCount" INTEGER NOT NULL DEFAULT 0,
    "vectorBackend" TEXT,
    "graphEdgeCount" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AiRequestLog_route_createdAt_idx"
  ON "AiRequestLog"("route", "createdAt");

CREATE INDEX IF NOT EXISTS "AiRequestLog_userId_createdAt_idx"
  ON "AiRequestLog"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "AiRequestLog_agentId_createdAt_idx"
  ON "AiRequestLog"("agentId", "createdAt");
