-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "linkedProjectId" TEXT,
ADD COLUMN     "reviewFeedback" JSONB;

-- CreateIndex
CREATE INDEX "Content_linkedProjectId_idx" ON "Content"("linkedProjectId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_linkedProjectId_fkey" FOREIGN KEY ("linkedProjectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
