-- Prisma @unique on projectId created a unique INDEX (not only a named constraint).
-- The prior multi-budget migration dropped the constraint name but left the index,
-- which still blocks inserting a second budget per project.

DROP INDEX IF EXISTS "ProjectBudget_projectId_key";
