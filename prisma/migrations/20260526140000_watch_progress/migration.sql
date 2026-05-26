-- Resume position per viewer profile + title (continue watching)
CREATE TABLE IF NOT EXISTS "WatchProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "viewerProfileId" TEXT NOT NULL,
    "positionSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WatchProgress_viewerProfileId_contentId_key"
    ON "WatchProgress"("viewerProfileId", "contentId");
CREATE INDEX IF NOT EXISTS "WatchProgress_userId_idx" ON "WatchProgress"("userId");
CREATE INDEX IF NOT EXISTS "WatchProgress_contentId_idx" ON "WatchProgress"("contentId");
CREATE INDEX IF NOT EXISTS "WatchProgress_updatedAt_idx" ON "WatchProgress"("updatedAt");

DO $$ BEGIN
    ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_contentId_fkey"
        FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_viewerProfileId_fkey"
        FOREIGN KEY ("viewerProfileId") REFERENCES "ViewerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
