-- Make ProjectIdea support standalone creator ideas (optional project, optional user owner).
ALTER TABLE "ProjectIdea"
  ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProjectIdea"
  ADD COLUMN "userId" TEXT;

ALTER TABLE "ProjectIdea"
  ADD CONSTRAINT "ProjectIdea_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ProjectIdea_userId_idx" ON "ProjectIdea"("userId");

