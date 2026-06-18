-- PayFast ITN reconciliation: track provider payment ids and webhook processing state.

ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "providerPaymentId" TEXT;
ALTER TABLE "PaymentRecord" ADD COLUMN IF NOT EXISTS "providerItnStatus" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentRecord_providerPaymentId_idx" ON "PaymentRecord"("providerPaymentId");

ALTER TABLE "PaymentWebhookEvent" ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN IF NOT EXISTS "processingError" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_reference_idx" ON "PaymentWebhookEvent"("provider", "reference");
