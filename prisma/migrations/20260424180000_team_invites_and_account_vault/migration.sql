-- Team invites + extended account vault (compliance / business profile JSON).

ALTER TABLE "CreatorStudioProfile" ADD COLUMN IF NOT EXISTS "teamRole" TEXT;

CREATE TABLE IF NOT EXISTS "CreatorStudioTeamInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "emailNorm" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suiteAccess" JSONB,
    "personalMessage" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorStudioTeamInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorStudioTeamInvite_token_key" ON "CreatorStudioTeamInvite"("token");
CREATE INDEX IF NOT EXISTS "CreatorStudioTeamInvite_companyId_idx" ON "CreatorStudioTeamInvite"("companyId");
CREATE INDEX IF NOT EXISTS "CreatorStudioTeamInvite_emailNorm_idx" ON "CreatorStudioTeamInvite"("emailNorm");
CREATE INDEX IF NOT EXISTS "CreatorStudioTeamInvite_invitedUserId_idx" ON "CreatorStudioTeamInvite"("invitedUserId");

DO $$ BEGIN
 ALTER TABLE "CreatorStudioTeamInvite" ADD CONSTRAINT "CreatorStudioTeamInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "StudioCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "CreatorStudioTeamInvite" ADD CONSTRAINT "CreatorStudioTeamInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
 ALTER TABLE "CreatorStudioTeamInvite" ADD CONSTRAINT "CreatorStudioTeamInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CreatorAccountProfileVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorAccountProfileVault_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorAccountProfileVault_userId_key" ON "CreatorAccountProfileVault"("userId");

DO $$ BEGIN
 ALTER TABLE "CreatorAccountProfileVault" ADD CONSTRAINT "CreatorAccountProfileVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
