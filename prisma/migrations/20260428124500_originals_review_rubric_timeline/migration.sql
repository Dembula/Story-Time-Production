ALTER TABLE "OriginalPitch"
  ADD COLUMN IF NOT EXISTS "reviewRubric" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewReasonCodes" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewWeightedScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "submissionTimeline" JSONB,
  ADD COLUMN IF NOT EXISTS "resubmissionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "OriginalPitch"
SET "submissionTimeline" = COALESCE(
  "submissionTimeline",
  jsonb_build_array(
    jsonb_build_object(
      'type', 'SUBMITTED',
      'at', "createdAt",
      'note', 'Initial submission'
    )
  )
)
WHERE "submissionTimeline" IS NULL;
