CREATE TABLE IF NOT EXISTS "ShootDayControlBoard" (
    "id" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneProgress" JSONB,
    "castStatus" JSONB,
    "crewStatus" JSONB,
    "equipmentStatus" JSONB,
    "locationStatus" JSONB,
    "acknowledgedAlerts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootDayControlBoard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShootDayControlBoard_shootDayId_key" ON "ShootDayControlBoard"("shootDayId");
CREATE INDEX IF NOT EXISTS "ShootDayControlBoard_projectId_idx" ON "ShootDayControlBoard"("projectId");

DO $$ BEGIN
    ALTER TABLE "ShootDayControlBoard" ADD CONSTRAINT "ShootDayControlBoard_shootDayId_fkey"
        FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ShootDayControlBoard" ADD CONSTRAINT "ShootDayControlBoard_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "IncidentReport" ADD COLUMN IF NOT EXISTS "resolutionOwnerId" TEXT;

DO $$ BEGIN
    ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_resolutionOwnerId_fkey"
        FOREIGN KEY ("resolutionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
