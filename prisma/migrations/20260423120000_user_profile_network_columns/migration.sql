-- User columns present in prisma/schema.prisma but missing from the original init migration.
-- Safe to re-run on DBs that already have some of these (IF NOT EXISTS).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "adminRights" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "headline" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "professionalName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bannerImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "primaryRole" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "skills" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "expertiseAreas" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "yearsExperience" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT DEFAULT 'AVAILABLE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "networkProfilePublic" BOOLEAN NOT NULL DEFAULT true;
