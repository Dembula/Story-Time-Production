-- Global free-trial on/off (viewer + creator). Default OFF.
CREATE TABLE IF NOT EXISTS "PlatformFreeTrialSettings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "freeTrialsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformFreeTrialSettings_updatedAt_idx"
  ON "PlatformFreeTrialSettings"("updatedAt");

CREATE TABLE IF NOT EXISTS "PlatformFreeTrialSettingsHistory" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "settingsId" TEXT,
  "freeTrialsEnabled" BOOLEAN NOT NULL,
  "note" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformFreeTrialSettingsHistory_createdAt_idx"
  ON "PlatformFreeTrialSettingsHistory"("createdAt");

-- Ensure a singleton row exists and trials start disabled.
INSERT INTO "PlatformFreeTrialSettings" ("id", "freeTrialsEnabled", "note", "createdAt", "updatedAt")
SELECT
  'platform-free-trial-settings',
  false,
  'Default: free trials paused until an admin enables them.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "PlatformFreeTrialSettings" LIMIT 1);

UPDATE "PlatformFreeTrialSettings"
SET "freeTrialsEnabled" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "freeTrialsEnabled" = true;
