-- Platform revenue connector: pause/resume creator-facing revenue attribution.
CREATE TABLE IF NOT EXISTS "PlatformRevenueConnector" (
    "id" TEXT NOT NULL,
    "creatorRevenueTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRevenueConnector_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformRevenueConnector_updatedAt_idx" ON "PlatformRevenueConnector"("updatedAt");

CREATE TABLE IF NOT EXISTS "PlatformRevenueConnectorHistory" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT,
    "creatorRevenueTrackingEnabled" BOOLEAN NOT NULL,
    "note" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRevenueConnectorHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformRevenueConnectorHistory_createdAt_idx" ON "PlatformRevenueConnectorHistory"("createdAt");

-- Seed paused (creators do not see earnings until admin enables tracking).
INSERT INTO "PlatformRevenueConnector" ("id", "creatorRevenueTrackingEnabled", "note", "createdAt", "updatedAt")
SELECT
  'revconn_seed_001',
  false,
  'Seeded paused after creator revenue clean slate',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "PlatformRevenueConnector" LIMIT 1);
