-- Script review guest invites + optional guest authors on annotations
ALTER TABLE "ScriptReviewAnnotation" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "ScriptReviewAnnotation" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "ScriptReviewAnnotation" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;

CREATE TABLE IF NOT EXISTS "ScriptReviewGuestInvite" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sessionId" TEXT NOT NULL REFERENCES "ScriptReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "projectId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "durationKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScriptReviewGuestInvite_token_key" ON "ScriptReviewGuestInvite"("token");
CREATE INDEX IF NOT EXISTS "ScriptReviewGuestInvite_sessionId_idx" ON "ScriptReviewGuestInvite"("sessionId");
CREATE INDEX IF NOT EXISTS "ScriptReviewGuestInvite_projectId_idx" ON "ScriptReviewGuestInvite"("projectId");
CREATE INDEX IF NOT EXISTS "ScriptReviewGuestInvite_createdById_idx" ON "ScriptReviewGuestInvite"("createdById");

CREATE TABLE IF NOT EXISTS "ScriptReviewGuestSession" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "inviteId" TEXT NOT NULL REFERENCES "ScriptReviewGuestInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestEmail" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScriptReviewGuestSession_token_key" ON "ScriptReviewGuestSession"("token");
CREATE INDEX IF NOT EXISTS "ScriptReviewGuestSession_inviteId_idx" ON "ScriptReviewGuestSession"("inviteId");
