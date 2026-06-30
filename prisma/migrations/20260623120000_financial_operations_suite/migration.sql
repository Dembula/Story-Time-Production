-- Financial operations suite: vendors, purchase orders, payroll, budget versions

ALTER TABLE "ProductionExpense" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "ProductionExpense" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "ProductionExpense" ADD COLUMN IF NOT EXISTS "payrollLineItemId" TEXT;

ALTER TABLE "ProjectBudget" ADD COLUMN IF NOT EXISTS "activeVersionId" TEXT;

CREATE TABLE IF NOT EXISTS "ProjectVendor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "vendorType" TEXT NOT NULL DEFAULT 'GENERAL',
    "crewTeamId" TEXT,
    "locationListingId" TEXT,
    "equipmentListingId" TEXT,
    "cateringCompanyId" TEXT,
    "counterpartyUserId" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "taxNumber" TEXT,
    "paymentTerms" TEXT,
    "bankDetails" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectVendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT,
    "poNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "budgetLineId" TEXT,
    "department" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount" DOUBLE PRECISION,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "description" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetLineId" TEXT,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderEvent" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "personLabel" TEXT NOT NULL,
    "role" TEXT,
    "department" TEXT,
    "shootDayId" TEXT,
    "castingInvitationId" TEXT,
    "crewInvitationId" TEXT,
    "daysWorked" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dayRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxWithheld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectBudgetVersion" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalPlanned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "generationSource" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    CONSTRAINT "ProjectBudgetVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectBudgetVersionLine" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION DEFAULT 1,
    "unitCost" DOUBLE PRECISION DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "ProjectBudgetVersionLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_projectId_poNumber_key" ON "PurchaseOrder"("projectId", "poNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollLineItem_payrollLineItemId_key" ON "ProductionExpense"("payrollLineItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectBudgetVersion_budgetId_version_key" ON "ProjectBudgetVersion"("budgetId", "version");

CREATE INDEX IF NOT EXISTS "ProjectVendor_projectId_idx" ON "ProjectVendor"("projectId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_projectId_status_idx" ON "PurchaseOrder"("projectId", "status");
CREATE INDEX IF NOT EXISTS "PayrollRun_projectId_idx" ON "PayrollRun"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectBudgetVersion_budgetId_idx" ON "ProjectBudgetVersion"("budgetId");

DO $$ BEGIN
  ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ProjectVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionExpense" ADD CONSTRAINT "ProductionExpense_payrollLineItemId_fkey" FOREIGN KEY ("payrollLineItemId") REFERENCES "PayrollLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectBudget" ADD CONSTRAINT "ProjectBudget_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "ProjectBudgetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectVendor" ADD CONSTRAINT "ProjectVendor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectBudgetVersion" ADD CONSTRAINT "ProjectBudgetVersion_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
