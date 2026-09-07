-- Editable finance fee schedule + audit history
CREATE TABLE IF NOT EXISTS "FinanceFeeSettings" (
    "id" TEXT NOT NULL,
    "appleCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2607532510836946,
    "viewerCreatorSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "viewerPlatformSplit" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "marketplaceFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
    "note" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceFeeSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceFeeSettings_updatedAt_idx" ON "FinanceFeeSettings"("updatedAt");

CREATE TABLE IF NOT EXISTS "FinanceFeeSettingsHistory" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT,
    "appleCommissionRate" DOUBLE PRECISION NOT NULL,
    "viewerCreatorSplit" DOUBLE PRECISION NOT NULL,
    "viewerPlatformSplit" DOUBLE PRECISION NOT NULL,
    "marketplaceFeeRate" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceFeeSettingsHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FinanceFeeSettingsHistory_createdAt_idx" ON "FinanceFeeSettingsHistory"("createdAt");
