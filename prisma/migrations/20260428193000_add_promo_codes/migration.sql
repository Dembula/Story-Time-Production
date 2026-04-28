CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL,
  "amount" DOUBLE PRECISION,
  "target" TEXT NOT NULL,
  "maxRedemptions" INTEGER,
  "redemptionsCount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_code_idx" ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_active_expiresAt_idx" ON "PromoCode"("active", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoCode_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "PromoCode"
      ADD CONSTRAINT "PromoCode_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PromoCodeRedemption" (
  "id" TEXT NOT NULL,
  "promoCodeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "referenceId" TEXT,
  "discountAmount" DOUBLE PRECISION,
  "resultingPlan" TEXT,
  "metadata" JSONB,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_promoCodeId_idx" ON "PromoCodeRedemption"("promoCodeId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_userId_idx" ON "PromoCodeRedemption"("userId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_context_idx" ON "PromoCodeRedemption"("context");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCodeRedemption_promoCodeId_userId_context_key"
  ON "PromoCodeRedemption"("promoCodeId", "userId", "context");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoCodeRedemption_promoCodeId_fkey'
  ) THEN
    ALTER TABLE "PromoCodeRedemption"
      ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey"
      FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PromoCodeRedemption_userId_fkey'
  ) THEN
    ALTER TABLE "PromoCodeRedemption"
      ADD CONSTRAINT "PromoCodeRedemption_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
