ALTER TABLE "WatchSession" ADD COLUMN IF NOT EXISTS "countsForCreatorRevenue" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "WatchSession_countsForCreatorRevenue_startedAt_idx"
  ON "WatchSession" ("countsForCreatorRevenue", "startedAt");

-- Exclude catalogue views recorded before the viewer had any succeeded subscription payment.
UPDATE "WatchSession" ws
SET "countsForCreatorRevenue" = false
WHERE ws."countsForCreatorRevenue" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "PaymentRecord" pr
    INNER JOIN "ViewerSubscription" vs ON vs.id = pr."relatedEntityId"
    WHERE pr."relatedEntityType" = 'ViewerSubscription'
      AND pr.status = 'SUCCEEDED'
      AND vs."userId" = ws."userId"
      AND pr."paidAt" IS NOT NULL
      AND pr."paidAt" <= ws."startedAt"
  )
  AND EXISTS (
    SELECT 1
    FROM "ViewerSubscription" vs
    WHERE vs."userId" = ws."userId"
      AND vs."viewerModel" = 'SUBSCRIPTION'
  );
