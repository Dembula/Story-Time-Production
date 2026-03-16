-- AlterTable
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "scriptProjectId" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "directorStatement" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "productionCompany" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "previousWorkSummary" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "intendedRelease" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "keyCastCrew" TEXT;
ALTER TABLE "OriginalPitch" ADD COLUMN IF NOT EXISTS "financingStatus" TEXT;
