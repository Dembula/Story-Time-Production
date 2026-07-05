-- Funding programs (admin + funder-managed) and privacy-safe marketplace listings

CREATE TABLE IF NOT EXISTS "FundingProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "programType" TEXT NOT NULL DEFAULT 'GRANT',
    "funderType" TEXT NOT NULL DEFAULT 'INSTITUTIONAL',
    "managedBy" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdByUserId" TEXT NOT NULL,
    "funderProfileId" TEXT,
    "minAmount" DOUBLE PRECISION,
    "maxAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "categories" TEXT,
    "requirements" TEXT,
    "applicationDeadline" TIMESTAMP(3),
    "contactEmail" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FundingProgramApplication" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "documentFlags" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingProgramApplication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvestmentOpportunity" ADD COLUMN IF NOT EXISTS "publicListingMeta" JSONB;
ALTER TABLE "DealPayment" ADD COLUMN IF NOT EXISTS "paymentTransactionId" TEXT;

CREATE INDEX IF NOT EXISTS "FundingProgram_status_idx" ON "FundingProgram"("status");
CREATE INDEX IF NOT EXISTS "FundingProgram_managedBy_idx" ON "FundingProgram"("managedBy");
CREATE INDEX IF NOT EXISTS "FundingProgram_funderProfileId_idx" ON "FundingProgram"("funderProfileId");
CREATE INDEX IF NOT EXISTS "FundingProgram_visible_idx" ON "FundingProgram"("visible");

CREATE INDEX IF NOT EXISTS "FundingProgramApplication_programId_idx" ON "FundingProgramApplication"("programId");
CREATE INDEX IF NOT EXISTS "FundingProgramApplication_projectId_idx" ON "FundingProgramApplication"("projectId");
CREATE INDEX IF NOT EXISTS "FundingProgramApplication_creatorUserId_idx" ON "FundingProgramApplication"("creatorUserId");
CREATE INDEX IF NOT EXISTS "FundingProgramApplication_status_idx" ON "FundingProgramApplication"("status");

ALTER TABLE "FundingProgram" ADD CONSTRAINT "FundingProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingProgram" ADD CONSTRAINT "FundingProgram_funderProfileId_fkey" FOREIGN KEY ("funderProfileId") REFERENCES "FunderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FundingProgramApplication" ADD CONSTRAINT "FundingProgramApplication_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FundingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingProgramApplication" ADD CONSTRAINT "FundingProgramApplication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundingProgramApplication" ADD CONSTRAINT "FundingProgramApplication_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
