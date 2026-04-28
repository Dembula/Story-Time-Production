-- Make ProjectIdea support standalone creator ideas (optional project, optional user owner).
-- Some environments were missing the original ProjectIdea CREATE TABLE migration.
-- Create the base table when absent so shadow DB replay succeeds.
CREATE TABLE IF NOT EXISTS "ProjectIdea" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "logline" TEXT,
  "notes" TEXT,
  "genres" TEXT,
  "moodboardUrls" TEXT,
  "convertedToProject" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectIdea_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectIdea_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectIdea"
      ADD CONSTRAINT "ProjectIdea_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectIdea_projectId_idx" ON "ProjectIdea"("projectId");

ALTER TABLE "ProjectIdea"
  ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProjectIdea"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectIdea_userId_fkey'
  ) THEN
    ALTER TABLE "ProjectIdea"
      ADD CONSTRAINT "ProjectIdea_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectIdea_userId_idx" ON "ProjectIdea"("userId");

