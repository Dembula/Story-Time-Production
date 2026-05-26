-- Viewer account onboarding fields on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountOnboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "profileExtras" JSONB;

-- Payout KYC for creator / marketplace payout recipients
CREATE TABLE "PayoutKycProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountRole" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "legalName" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "kycData" JSONB NOT NULL DEFAULT '{}',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedForPayoutsAt" TIMESTAMP(3),
    "adminReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutKycProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayoutKycVerification" (
    "id" TEXT NOT NULL,
    "payoutKycProfileId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PayoutKycVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayoutKycProfile_userId_key" ON "PayoutKycProfile"("userId");
CREATE INDEX "PayoutKycProfile_verificationStatus_idx" ON "PayoutKycProfile"("verificationStatus");
CREATE INDEX "PayoutKycProfile_accountRole_idx" ON "PayoutKycProfile"("accountRole");
CREATE INDEX "PayoutKycVerification_payoutKycProfileId_idx" ON "PayoutKycVerification"("payoutKycProfileId");
CREATE INDEX "PayoutKycVerification_status_idx" ON "PayoutKycVerification"("status");

ALTER TABLE "PayoutKycProfile" ADD CONSTRAINT "PayoutKycProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutKycVerification" ADD CONSTRAINT "PayoutKycVerification_payoutKycProfileId_fkey" FOREIGN KEY ("payoutKycProfileId") REFERENCES "PayoutKycProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutKycVerification" ADD CONSTRAINT "PayoutKycVerification_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutKycVerification" ADD CONSTRAINT "PayoutKycVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
