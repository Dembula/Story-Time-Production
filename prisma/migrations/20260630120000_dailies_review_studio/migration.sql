-- Dailies Review Studio: clips, rich notes, batch metadata

ALTER TABLE "DailiesBatch" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "DailiesBatch" ADD COLUMN IF NOT EXISTS "cameraCard" TEXT;
ALTER TABLE "DailiesBatch" ADD COLUMN IF NOT EXISTS "uploadStatus" TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE "DailiesBatch" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "DailiesBatch" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "DailiesClip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "batchId" TEXT,
    "sceneId" TEXT,
    "shootDayId" TEXT,
    "unit" TEXT,
    "title" TEXT,
    "videoUrl" TEXT,
    "proxyUrl" TEXT,
    "streamStatus" TEXT NOT NULL DEFAULT 'pending',
    "shotNumber" TEXT,
    "takeNumber" INTEGER,
    "camera" TEXT,
    "lens" TEXT,
    "slate" TEXT,
    "location" TEXT,
    "sequence" TEXT,
    "editorBin" TEXT,
    "durationMs" INTEGER,
    "fileSizeBytes" BIGINT,
    "metadata" JSONB,
    "takeStatus" TEXT NOT NULL DEFAULT 'pending',
    "takeFlags" JSONB,
    "aiAnalysis" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailiesClip_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "clipId" TEXT;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "timestampMs" INTEGER;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "frameNumber" INTEGER;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "resolved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "parentNoteId" TEXT;
ALTER TABLE "DailiesNote" ADD COLUMN IF NOT EXISTS "drawings" JSONB;

ALTER TABLE "DailiesNote" ALTER COLUMN "batchId" DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesClip_projectId_fkey') THEN
    ALTER TABLE "DailiesClip" ADD CONSTRAINT "DailiesClip_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesClip_batchId_fkey') THEN
    ALTER TABLE "DailiesClip" ADD CONSTRAINT "DailiesClip_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "DailiesBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesClip_sceneId_fkey') THEN
    ALTER TABLE "DailiesClip" ADD CONSTRAINT "DailiesClip_sceneId_fkey"
      FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesClip_shootDayId_fkey') THEN
    ALTER TABLE "DailiesClip" ADD CONSTRAINT "DailiesClip_shootDayId_fkey"
      FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesNote_clipId_fkey') THEN
    ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_clipId_fkey"
      FOREIGN KEY ("clipId") REFERENCES "DailiesClip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailiesNote_parentNoteId_fkey') THEN
    ALTER TABLE "DailiesNote" ADD CONSTRAINT "DailiesNote_parentNoteId_fkey"
      FOREIGN KEY ("parentNoteId") REFERENCES "DailiesNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DailiesClip_projectId_idx" ON "DailiesClip"("projectId");
CREATE INDEX IF NOT EXISTS "DailiesClip_batchId_idx" ON "DailiesClip"("batchId");
CREATE INDEX IF NOT EXISTS "DailiesClip_sceneId_idx" ON "DailiesClip"("sceneId");
CREATE INDEX IF NOT EXISTS "DailiesClip_shootDayId_idx" ON "DailiesClip"("shootDayId");
CREATE INDEX IF NOT EXISTS "DailiesClip_takeStatus_idx" ON "DailiesClip"("takeStatus");
CREATE INDEX IF NOT EXISTS "DailiesNote_clipId_idx" ON "DailiesNote"("clipId");
CREATE INDEX IF NOT EXISTS "DailiesNote_parentNoteId_idx" ON "DailiesNote"("parentNoteId");

-- Backfill clips from legacy batches that have video
INSERT INTO "DailiesClip" (
  "id", "projectId", "batchId", "sceneId", "shootDayId", "title", "videoUrl",
  "streamStatus", "takeStatus", "createdAt", "updatedAt"
)
SELECT
  'legacy_' || b."id",
  b."projectId",
  b."id",
  b."sceneId",
  b."shootDayId",
  COALESCE(b."title", 'Legacy batch clip'),
  b."videoUrl",
  CASE WHEN b."videoUrl" IS NOT NULL THEN 'ready' ELSE 'pending' END,
  'pending',
  b."createdAt",
  COALESCE(b."updatedAt", b."createdAt")
FROM "DailiesBatch" b
WHERE b."videoUrl" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "DailiesClip" c WHERE c."batchId" = b."id");
