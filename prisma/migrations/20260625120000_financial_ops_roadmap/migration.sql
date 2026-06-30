-- Financial ops roadmap: petty cash, approval chains, bank import, vendor intelligence

ALTER TABLE "ProductionExpense" ADD COLUMN IF NOT EXISTS "pettyCashFundId" TEXT;

CREATE TABLE IF NOT EXISTS "PettyCashFund" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "custodianUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Petty cash',
    "floatAmount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lowBalanceThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PettyCashFund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FinanceApprovalStep" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GlobalVendor" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "taxNumber" TEXT,
    "country" TEXT,
    "vendorType" TEXT,
    "totalSpendAcrossProjects" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectCount" INTEGER NOT NULL DEFAULT 0,
    "avgPaymentDays" DOUBLE PRECISION,
    "riskScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalVendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankImportBatch" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CSV',
    "fileName" TEXT,
    "importedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BankTransaction" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "reference" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "expenseId" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectVendor" ADD COLUMN IF NOT EXISTS "globalVendorId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GlobalVendor_normalizedName_key" ON "GlobalVendor"("normalizedName");
CREATE INDEX IF NOT EXISTS "PettyCashFund_projectId_idx" ON "PettyCashFund"("projectId");
CREATE INDEX IF NOT EXISTS "PettyCashFund_custodianUserId_idx" ON "PettyCashFund"("custodianUserId");
CREATE INDEX IF NOT EXISTS "FinanceApprovalStep_entityType_entityId_idx" ON "FinanceApprovalStep"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "FinanceApprovalStep_approverUserId_idx" ON "FinanceApprovalStep"("approverUserId");
CREATE INDEX IF NOT EXISTS "BankImportBatch_projectId_idx" ON "BankImportBatch"("projectId");
CREATE INDEX IF NOT EXISTS "BankTransaction_projectId_idx" ON "BankTransaction"("projectId");
CREATE INDEX IF NOT EXISTS "BankTransaction_batchId_idx" ON "BankTransaction"("batchId");
CREATE INDEX IF NOT EXISTS "BankTransaction_matchStatus_idx" ON "BankTransaction"("matchStatus");
CREATE INDEX IF NOT EXISTS "ProductionExpense_pettyCashFundId_idx" ON "ProductionExpense"("pettyCashFundId");
CREATE INDEX IF NOT EXISTS "ProjectVendor_globalVendorId_idx" ON "ProjectVendor"("globalVendorId");

ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_pettyCashFundId_fkey"
  FOREIGN KEY ("pettyCashFundId") REFERENCES "PettyCashFund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PettyCashFund" ADD CONSTRAINT "PettyCashFund_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PettyCashFund" ADD CONSTRAINT "PettyCashFund_custodianUserId_fkey"
  FOREIGN KEY ("custodianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceApprovalStep" ADD CONSTRAINT "FinanceApprovalStep_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectVendor" ADD CONSTRAINT "ProjectVendor_globalVendorId_fkey"
  FOREIGN KEY ("globalVendorId") REFERENCES "GlobalVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankImportBatch" ADD CONSTRAINT "BankImportBatch_importedById_fkey"
  FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "BankImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "ProductionExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
