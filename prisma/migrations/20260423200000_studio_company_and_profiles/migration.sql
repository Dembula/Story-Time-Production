-- Studio company + creator profiles (film/music multi-workspace). Safe if partially applied.

CREATE TABLE IF NOT EXISTS "StudioCompany" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "seatCap" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioCompany_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudioCompany_ownerUserId_idx" ON "StudioCompany"("ownerUserId");

CREATE TABLE IF NOT EXISTS "CreatorStudioProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "displayName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "pipelineDisabledByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "pipelineSectionMask" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorStudioProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreatorStudioProfile_userId_idx" ON "CreatorStudioProfile"("userId");
CREATE INDEX IF NOT EXISTS "CreatorStudioProfile_companyId_idx" ON "CreatorStudioProfile"("companyId");

DO $$ BEGIN
 ALTER TABLE "CreatorStudioProfile" ADD CONSTRAINT "CreatorStudioProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "CreatorStudioProfile" ADD CONSTRAINT "CreatorStudioProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "StudioCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "StudioCompany" ADD CONSTRAINT "StudioCompany_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeCreatorStudioProfileId" TEXT;

DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_activeCreatorStudioProfileId_fkey" FOREIGN KEY ("activeCreatorStudioProfileId") REFERENCES "CreatorStudioProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "creatorStudioProfileId" TEXT;

DO $$ BEGIN
 ALTER TABLE "CreatorDistributionLicense" ADD CONSTRAINT "CreatorDistributionLicense_creatorStudioProfileId_key" UNIQUE ("creatorStudioProfileId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "CreatorDistributionLicense" ADD CONSTRAINT "CreatorDistributionLicense_creatorStudioProfileId_fkey" FOREIGN KEY ("creatorStudioProfileId") REFERENCES "CreatorStudioProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "CreatorDistributionLicense_creatorStudioProfileId_idx" ON "CreatorDistributionLicense"("creatorStudioProfileId");
