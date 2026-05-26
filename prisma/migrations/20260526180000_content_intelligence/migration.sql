-- Content intelligence: enrichment, scenes, subtitles
CREATE TABLE IF NOT EXISTS "ContentEnrichment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "moodTags" JSONB,
    "atmosphere" TEXT,
    "pacing" TEXT,
    "narrativeJson" JSONB,
    "dialogueIndex" JSONB,
    "embedding" JSONB,
    "enrichmentVersion" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentEnrichment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentEnrichment_contentId_key" ON "ContentEnrichment"("contentId");
CREATE INDEX IF NOT EXISTS "ContentEnrichment_status_idx" ON "ContentEnrichment"("status");

CREATE TABLE IF NOT EXISTS "ContentScene" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "enrichmentId" TEXT,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "summary" TEXT,
    "mood" TEXT,
    "actors" JSONB,
    "tags" JSONB,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentScene_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentScene_contentId_idx" ON "ContentScene"("contentId");
CREATE INDEX IF NOT EXISTS "ContentScene_enrichmentId_idx" ON "ContentScene"("enrichmentId");

CREATE TABLE IF NOT EXISTS "ContentSubtitle" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "vttUrl" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentSubtitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentSubtitle_contentId_language_key" ON "ContentSubtitle"("contentId", "language");
CREATE INDEX IF NOT EXISTS "ContentSubtitle_contentId_idx" ON "ContentSubtitle"("contentId");

ALTER TABLE "ContentEnrichment" ADD CONSTRAINT "ContentEnrichment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentScene" ADD CONSTRAINT "ContentScene_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentScene" ADD CONSTRAINT "ContentScene_enrichmentId_fkey" FOREIGN KEY ("enrichmentId") REFERENCES "ContentEnrichment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentSubtitle" ADD CONSTRAINT "ContentSubtitle_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
