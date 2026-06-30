-- Legal & Contracts suite: recipient metadata, lifecycle timestamps, audit events

ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "recipientType" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "recipientLabel" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT DEFAULT 'South Africa';
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "signatureDeadline" TIMESTAMP(3);
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3);
ALTER TABLE "ProjectContract" ADD COLUMN IF NOT EXISTS "executedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProjectContractEvent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContractEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectContractEvent_contractId_idx" ON "ProjectContractEvent"("contractId");
CREATE INDEX IF NOT EXISTS "ProjectContractEvent_eventType_idx" ON "ProjectContractEvent"("eventType");

ALTER TABLE "ProjectContractEvent" ADD CONSTRAINT "ProjectContractEvent_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "ProjectContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectContractEvent" ADD CONSTRAINT "ProjectContractEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
