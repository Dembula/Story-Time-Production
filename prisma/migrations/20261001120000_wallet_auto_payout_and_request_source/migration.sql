-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "autoPayoutEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Wallet" ADD COLUMN IF NOT EXISTS "autoPayoutUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "requestSource" TEXT NOT NULL DEFAULT 'manual';
