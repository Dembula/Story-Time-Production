-- Script Review Studio: sessions and annotations

CREATE TABLE IF NOT EXISTS "ScriptReviewSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "draftKey" TEXT NOT NULL,
    "creatorScriptId" TEXT,
    "scriptVersionId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'IN_REVIEW',
    "coverageReport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptReviewSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ScriptReviewAnnotation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "layer" TEXT NOT NULL DEFAULT 'producer',
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "lineIndex" INTEGER,
    "anchorText" TEXT,
    "body" TEXT,
    "data" JSONB,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScriptReviewAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScriptReviewSession_projectId_draftKey_key" ON "ScriptReviewSession"("projectId", "draftKey");
CREATE INDEX IF NOT EXISTS "ScriptReviewSession_projectId_idx" ON "ScriptReviewSession"("projectId");
CREATE INDEX IF NOT EXISTS "ScriptReviewAnnotation_sessionId_idx" ON "ScriptReviewAnnotation"("sessionId");
CREATE INDEX IF NOT EXISTS "ScriptReviewAnnotation_authorId_idx" ON "ScriptReviewAnnotation"("authorId");
CREATE INDEX IF NOT EXISTS "ScriptReviewAnnotation_parentId_idx" ON "ScriptReviewAnnotation"("parentId");
CREATE INDEX IF NOT EXISTS "ScriptReviewAnnotation_layer_idx" ON "ScriptReviewAnnotation"("layer");

DO $$ BEGIN
    ALTER TABLE "ScriptReviewSession" ADD CONSTRAINT "ScriptReviewSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ScriptReviewAnnotation" ADD CONSTRAINT "ScriptReviewAnnotation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScriptReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ScriptReviewAnnotation" ADD CONSTRAINT "ScriptReviewAnnotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "ScriptReviewAnnotation" ADD CONSTRAINT "ScriptReviewAnnotation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ScriptReviewAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
