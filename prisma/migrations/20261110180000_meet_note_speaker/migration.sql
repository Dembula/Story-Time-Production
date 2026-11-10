-- AlterTable
ALTER TABLE "MeetNote" ADD COLUMN IF NOT EXISTS "speakerName" TEXT;
ALTER TABLE "MeetNote" ADD COLUMN IF NOT EXISTS "speakerPeerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeetNote_meetingId_source_idx" ON "MeetNote"("meetingId", "source");
