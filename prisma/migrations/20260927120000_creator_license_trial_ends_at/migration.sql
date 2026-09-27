-- Track App Store / Play free trials on creator pipeline licenses.
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CreatorDistributionLicense_trialEndsAt_idx" ON "CreatorDistributionLicense"("trialEndsAt");
