-- AlterTable
ALTER TABLE "MeetMeeting" ADD COLUMN IF NOT EXISTS "scheduledEndAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeetMeeting_scheduledEndAt_idx" ON "MeetMeeting"("scheduledEndAt");
