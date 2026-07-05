-- Post-contract cast/crew hire salary settlement
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "paymentTransactionId" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "hireAmount" DOUBLE PRECISION;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ProjectContract_paymentTransactionId_idx" ON "ProjectContract"("paymentTransactionId");
