-- Funders Portal + Deal Engine foundational schema

CREATE TABLE "FunderProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "legalName" TEXT,
  "investmentThesis" TEXT,
  "typicalCheckMin" DOUBLE PRECISION,
  "typicalCheckMax" DOUBLE PRECISION,
  "preferredStages" TEXT,
  "preferredMarkets" TEXT,
  "preferredRegions" TEXT,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "limitedAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
  "adminReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  "reviewedAt" TIMESTAMP(3),
  "approvedForInvestingAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FunderProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FunderProfile_userId_key" ON "FunderProfile"("userId");
CREATE INDEX "FunderProfile_verificationStatus_idx" ON "FunderProfile"("verificationStatus");

CREATE TABLE "FunderVerification" (
  "id" TEXT NOT NULL,
  "funderProfileId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "reviewedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "FunderVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FunderVerification_funderProfileId_idx" ON "FunderVerification"("funderProfileId");
CREATE INDEX "FunderVerification_status_idx" ON "FunderVerification"("status");

CREATE TABLE "InvestmentOpportunity" (
  "id" TEXT NOT NULL,
  "projectId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "funderProfileId" TEXT,
  "type" TEXT NOT NULL,
  "marketCategory" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fundingTarget" DOUBLE PRECISION NOT NULL,
  "minTicketSize" DOUBLE PRECISION,
  "maxTicketSize" DOUBLE PRECISION,
  "equityOfferedPct" DOUBLE PRECISION,
  "revenueModel" TEXT,
  "termsSummary" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvestmentOpportunity_projectId_idx" ON "InvestmentOpportunity"("projectId");
CREATE INDEX "InvestmentOpportunity_type_idx" ON "InvestmentOpportunity"("type");
CREATE INDEX "InvestmentOpportunity_status_idx" ON "InvestmentOpportunity"("status");
CREATE INDEX "InvestmentOpportunity_marketCategory_idx" ON "InvestmentOpportunity"("marketCategory");

CREATE TABLE "CompanyFundingListing" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "sector" TEXT,
  "useOfFunds" TEXT,
  "expansionObjective" TEXT,
  "currentTraction" TEXT,
  "capitalAssetPlan" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyFundingListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyFundingListing_opportunityId_key" ON "CompanyFundingListing"("opportunityId");
CREATE INDEX "CompanyFundingListing_ownerUserId_idx" ON "CompanyFundingListing"("ownerUserId");

CREATE TABLE "InvestmentDeal" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "projectId" TEXT,
  "creatorUserId" TEXT NOT NULL,
  "funderUserId" TEXT NOT NULL,
  "pipelineStatus" TEXT NOT NULL DEFAULT 'INTERESTED',
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvestmentDeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvestmentDeal_opportunityId_idx" ON "InvestmentDeal"("opportunityId");
CREATE INDEX "InvestmentDeal_projectId_idx" ON "InvestmentDeal"("projectId");
CREATE INDEX "InvestmentDeal_pipelineStatus_idx" ON "InvestmentDeal"("pipelineStatus");
CREATE INDEX "InvestmentDeal_creatorUserId_idx" ON "InvestmentDeal"("creatorUserId");
CREATE INDEX "InvestmentDeal_funderUserId_idx" ON "InvestmentDeal"("funderUserId");

CREATE TABLE "DealTermSheet" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "valuation" DOUBLE PRECISION,
  "investmentAmount" DOUBLE PRECISION NOT NULL,
  "equityPercentage" DOUBLE PRECISION,
  "revenueSharePct" DOUBLE PRECISION,
  "recoupmentTerms" TEXT,
  "milestones" JSONB,
  "proposedByRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealTermSheet_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealTermSheet_dealId_idx" ON "DealTermSheet"("dealId");

CREATE TABLE "DealNegotiationMessage" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "messageType" TEXT NOT NULL DEFAULT 'TEXT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealNegotiationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealNegotiationMessage_dealId_idx" ON "DealNegotiationMessage"("dealId");
CREATE INDEX "DealNegotiationMessage_senderId_idx" ON "DealNegotiationMessage"("senderId");

CREATE TABLE "DealContract" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "templateType" TEXT NOT NULL,
  "generatedContractUrl" TEXT,
  "body" TEXT,
  "generatedById" TEXT,
  "signedByCreator" BOOLEAN NOT NULL DEFAULT false,
  "signedByInvestor" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealContract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealContract_dealId_idx" ON "DealContract"("dealId");
CREATE INDEX "DealContract_status_idx" ON "DealContract"("status");

CREATE TABLE "DealContractSignature" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "signerUserId" TEXT NOT NULL,
  "signerRole" TEXT NOT NULL,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signatureHash" TEXT,
  "ipAddress" TEXT,
  CONSTRAINT "DealContractSignature_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealContractSignature_contractId_idx" ON "DealContractSignature"("contractId");
CREATE INDEX "DealContractSignature_signerUserId_idx" ON "DealContractSignature"("signerUserId");

CREATE TABLE "DealPayment" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "contractId" TEXT,
  "initiatedById" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "gatewayProvider" TEXT,
  "gatewayReference" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "DealPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DealPayment_dealId_idx" ON "DealPayment"("dealId");
CREATE INDEX "DealPayment_status_idx" ON "DealPayment"("status");
CREATE INDEX "DealPayment_gatewayReference_idx" ON "DealPayment"("gatewayReference");

CREATE TABLE "CapTableEntry" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "dealId" TEXT,
  "stakeholderId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "equityPercentage" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapTableEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CapTableEntry_projectId_idx" ON "CapTableEntry"("projectId");
CREATE INDEX "CapTableEntry_dealId_idx" ON "CapTableEntry"("dealId");
CREATE INDEX "CapTableEntry_stakeholderId_idx" ON "CapTableEntry"("stakeholderId");

CREATE TABLE "ProjectRevenueEvent" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRevenueEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectRevenueEvent_projectId_idx" ON "ProjectRevenueEvent"("projectId");
CREATE INDEX "ProjectRevenueEvent_receivedAt_idx" ON "ProjectRevenueEvent"("receivedAt");

CREATE TABLE "StakeholderPayout" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "dealId" TEXT,
  "revenueEventId" TEXT,
  "userId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StakeholderPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StakeholderPayout_projectId_idx" ON "StakeholderPayout"("projectId");
CREATE INDEX "StakeholderPayout_dealId_idx" ON "StakeholderPayout"("dealId");
CREATE INDEX "StakeholderPayout_userId_idx" ON "StakeholderPayout"("userId");
CREATE INDEX "StakeholderPayout_status_idx" ON "StakeholderPayout"("status");

ALTER TABLE "FunderProfile" ADD CONSTRAINT "FunderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunderVerification" ADD CONSTRAINT "FunderVerification_funderProfileId_fkey" FOREIGN KEY ("funderProfileId") REFERENCES "FunderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunderVerification" ADD CONSTRAINT "FunderVerification_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FunderVerification" ADD CONSTRAINT "FunderVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentOpportunity" ADD CONSTRAINT "InvestmentOpportunity_funderProfileId_fkey" FOREIGN KEY ("funderProfileId") REFERENCES "FunderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyFundingListing" ADD CONSTRAINT "CompanyFundingListing_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyFundingListing" ADD CONSTRAINT "CompanyFundingListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentDeal" ADD CONSTRAINT "InvestmentDeal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "InvestmentOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentDeal" ADD CONSTRAINT "InvestmentDeal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvestmentDeal" ADD CONSTRAINT "InvestmentDeal_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentDeal" ADD CONSTRAINT "InvestmentDeal_funderUserId_fkey" FOREIGN KEY ("funderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealTermSheet" ADD CONSTRAINT "DealTermSheet_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealNegotiationMessage" ADD CONSTRAINT "DealNegotiationMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealNegotiationMessage" ADD CONSTRAINT "DealNegotiationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContract" ADD CONSTRAINT "DealContract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContract" ADD CONSTRAINT "DealContract_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealContractSignature" ADD CONSTRAINT "DealContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealContractSignature" ADD CONSTRAINT "DealContractSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DealContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealPayment" ADD CONSTRAINT "DealPayment_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CapTableEntry" ADD CONSTRAINT "CapTableEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CapTableEntry" ADD CONSTRAINT "CapTableEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CapTableEntry" ADD CONSTRAINT "CapTableEntry_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRevenueEvent" ADD CONSTRAINT "ProjectRevenueEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRevenueEvent" ADD CONSTRAINT "ProjectRevenueEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StakeholderPayout" ADD CONSTRAINT "StakeholderPayout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StakeholderPayout" ADD CONSTRAINT "StakeholderPayout_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "InvestmentDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StakeholderPayout" ADD CONSTRAINT "StakeholderPayout_revenueEventId_fkey" FOREIGN KEY ("revenueEventId") REFERENCES "ProjectRevenueEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StakeholderPayout" ADD CONSTRAINT "StakeholderPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
