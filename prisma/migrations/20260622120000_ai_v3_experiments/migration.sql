-- AI V3: A/B experiment tracking on request logs
ALTER TABLE "AiRequestLog" ADD COLUMN IF NOT EXISTS "experimentVariant" TEXT;
ALTER TABLE "AiRequestLog" ADD COLUMN IF NOT EXISTS "taskKind" TEXT;

CREATE INDEX IF NOT EXISTS "AiRequestLog_experimentVariant_createdAt_idx"
  ON "AiRequestLog"("experimentVariant", "createdAt");
