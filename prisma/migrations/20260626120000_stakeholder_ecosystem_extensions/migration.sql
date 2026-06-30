-- Stakeholder ecosystem extensions: talent portal, location managers, RFID inventory, meal forecasts, sync events

CREATE TABLE IF NOT EXISTS "CastingTalentPortalToken" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CastingTalentPortalToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LocationListingManager" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "canApproveBookings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationListingManager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EquipmentInventoryTag" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfidTag" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "lastScanAt" TIMESTAMP(3),
    "lastScanLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EquipmentInventoryTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CateringMealForecast" (
    "id" TEXT NOT NULL,
    "cateringCompanyId" TEXT NOT NULL,
    "projectId" TEXT,
    "eventDate" TEXT NOT NULL,
    "headCount" INTEGER NOT NULL,
    "breakfastCount" INTEGER NOT NULL DEFAULT 0,
    "lunchCount" INTEGER NOT NULL DEFAULT 0,
    "dinnerCount" INTEGER NOT NULL DEFAULT 0,
    "specialDiets" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CateringMealForecast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StakeholderSyncEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StakeholderSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CastingTalentPortalToken_token_key" ON "CastingTalentPortalToken"("token");
CREATE INDEX IF NOT EXISTS "CastingTalentPortalToken_talentId_idx" ON "CastingTalentPortalToken"("talentId");
CREATE UNIQUE INDEX IF NOT EXISTS "LocationListingManager_listingId_userId_key" ON "LocationListingManager"("listingId", "userId");
CREATE INDEX IF NOT EXISTS "LocationListingManager_userId_idx" ON "LocationListingManager"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentInventoryTag_rfidTag_key" ON "EquipmentInventoryTag"("rfidTag");
CREATE INDEX IF NOT EXISTS "EquipmentInventoryTag_equipmentId_idx" ON "EquipmentInventoryTag"("equipmentId");
CREATE INDEX IF NOT EXISTS "EquipmentInventoryTag_companyId_idx" ON "EquipmentInventoryTag"("companyId");
CREATE INDEX IF NOT EXISTS "EquipmentInventoryTag_status_idx" ON "EquipmentInventoryTag"("status");
CREATE INDEX IF NOT EXISTS "CateringMealForecast_cateringCompanyId_idx" ON "CateringMealForecast"("cateringCompanyId");
CREATE INDEX IF NOT EXISTS "CateringMealForecast_projectId_idx" ON "CateringMealForecast"("projectId");
CREATE INDEX IF NOT EXISTS "CateringMealForecast_eventDate_idx" ON "CateringMealForecast"("eventDate");
CREATE INDEX IF NOT EXISTS "StakeholderSyncEvent_projectId_idx" ON "StakeholderSyncEvent"("projectId");
CREATE INDEX IF NOT EXISTS "StakeholderSyncEvent_createdAt_idx" ON "StakeholderSyncEvent"("createdAt");

ALTER TABLE "CastingTalentPortalToken" ADD CONSTRAINT "CastingTalentPortalToken_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "CastingTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationListingManager" ADD CONSTRAINT "LocationListingManager_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "LocationListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationListingManager" ADD CONSTRAINT "LocationListingManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentInventoryTag" ADD CONSTRAINT "EquipmentInventoryTag_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CateringMealForecast" ADD CONSTRAINT "CateringMealForecast_cateringCompanyId_fkey" FOREIGN KEY ("cateringCompanyId") REFERENCES "CateringCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CateringMealForecast" ADD CONSTRAINT "CateringMealForecast_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StakeholderSyncEvent" ADD CONSTRAINT "StakeholderSyncEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
