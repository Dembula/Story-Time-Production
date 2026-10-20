-- Festival portal domain

CREATE TABLE IF NOT EXISTS "Festival" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "awardsText" TEXT,
    "rulesText" TEXT,
    "yearsRunning" INTEGER NOT NULL DEFAULT 1,
    "logoUrl" TEXT,
    "headerImageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "acceptingSubmissions" BOOLEAN NOT NULL DEFAULT true,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "websiteUrl" TEXT,
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "venues" JSONB,
    "organizers" TEXT,
    "openingAt" TIMESTAMP(3),
    "earlybirdAt" TIMESTAMP(3),
    "regularAt" TIMESTAMP(3),
    "lateAt" TIMESTAMP(3),
    "notificationAt" TIMESTAMP(3),
    "eventStartsAt" TIMESTAMP(3),
    "eventEndsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Festival_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Festival_slug_key" ON "Festival"("slug");
CREATE INDEX IF NOT EXISTS "Festival_ownerUserId_idx" ON "Festival"("ownerUserId");
CREATE INDEX IF NOT EXISTS "Festival_status_idx" ON "Festival"("status");

CREATE TABLE IF NOT EXISTS "FestivalCategory" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "earlybirdFeeZar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regularFeeZar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateFeeZar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalCategory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FestivalCategory_festivalId_idx" ON "FestivalCategory"("festivalId");

CREATE TABLE IF NOT EXISTS "FestivalMediaAsset" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalMediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FestivalMediaAsset_festivalId_idx" ON "FestivalMediaAsset"("festivalId");

CREATE TABLE IF NOT EXISTS "FestivalMembership" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalMembership_festivalId_userId_key" ON "FestivalMembership"("festivalId", "userId");
CREATE INDEX IF NOT EXISTS "FestivalMembership_userId_idx" ON "FestivalMembership"("userId");

CREATE TABLE IF NOT EXISTS "FestivalTeamInvite" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "emailNorm" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STAGE1_REVIEWER',
    "personalMessage" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalTeamInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalTeamInvite_token_key" ON "FestivalTeamInvite"("token");
CREATE INDEX IF NOT EXISTS "FestivalTeamInvite_festivalId_idx" ON "FestivalTeamInvite"("festivalId");
CREATE INDEX IF NOT EXISTS "FestivalTeamInvite_emailNorm_idx" ON "FestivalTeamInvite"("emailNorm");
CREATE INDEX IF NOT EXISTS "FestivalTeamInvite_status_idx" ON "FestivalTeamInvite"("status");

CREATE TABLE IF NOT EXISTS "FestivalFlagDef" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'GRAY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalFlagDef_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FestivalFlagDef_festivalId_idx" ON "FestivalFlagDef"("festivalId");

CREATE TABLE IF NOT EXISTS "FestivalSubmission" (
    "id" TEXT NOT NULL,
    "festivalId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "creatorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "synopsis" TEXT,
    "formPayload" JSONB,
    "screenerUrl" TEXT,
    "trailerUrl" TEXT,
    "stillUrls" JSONB,
    "feeAmountZar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentRecordId" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "reviewStage" TEXT NOT NULL DEFAULT 'STAGE1',
    "stage1Group" TEXT,
    "escalateFlag" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "customFlagIds" JSONB,
    "selectionStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "universeOptIn" BOOLEAN NOT NULL DEFAULT false,
    "screeningOrder" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FestivalSubmission_festivalId_idx" ON "FestivalSubmission"("festivalId");
CREATE INDEX IF NOT EXISTS "FestivalSubmission_creatorUserId_idx" ON "FestivalSubmission"("creatorUserId");
CREATE INDEX IF NOT EXISTS "FestivalSubmission_categoryId_idx" ON "FestivalSubmission"("categoryId");
CREATE INDEX IF NOT EXISTS "FestivalSubmission_paymentStatus_idx" ON "FestivalSubmission"("paymentStatus");
CREATE INDEX IF NOT EXISTS "FestivalSubmission_reviewStage_idx" ON "FestivalSubmission"("reviewStage");
CREATE INDEX IF NOT EXISTS "FestivalSubmission_selectionStatus_idx" ON "FestivalSubmission"("selectionStatus");

CREATE TABLE IF NOT EXISTS "FestivalStage1Review" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "escalateFlag" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalStage1Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalStage1Review_submissionId_reviewerUserId_key" ON "FestivalStage1Review"("submissionId", "reviewerUserId");
CREATE INDEX IF NOT EXISTS "FestivalStage1Review_reviewerUserId_idx" ON "FestivalStage1Review"("reviewerUserId");

CREATE TABLE IF NOT EXISTS "FestivalStage2Review" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "overallThoughts" TEXT,
    "acceptReason" TEXT,
    "declineReason" TEXT,
    "craftNotes" TEXT,
    "recommendation" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FestivalStage2Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FestivalStage2Review_submissionId_reviewerUserId_key" ON "FestivalStage2Review"("submissionId", "reviewerUserId");
CREATE INDEX IF NOT EXISTS "FestivalStage2Review_reviewerUserId_idx" ON "FestivalStage2Review"("reviewerUserId");

ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "festivalHoldFestivalId" TEXT;
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "festivalSubmissionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Content_festivalSubmissionId_key" ON "Content"("festivalSubmissionId");
CREATE INDEX IF NOT EXISTS "Content_festivalHoldFestivalId_idx" ON "Content"("festivalHoldFestivalId");

DO $$ BEGIN
  ALTER TABLE "Festival" ADD CONSTRAINT "Festival_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalCategory" ADD CONSTRAINT "FestivalCategory_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalMediaAsset" ADD CONSTRAINT "FestivalMediaAsset_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalMembership" ADD CONSTRAINT "FestivalMembership_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalMembership" ADD CONSTRAINT "FestivalMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalTeamInvite" ADD CONSTRAINT "FestivalTeamInvite_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalTeamInvite" ADD CONSTRAINT "FestivalTeamInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalTeamInvite" ADD CONSTRAINT "FestivalTeamInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalFlagDef" ADD CONSTRAINT "FestivalFlagDef_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalSubmission" ADD CONSTRAINT "FestivalSubmission_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalSubmission" ADD CONSTRAINT "FestivalSubmission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FestivalCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalSubmission" ADD CONSTRAINT "FestivalSubmission_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalStage1Review" ADD CONSTRAINT "FestivalStage1Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FestivalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalStage1Review" ADD CONSTRAINT "FestivalStage1Review_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalStage2Review" ADD CONSTRAINT "FestivalStage2Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FestivalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FestivalStage2Review" ADD CONSTRAINT "FestivalStage2Review_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Content" ADD CONSTRAINT "Content_festivalHoldFestivalId_fkey" FOREIGN KEY ("festivalHoldFestivalId") REFERENCES "Festival"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Content" ADD CONSTRAINT "Content_festivalSubmissionId_fkey" FOREIGN KEY ("festivalSubmissionId") REFERENCES "FestivalSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
