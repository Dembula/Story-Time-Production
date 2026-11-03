-- Cont Sheet + DPR (script supervisor)

CREATE TABLE IF NOT EXISTS "ContSheetDay" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "shootDayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "showTitle" TEXT,
    "productionCompany" TEXT,
    "callSheetNumber" TEXT,
    "reportDate" TEXT,
    "cameraUnit" TEXT,
    "crewJson" JSONB,
    "dayClockJson" JSONB,
    "scenesSummaryJson" JSONB,
    "totalsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContSheetDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContSheetDay_projectId_shootDayId_key" ON "ContSheetDay"("projectId", "shootDayId");
CREATE INDEX IF NOT EXISTS "ContSheetDay_projectId_idx" ON "ContSheetDay"("projectId");
CREATE INDEX IF NOT EXISTS "ContSheetDay_shootDayId_idx" ON "ContSheetDay"("shootDayId");

CREATE TABLE IF NOT EXISTS "ContSheetScene" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "projectSceneId" TEXT,
    "episode" TEXT,
    "sceneCode" TEXT NOT NULL,
    "dayNight" TEXT,
    "intExt" TEXT,
    "location" TEXT,
    "weather" TEXT,
    "turnoverTime" TEXT,
    "estimatedTiming" TEXT,
    "actualTiming" TEXT,
    "completionStatus" TEXT NOT NULL DEFAULT 'scheduled',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContSheetScene_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContSheetScene_dayId_idx" ON "ContSheetScene"("dayId");
CREATE INDEX IF NOT EXISTS "ContSheetScene_projectSceneId_idx" ON "ContSheetScene"("projectSceneId");

CREATE TABLE IF NOT EXISTS "ContSheetTake" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "slate" TEXT,
    "takeNumber" INTEGER,
    "pickup" INTEGER,
    "printStatus" TEXT,
    "durationSec" INTEGER,
    "description" TEXT,
    "notes" TEXT,
    "camera" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContSheetTake_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContSheetTake_sceneId_idx" ON "ContSheetTake"("sceneId");

DO $$ BEGIN
  ALTER TABLE "ContSheetDay" ADD CONSTRAINT "ContSheetDay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ContSheetDay" ADD CONSTRAINT "ContSheetDay_shootDayId_fkey" FOREIGN KEY ("shootDayId") REFERENCES "ShootDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ContSheetScene" ADD CONSTRAINT "ContSheetScene_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "ContSheetDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ContSheetScene" ADD CONSTRAINT "ContSheetScene_projectSceneId_fkey" FOREIGN KEY ("projectSceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ContSheetTake" ADD CONSTRAINT "ContSheetTake_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "ContSheetScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
