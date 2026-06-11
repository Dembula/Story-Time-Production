-- AlterTable
ALTER TABLE "BreakdownLocation" ADD COLUMN     "marketplaceLinkedAt" TIMESTAMP(3),
ADD COLUMN     "marketplaceLinkedBy" TEXT,
ADD COLUMN     "marketplaceMatchNote" TEXT;

-- AlterTable
ALTER TABLE "CastingRole" ADD COLUMN     "dailyRate" DOUBLE PRECISION,
ADD COLUMN     "importance" TEXT;

-- AlterTable
ALTER TABLE "CastingTalent" ADD COLUMN     "dailyRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CrewRoleNeed" ADD COLUMN     "dailyRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CrewTeamMember" ADD COLUMN     "dailyRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "EquipmentListing" ADD COLUMN     "dailyRate" DOUBLE PRECISION,
ADD COLUMN     "quantityAvailable" INTEGER;

-- AlterTable
ALTER TABLE "ModocActionLog" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "ProjectBudget" ADD COLUMN     "estimatedShootDays" INTEGER,
ADD COLUMN     "generationSource" TEXT,
ADD COLUMN     "inferredRegion" TEXT,
ADD COLUMN     "lastGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "lastGeneratedById" TEXT;

-- CreateTable
CREATE TABLE "ProjectProductionContext" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "primaryCity" TEXT,
    "country" TEXT NOT NULL DEFAULT 'South Africa',
    "regionLabel" TEXT,
    "estimatedShootDays" INTEGER NOT NULL DEFAULT 1,
    "intSceneCount" INTEGER NOT NULL DEFAULT 0,
    "extSceneCount" INTEGER NOT NULL DEFAULT 0,
    "settingHints" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProductionContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBudgetAssumption" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBudgetAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProductionContext_projectId_key" ON "ProjectProductionContext"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBudgetAssumption_projectId_idx" ON "ProjectBudgetAssumption"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBudgetAssumption_budgetId_idx" ON "ProjectBudgetAssumption"("budgetId");

-- CreateIndex
CREATE INDEX "ProjectBudgetAssumption_category_idx" ON "ProjectBudgetAssumption"("category");

-- CreateIndex
CREATE INDEX "ModocActionLog_projectId_idx" ON "ModocActionLog"("projectId");

-- CreateIndex
CREATE INDEX "ModocActionLog_userId_projectId_idx" ON "ModocActionLog"("userId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectBudget_lastGeneratedById_idx" ON "ProjectBudget"("lastGeneratedById");

-- AddForeignKey
ALTER TABLE "ProjectBudget" ADD CONSTRAINT "ProjectBudget_lastGeneratedById_fkey" FOREIGN KEY ("lastGeneratedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProductionContext" ADD CONSTRAINT "ProjectProductionContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetAssumption" ADD CONSTRAINT "ProjectBudgetAssumption_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBudgetAssumption" ADD CONSTRAINT "ProjectBudgetAssumption_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
