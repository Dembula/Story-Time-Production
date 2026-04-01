-- Add payment/access tables and supporting billing metadata for Paystack flows.

-- ViewerProfile enhancements
ALTER TABLE "ViewerProfile" ADD COLUMN "dateOfBirth" TIMESTAMP(3);

-- ViewerSubscription billing enhancements
ALTER TABLE "ViewerSubscription"
  ADD COLUMN "paymentMethodId" TEXT,
  ADD COLUMN "viewerModel" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
  ADD COLUMN "profileLimit" INTEGER,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastPaymentStatus" TEXT,
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentError" TEXT;

CREATE INDEX "ViewerSubscription_paymentMethodId_idx" ON "ViewerSubscription"("paymentMethodId");
ALTER TABLE "ViewerSubscription"
  ADD CONSTRAINT "ViewerSubscription_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "ViewerPaymentMethod"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- SubscriptionPayment tracking improvements
ALTER TABLE "SubscriptionPayment"
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "paystackReference" TEXT;
CREATE INDEX "SubscriptionPayment_paystackReference_idx" ON "SubscriptionPayment"("paystackReference");

-- Transaction tracking improvements
ALTER TABLE "Transaction" ADD COLUMN "paystackReference" TEXT;
CREATE INDEX "Transaction_paystackReference_idx" ON "Transaction"("paystackReference");

-- CompanySubscription billing enhancements
ALTER TABLE "CompanySubscription"
  ADD COLUMN "paymentMethodId" TEXT,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastPaymentStatus" TEXT,
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentError" TEXT;

CREATE INDEX "CompanySubscription_paymentMethodId_idx" ON "CompanySubscription"("paymentMethodId");
ALTER TABLE "CompanySubscription"
  ADD CONSTRAINT "CompanySubscription_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "ViewerPaymentMethod"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- UploadPayment enhancements
ALTER TABLE "UploadPayment"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "paystackReference" TEXT,
  ADD COLUMN "externalPaymentId" TEXT;
CREATE INDEX "UploadPayment_paystackReference_idx" ON "UploadPayment"("paystackReference");

-- ViewerPaymentMethod enhancements
ALTER TABLE "ViewerPaymentMethod"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  ADD COLUMN "email" TEXT,
  ADD COLUMN "customerCode" TEXT,
  ADD COLUMN "authorizationCode" TEXT,
  ADD COLUMN "authorizationSignature" TEXT,
  ADD COLUMN "cardType" TEXT,
  ADD COLUMN "bank" TEXT,
  ADD COLUMN "expMonth" TEXT,
  ADD COLUMN "expYear" TEXT,
  ADD COLUMN "reusable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "ViewerPaymentMethod_authorizationCode_idx" ON "ViewerPaymentMethod"("authorizationCode");

-- New PPV access table
CREATE TABLE "ViewerContentAccess" (
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
CREATE INDEX "ViewerContentAccess_userId_contentId_idx" ON "ViewerContentAccess"("userId", "contentId");
CREATE INDEX "ViewerContentAccess_expiresAt_idx" ON "ViewerContentAccess"("expiresAt");
ALTER TABLE "ViewerContentAccess"
  ADD CONSTRAINT "ViewerContentAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ViewerContentAccess"
  ADD CONSTRAINT "ViewerContentAccess_contentId_fkey"
  FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Canonical payment records
CREATE TABLE "PaymentRecord" (
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
CREATE UNIQUE INDEX "PaymentRecord_paystackReference_key" ON "PaymentRecord"("paystackReference");
CREATE INDEX "PaymentRecord_userId_idx" ON "PaymentRecord"("userId");
CREATE INDEX "PaymentRecord_purpose_idx" ON "PaymentRecord"("purpose");
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");
ALTER TABLE "PaymentRecord"
  ADD CONSTRAINT "PaymentRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Webhook idempotency/events
CREATE TABLE "PaymentWebhookEvent" (
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
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventType_eventId_key"
  ON "PaymentWebhookEvent"("provider", "eventType", "eventId");
CREATE INDEX "PaymentWebhookEvent_reference_idx" ON "PaymentWebhookEvent"("reference");
