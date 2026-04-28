-- Add payment/access tables and supporting billing metadata for Paystack flows.

-- Some earlier migration histories do not create this table.
CREATE TABLE IF NOT EXISTS "ViewerPaymentMethod" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "lastFour" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ViewerPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ViewerPaymentMethod_userId_idx" ON "ViewerPaymentMethod"("userId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ViewerPaymentMethod_userId_fkey'
  ) THEN
    ALTER TABLE "ViewerPaymentMethod"
      ADD CONSTRAINT "ViewerPaymentMethod_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ViewerProfile enhancements
ALTER TABLE "ViewerProfile" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

-- ViewerSubscription billing enhancements
ALTER TABLE "ViewerSubscription"
  ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT,
  ADD COLUMN IF NOT EXISTS "viewerModel" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
  ADD COLUMN IF NOT EXISTS "profileLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastPaymentStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPaymentError" TEXT;

CREATE INDEX IF NOT EXISTS "ViewerSubscription_paymentMethodId_idx" ON "ViewerSubscription"("paymentMethodId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ViewerSubscription_paymentMethodId_fkey'
  ) THEN
    ALTER TABLE "ViewerSubscription"
      ADD CONSTRAINT "ViewerSubscription_paymentMethodId_fkey"
      FOREIGN KEY ("paymentMethodId") REFERENCES "ViewerPaymentMethod"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SubscriptionPayment tracking improvements
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "paystackReference" TEXT;
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_paystackReference_idx" ON "SubscriptionPayment"("paystackReference");

-- Transaction tracking improvements
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "paystackReference" TEXT;
CREATE INDEX IF NOT EXISTS "Transaction_paystackReference_idx" ON "Transaction"("paystackReference");

-- CompanySubscription billing enhancements
ALTER TABLE "CompanySubscription"
  ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT,
  ADD COLUMN IF NOT EXISTS "billingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastPaymentStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPaymentError" TEXT;

CREATE INDEX IF NOT EXISTS "CompanySubscription_paymentMethodId_idx" ON "CompanySubscription"("paymentMethodId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompanySubscription_paymentMethodId_fkey'
  ) THEN
    ALTER TABLE "CompanySubscription"
      ADD CONSTRAINT "CompanySubscription_paymentMethodId_fkey"
      FOREIGN KEY ("paymentMethodId") REFERENCES "ViewerPaymentMethod"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- UploadPayment enhancements
ALTER TABLE "UploadPayment"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "paystackReference" TEXT,
  ADD COLUMN IF NOT EXISTS "externalPaymentId" TEXT;
CREATE INDEX IF NOT EXISTS "UploadPayment_paystackReference_idx" ON "UploadPayment"("paystackReference");

-- ViewerPaymentMethod enhancements
ALTER TABLE "ViewerPaymentMethod"
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "customerCode" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "cardType" TEXT,
  ADD COLUMN IF NOT EXISTS "bank" TEXT,
  ADD COLUMN IF NOT EXISTS "expMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "expYear" TEXT,
  ADD COLUMN IF NOT EXISTS "reusable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "ViewerPaymentMethod_authorizationCode_idx" ON "ViewerPaymentMethod"("authorizationCode");

-- New PPV access table
CREATE TABLE IF NOT EXISTS "ViewerContentAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "accessType" TEXT NOT NULL DEFAULT 'PPV_FILM',
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL,
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "externalPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ViewerContentAccess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ViewerContentAccess_userId_contentId_idx" ON "ViewerContentAccess"("userId", "contentId");
CREATE INDEX IF NOT EXISTS "ViewerContentAccess_expiresAt_idx" ON "ViewerContentAccess"("expiresAt");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ViewerContentAccess_userId_fkey'
  ) THEN
    ALTER TABLE "ViewerContentAccess"
      ADD CONSTRAINT "ViewerContentAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ViewerContentAccess_contentId_fkey'
  ) THEN
    ALTER TABLE "ViewerContentAccess"
      ADD CONSTRAINT "ViewerContentAccess_contentId_fkey"
      FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Canonical payment records
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INITIALIZED',
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "email" TEXT,
  "metadata" JSONB,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "paystackReference" TEXT,
  "paystackAccessCode" TEXT,
  "paystackAuthorizationUrl" TEXT,
  "paystackTransactionId" TEXT,
  "customerCode" TEXT,
  "authorizationCode" TEXT,
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRecord_paystackReference_key" ON "PaymentRecord"("paystackReference");
CREATE INDEX IF NOT EXISTS "PaymentRecord_userId_idx" ON "PaymentRecord"("userId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_purpose_idx" ON "PaymentRecord"("purpose");
CREATE INDEX IF NOT EXISTS "PaymentRecord_status_idx" ON "PaymentRecord"("status");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentRecord_userId_fkey'
  ) THEN
    ALTER TABLE "PaymentRecord"
      ADD CONSTRAINT "PaymentRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Webhook idempotency/events
CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "eventType" TEXT NOT NULL,
  "eventId" TEXT,
  "reference" TEXT,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_provider_eventType_eventId_key"
  ON "PaymentWebhookEvent"("provider", "eventType", "eventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_reference_idx" ON "PaymentWebhookEvent"("reference");
