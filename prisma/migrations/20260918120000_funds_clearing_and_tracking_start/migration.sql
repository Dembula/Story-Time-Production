-- Funds clearing clock + creator revenue tracking start date
ALTER TABLE "PlatformRevenueConnector" ADD COLUMN IF NOT EXISTS "trackingStartedAt" TIMESTAMP(3);
ALTER TABLE "PlatformRevenueConnectorHistory" ADD COLUMN IF NOT EXISTS "trackingStartedAt" TIMESTAMP(3);

ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "fundsClearDueAt" TIMESTAMP(3);
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "fundsClearedAt" TIMESTAMP(3);
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "fundsClearedMode" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "fundsClearedByUserId" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "ledgerAllocatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PaymentRecord_fundsClearDueAt_idx" ON "PaymentRecord"("fundsClearDueAt");
CREATE INDEX IF NOT EXISTS "PaymentRecord_fundsClearedAt_idx" ON "PaymentRecord"("fundsClearedAt");
