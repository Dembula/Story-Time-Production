-- CreateTable
CREATE TABLE "CreatorTreatment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled Treatment',
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorTreatment_userId_idx" ON "CreatorTreatment"("userId");

-- CreateIndex
CREATE INDEX "CreatorTreatment_projectId_idx" ON "CreatorTreatment"("projectId");

-- CreateIndex
CREATE INDEX "CreatorTreatment_userId_projectId_idx" ON "CreatorTreatment"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "CreatorTreatment" ADD CONSTRAINT "CreatorTreatment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorTreatment" ADD CONSTRAINT "CreatorTreatment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
