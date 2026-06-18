-- Viewer subscription billing interval + dunning
ALTER TABLE "ViewerSubscription" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'month';
ALTER TABLE "ViewerSubscription" ADD COLUMN IF NOT EXISTS "renewalAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ViewerSubscription" ADD COLUMN IF NOT EXISTS "pastDueSince" TIMESTAMP(3);

-- Company subscription dunning
ALTER TABLE "CompanySubscription" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'month';
ALTER TABLE "CompanySubscription" ADD COLUMN IF NOT EXISTS "renewalAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompanySubscription" ADD COLUMN IF NOT EXISTS "pastDueSince" TIMESTAMP(3);

-- Creator license auto-renewal
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "renewalAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "pastDueSince" TIMESTAMP(3);
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "lastPaymentStatus" TEXT;
ALTER TABLE "CreatorDistributionLicense" ADD COLUMN IF NOT EXISTS "lastPaymentError" TEXT;
