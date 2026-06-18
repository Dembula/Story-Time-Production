-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "declineReason" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "proofReference" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "PayoutRequest" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

-- Align default status for new payout requests
ALTER TABLE "PayoutRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';
