-- Edit review guest invites + guest identity on review notes
ALTER TABLE "ReviewNote" ADD COLUMN IF NOT EXISTS "guestName" TEXT;
ALTER TABLE "ReviewNote" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;

CREATE TABLE IF NOT EXISTS "EditReviewGuestInvite" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "reviewId" TEXT NOT NULL REFERENCES "PostProductionReview"("id") ON DELETE CASCADE ON UPDATE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS "EditReviewGuestInvite_token_key" ON "EditReviewGuestInvite"("token");
CREATE INDEX IF NOT EXISTS "EditReviewGuestInvite_reviewId_idx" ON "EditReviewGuestInvite"("reviewId");
CREATE INDEX IF NOT EXISTS "EditReviewGuestInvite_projectId_idx" ON "EditReviewGuestInvite"("projectId");
CREATE INDEX IF NOT EXISTS "EditReviewGuestInvite_createdById_idx" ON "EditReviewGuestInvite"("createdById");

CREATE TABLE IF NOT EXISTS "EditReviewGuestSession" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "inviteId" TEXT NOT NULL REFERENCES "EditReviewGuestInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestEmail" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "EditReviewGuestSession_token_key" ON "EditReviewGuestSession"("token");
CREATE INDEX IF NOT EXISTS "EditReviewGuestSession_inviteId_idx" ON "EditReviewGuestSession"("inviteId");
