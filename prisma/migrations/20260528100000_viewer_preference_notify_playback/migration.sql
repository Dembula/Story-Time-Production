-- Align UserPreference with Prisma schema (init table only had theme/accentColor).
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "notifyEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "playbackQuality" TEXT;
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "profileExtras" JSONB;
