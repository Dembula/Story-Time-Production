-- Project collaborator email invites (invite by email, not only network connections).
CREATE TABLE IF NOT EXISTS "ProjectCollaboratorInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "emailNorm" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Collaborator',
    "department" TEXT,
    "personalMessage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectCollaboratorInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCollaboratorInvite_token_key" ON "ProjectCollaboratorInvite"("token");
CREATE INDEX IF NOT EXISTS "ProjectCollaboratorInvite_projectId_idx" ON "ProjectCollaboratorInvite"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectCollaboratorInvite_emailNorm_idx" ON "ProjectCollaboratorInvite"("emailNorm");
CREATE INDEX IF NOT EXISTS "ProjectCollaboratorInvite_invitedUserId_idx" ON "ProjectCollaboratorInvite"("invitedUserId");
CREATE INDEX IF NOT EXISTS "ProjectCollaboratorInvite_status_idx" ON "ProjectCollaboratorInvite"("status");

DO $$ BEGIN
  ALTER TABLE "ProjectCollaboratorInvite"
    ADD CONSTRAINT "ProjectCollaboratorInvite_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectCollaboratorInvite"
    ADD CONSTRAINT "ProjectCollaboratorInvite_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectCollaboratorInvite"
    ADD CONSTRAINT "ProjectCollaboratorInvite_invitedUserId_fkey"
    FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
