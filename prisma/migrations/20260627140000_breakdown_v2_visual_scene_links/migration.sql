-- AlterTable
ALTER TABLE "ProjectVisualAsset" ADD COLUMN IF NOT EXISTS "sceneId" TEXT;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectVisualAsset_sceneId_fkey'
  ) THEN
    ALTER TABLE "ProjectVisualAsset" ADD CONSTRAINT "ProjectVisualAsset_sceneId_fkey"
      FOREIGN KEY ("sceneId") REFERENCES "ProjectScene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProjectVisualAsset_sceneId_idx" ON "ProjectVisualAsset"("sceneId");
