-- Support photograph / still uploads alongside camera clips in Dailies Review.

ALTER TABLE "DailiesClip" ADD COLUMN IF NOT EXISTS "mediaType" TEXT NOT NULL DEFAULT 'video';

CREATE INDEX IF NOT EXISTS "DailiesClip_mediaType_idx" ON "DailiesClip"("mediaType");
