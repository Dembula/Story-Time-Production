-- PayFast settlement tracking: net treasury inflow after gateway fees per payment method.
ALTER TABLE "PaymentRecord"
  ADD COLUMN IF NOT EXISTS "providerPaymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "providerFeeAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "settlementAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "settlementSource" TEXT;
