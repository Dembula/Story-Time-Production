-- Enterprise legal suite: clause library, approvals, multi-signer, e-sign, guest tokens

ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "catalogEntryId" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "signingMode" TEXT NOT NULL DEFAULT 'PARALLEL';
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "approvalRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "executedDocumentUrl" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "esignProvider" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "esignEnvelopeId" TEXT;

CREATE TABLE IF NOT EXISTS "ContractClause" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractClause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractApprovalStep" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractSigner" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "signOrder" INTEGER NOT NULL DEFAULT 0,
    "partyRole" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "ContractSigner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractGuestToken" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "signerId" TEXT,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractGuestToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractEsignEnvelope" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "signersJson" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractEsignEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractGuestToken_token_key" ON "ContractGuestToken"("token");
CREATE INDEX IF NOT EXISTS "ContractClause_projectId_idx" ON "ContractClause"("projectId");
CREATE INDEX IF NOT EXISTS "ContractClause_category_idx" ON "ContractClause"("category");
CREATE INDEX IF NOT EXISTS "ContractClause_jurisdiction_idx" ON "ContractClause"("jurisdiction");
CREATE INDEX IF NOT EXISTS "ContractApprovalStep_contractId_idx" ON "ContractApprovalStep"("contractId");
CREATE INDEX IF NOT EXISTS "ContractApprovalStep_approverUserId_idx" ON "ContractApprovalStep"("approverUserId");
CREATE INDEX IF NOT EXISTS "ContractSigner_contractId_idx" ON "ContractSigner"("contractId");
CREATE INDEX IF NOT EXISTS "ContractSigner_userId_idx" ON "ContractSigner"("userId");
CREATE INDEX IF NOT EXISTS "ContractSigner_email_idx" ON "ContractSigner"("email");
CREATE INDEX IF NOT EXISTS "ContractGuestToken_contractId_idx" ON "ContractGuestToken"("contractId");
CREATE INDEX IF NOT EXISTS "ContractGuestToken_email_idx" ON "ContractGuestToken"("email");
CREATE INDEX IF NOT EXISTS "ContractEsignEnvelope_contractId_idx" ON "ContractEsignEnvelope"("contractId");
CREATE INDEX IF NOT EXISTS "ContractEsignEnvelope_provider_idx" ON "ContractEsignEnvelope"("provider");

ALTER TABLE "ContractClause" ADD CONSTRAINT "ContractClause_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractClause" ADD CONSTRAINT "ContractClause_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractApprovalStep" ADD CONSTRAINT "ContractApprovalStep_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractApprovalStep" ADD CONSTRAINT "ContractApprovalStep_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractSigner" ADD CONSTRAINT "ContractSigner_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractSigner" ADD CONSTRAINT "ContractSigner_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractGuestToken" ADD CONSTRAINT "ContractGuestToken_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractGuestToken" ADD CONSTRAINT "ContractGuestToken_signerId_fkey"
  FOREIGN KEY ("signerId") REFERENCES "ContractSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractEsignEnvelope" ADD CONSTRAINT "ContractEsignEnvelope_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
