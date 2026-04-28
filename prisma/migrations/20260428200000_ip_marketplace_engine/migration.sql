-- Backfill missing table for environments where CreatorScript migration was never committed.
CREATE TABLE IF NOT EXISTS "CreatorScript" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorScript_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CreatorScript_userId_idx" ON "CreatorScript"("userId");
CREATE INDEX IF NOT EXISTS "CreatorScript_projectId_idx" ON "CreatorScript"("projectId");
CREATE INDEX IF NOT EXISTS "CreatorScript_userId_projectId_idx" ON "CreatorScript"("userId", "projectId");
DO $$ BEGIN
  ALTER TABLE "CreatorScript"
    ADD CONSTRAINT "CreatorScript_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CreatorScript"
    ADD CONSTRAINT "CreatorScript_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "IPAsset" (
    "id" TEXT NOT NULL,
    "creatorScriptId" TEXT,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "synopsis" TEXT,
    "genre" TEXT,
    "language" TEXT,
    "themes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentOwnerId" TEXT NOT NULL,
    "originalCreatorId" TEXT NOT NULL,
    "monetizationModel" TEXT NOT NULL DEFAULT 'SALE_FULL_RIGHTS',
    "listingPrice" DOUBLE PRECISION,
    "listingCurrency" TEXT NOT NULL DEFAULT 'ZAR',
    "listedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IPVersion" (
    "id" TEXT NOT NULL,
    "ipAssetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "fileUrl" TEXT,
    "content" TEXT,
    "contentHash" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IPOwnershipStructure" (
    "id" TEXT NOT NULL,
    "ipAssetId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "ownershipPercentage" DOUBLE PRECISION NOT NULL,
    "rightsType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPOwnershipStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IPLicensingAgreement" (
    "id" TEXT NOT NULL,
    "ipAssetId" TEXT NOT NULL,
    "licensorId" TEXT NOT NULL,
    "licenseeId" TEXT NOT NULL,
    "licenseType" TEXT NOT NULL,
    "territory" TEXT,
    "duration" TEXT,
    "revenueSharePercentage" DOUBLE PRECISION,
    "contractUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPLicensingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IPTransaction" (
    "id" TEXT NOT NULL,
    "ipAssetId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "IPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IPAsset_creatorScriptId_key" ON "IPAsset"("creatorScriptId");
CREATE INDEX IF NOT EXISTS "IPAsset_currentOwnerId_idx" ON "IPAsset"("currentOwnerId");
CREATE INDEX IF NOT EXISTS "IPAsset_originalCreatorId_idx" ON "IPAsset"("originalCreatorId");
CREATE INDEX IF NOT EXISTS "IPAsset_status_idx" ON "IPAsset"("status");
CREATE INDEX IF NOT EXISTS "IPAsset_creatorScriptId_idx" ON "IPAsset"("creatorScriptId");

CREATE UNIQUE INDEX IF NOT EXISTS "IPVersion_ipAssetId_versionNumber_key" ON "IPVersion"("ipAssetId", "versionNumber");
CREATE INDEX IF NOT EXISTS "IPVersion_ipAssetId_idx" ON "IPVersion"("ipAssetId");

CREATE INDEX IF NOT EXISTS "IPOwnershipStructure_ipAssetId_idx" ON "IPOwnershipStructure"("ipAssetId");
CREATE INDEX IF NOT EXISTS "IPOwnershipStructure_ownerId_idx" ON "IPOwnershipStructure"("ownerId");
CREATE INDEX IF NOT EXISTS "IPOwnershipStructure_startDate_endDate_idx" ON "IPOwnershipStructure"("startDate", "endDate");

CREATE INDEX IF NOT EXISTS "IPLicensingAgreement_ipAssetId_idx" ON "IPLicensingAgreement"("ipAssetId");
CREATE INDEX IF NOT EXISTS "IPLicensingAgreement_licensorId_idx" ON "IPLicensingAgreement"("licensorId");
CREATE INDEX IF NOT EXISTS "IPLicensingAgreement_licenseeId_idx" ON "IPLicensingAgreement"("licenseeId");
CREATE INDEX IF NOT EXISTS "IPLicensingAgreement_status_idx" ON "IPLicensingAgreement"("status");

CREATE INDEX IF NOT EXISTS "IPTransaction_ipAssetId_idx" ON "IPTransaction"("ipAssetId");
CREATE INDEX IF NOT EXISTS "IPTransaction_buyerId_idx" ON "IPTransaction"("buyerId");
CREATE INDEX IF NOT EXISTS "IPTransaction_sellerId_idx" ON "IPTransaction"("sellerId");
CREATE INDEX IF NOT EXISTS "IPTransaction_date_idx" ON "IPTransaction"("date");

-- AddForeignKey
DO $$ BEGIN
ALTER TABLE "IPAsset"
  ADD CONSTRAINT "IPAsset_creatorScriptId_fkey"
  FOREIGN KEY ("creatorScriptId") REFERENCES "CreatorScript"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPAsset"
  ADD CONSTRAINT "IPAsset_currentOwnerId_fkey"
  FOREIGN KEY ("currentOwnerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPAsset"
  ADD CONSTRAINT "IPAsset_originalCreatorId_fkey"
  FOREIGN KEY ("originalCreatorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "IPVersion"
  ADD CONSTRAINT "IPVersion_ipAssetId_fkey"
  FOREIGN KEY ("ipAssetId") REFERENCES "IPAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "IPOwnershipStructure"
  ADD CONSTRAINT "IPOwnershipStructure_ipAssetId_fkey"
  FOREIGN KEY ("ipAssetId") REFERENCES "IPAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPOwnershipStructure"
  ADD CONSTRAINT "IPOwnershipStructure_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "IPLicensingAgreement"
  ADD CONSTRAINT "IPLicensingAgreement_ipAssetId_fkey"
  FOREIGN KEY ("ipAssetId") REFERENCES "IPAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPLicensingAgreement"
  ADD CONSTRAINT "IPLicensingAgreement_licensorId_fkey"
  FOREIGN KEY ("licensorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPLicensingAgreement"
  ADD CONSTRAINT "IPLicensingAgreement_licenseeId_fkey"
  FOREIGN KEY ("licenseeId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "IPTransaction"
  ADD CONSTRAINT "IPTransaction_ipAssetId_fkey"
  FOREIGN KEY ("ipAssetId") REFERENCES "IPAsset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPTransaction"
  ADD CONSTRAINT "IPTransaction_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "IPTransaction"
  ADD CONSTRAINT "IPTransaction_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
