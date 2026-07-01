-- Allow multiple budgets per project with a named default for VA and expense sync.

ALTER TABLE "ProjectBudget" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT 'Main budget';
ALTER TABLE "ProjectBudget" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ProjectBudget" pb
SET "isDefault" = true
WHERE pb.id IN (
  SELECT DISTINCT ON ("projectId") id
  FROM "ProjectBudget"
  ORDER BY "projectId", "createdAt" ASC
);

ALTER TABLE "ProjectBudget" DROP CONSTRAINT IF EXISTS "ProjectBudget_projectId_key";

CREATE INDEX IF NOT EXISTS "ProjectBudget_projectId_isDefault_idx" ON "ProjectBudget"("projectId", "isDefault");
