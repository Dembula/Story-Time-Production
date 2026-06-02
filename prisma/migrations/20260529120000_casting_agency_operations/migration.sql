-- Casting agency operations: talent commission, audition submissions, availability blocks

ALTER TABLE "CastingTalent" ADD COLUMN IF NOT EXISTS "agencyCommissionPercent" DOUBLE PRECISION;
ALTER TABLE "CastingTalent" ADD COLUMN IF NOT EXISTS "representationType" TEXT;

CREATE TABLE IF NOT EXISTS "CastingAuditionSubmission" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auditionPostId" TEXT NOT NULL,
    "castingAgencyId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,

    CONSTRAINT "CastingAuditionSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CastingTalentAvailability" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "projectLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "talentId" TEXT NOT NULL,

    CONSTRAINT "CastingTalentAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CastingAuditionSubmission_auditionPostId_talentId_key" ON "CastingAuditionSubmission"("auditionPostId", "talentId");
CREATE INDEX IF NOT EXISTS "CastingAuditionSubmission_castingAgencyId_idx" ON "CastingAuditionSubmission"("castingAgencyId");
CREATE INDEX IF NOT EXISTS "CastingAuditionSubmission_talentId_idx" ON "CastingAuditionSubmission"("talentId");
CREATE INDEX IF NOT EXISTS "CastingAuditionSubmission_status_idx" ON "CastingAuditionSubmission"("status");

CREATE INDEX IF NOT EXISTS "CastingTalentAvailability_talentId_idx" ON "CastingTalentAvailability"("talentId");
CREATE INDEX IF NOT EXISTS "CastingTalentAvailability_status_idx" ON "CastingTalentAvailability"("status");
CREATE INDEX IF NOT EXISTS "CastingTalentAvailability_startDate_idx" ON "CastingTalentAvailability"("startDate");

DO $$ BEGIN
  ALTER TABLE "CastingAuditionSubmission" ADD CONSTRAINT "CastingAuditionSubmission_auditionPostId_fkey" FOREIGN KEY ("auditionPostId") REFERENCES "AuditionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CastingAuditionSubmission" ADD CONSTRAINT "CastingAuditionSubmission_castingAgencyId_fkey" FOREIGN KEY ("castingAgencyId") REFERENCES "CastingAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CastingAuditionSubmission" ADD CONSTRAINT "CastingAuditionSubmission_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "CastingTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CastingTalentAvailability" ADD CONSTRAINT "CastingTalentAvailability_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "CastingTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
