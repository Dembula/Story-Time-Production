-- Link executive review requests to studio sessions
ALTER TABLE "ScriptReviewSession" ADD COLUMN "reviewRequestId" TEXT;

CREATE UNIQUE INDEX "ScriptReviewSession_reviewRequestId_key" ON "ScriptReviewSession"("reviewRequestId");

ALTER TABLE "ScriptReviewSession" ADD CONSTRAINT "ScriptReviewSession_reviewRequestId_fkey" FOREIGN KEY ("reviewRequestId") REFERENCES "ScriptReviewRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
