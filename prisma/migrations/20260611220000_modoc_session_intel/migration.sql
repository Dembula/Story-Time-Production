-- CreateTable
CREATE TABLE "ModocSessionIntel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "projectId" TEXT,
    "userIntent" TEXT,
    "actionSuccessRateEstimate" DOUBLE PRECISION NOT NULL,
    "suggestionAcceptanceRate" DOUBLE PRECISION NOT NULL,
    "missingContextFlags" JSONB NOT NULL,
    "nextBestAction" TEXT,
    "nextBestActionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModocSessionIntel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModocSessionIntel_userId_createdAt_idx" ON "ModocSessionIntel"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModocSessionIntel_userId_projectId_idx" ON "ModocSessionIntel"("userId", "projectId");

-- CreateIndex
CREATE INDEX "ModocSessionIntel_conversationId_idx" ON "ModocSessionIntel"("conversationId");

-- AddForeignKey
ALTER TABLE "ModocSessionIntel" ADD CONSTRAINT "ModocSessionIntel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
