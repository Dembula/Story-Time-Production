-- Project tool progress tracking (used by admin projects pipeline and creator workspace)
CREATE TABLE IF NOT EXISTS "ProjectToolProgress" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "percent" INTEGER NOT NULL DEFAULT 0,
    "pipelineStep" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectToolProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectToolProgress_projectId_toolId_key"
    ON "ProjectToolProgress"("projectId", "toolId");
CREATE INDEX IF NOT EXISTS "ProjectToolProgress_projectId_idx" ON "ProjectToolProgress"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectToolProgress_phase_idx" ON "ProjectToolProgress"("phase");

DO $$ BEGIN
    ALTER TABLE "ProjectToolProgress" ADD CONSTRAINT "ProjectToolProgress_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
