CREATE TABLE IF NOT EXISTS "ShootDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "unit" TEXT,
    "callTime" TEXT,
    "wrapTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "locationSummary" TEXT,
    "scenesBeingShot" TEXT,
    "dayNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShootDay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShootDay_projectId_idx" ON "ShootDay"("projectId");
CREATE INDEX IF NOT EXISTS "ShootDay_date_idx" ON "ShootDay"("date");
DO $$ BEGIN
    ALTER TABLE "ShootDay" ADD CONSTRAINT "ShootDay_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "IncidentReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shootDayId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IncidentReport_projectId_idx" ON "IncidentReport"("projectId");
CREATE INDEX IF NOT EXISTS "IncidentReport_shootDayId_idx" ON "IncidentReport"("shootDayId");
CREATE INDEX IF NOT EXISTS "IncidentReport_severity_idx" ON "IncidentReport"("severity");
DO $$ BEGIN
    ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_shootDayId_fkey"
        FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
