-- Wallet + ledger core
CREATE TABLE IF NOT EXISTS "Wallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lockedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_key" ON "Wallet"("userId");

CREATE TABLE IF NOT EXISTS "WalletAccount" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletAccount_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WalletAccount_walletId_accountType_currency_key" ON "WalletAccount"("walletId", "accountType", "currency");
CREATE INDEX IF NOT EXISTS "WalletAccount_walletId_idx" ON "WalletAccount"("walletId");

CREATE TABLE IF NOT EXISTS "LedgerBatch" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerBatch_idempotencyKey_key" ON "LedgerBatch"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "LedgerBatch_referenceType_referenceId_idx" ON "LedgerBatch"("referenceType", "referenceId");

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "transactionType" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "counterpartyWalletId" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LedgerEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LedgerBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LedgerEntry_walletId_idx" ON "LedgerEntry"("walletId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");
CREATE INDEX IF NOT EXISTS "LedgerEntry_transactionType_idx" ON "LedgerEntry"("transactionType");

CREATE TABLE IF NOT EXISTS "EscrowAccount" (
  "id" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "buyerWalletId" TEXT NOT NULL,
  "sellerWalletId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'HELD',
  "releaseTrigger" TEXT,
  "releasedAt" TIMESTAMP(3),
  "disputedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EscrowAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EscrowAccount_buyerWalletId_fkey" FOREIGN KEY ("buyerWalletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EscrowAccount_sellerWalletId_fkey" FOREIGN KEY ("sellerWalletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EscrowAccount_referenceType_referenceId_key" ON "EscrowAccount"("referenceType","referenceId");
CREATE INDEX IF NOT EXISTS "EscrowAccount_buyerWalletId_idx" ON "EscrowAccount"("buyerWalletId");
CREATE INDEX IF NOT EXISTS "EscrowAccount_sellerWalletId_idx" ON "EscrowAccount"("sellerWalletId");
CREATE INDEX IF NOT EXISTS "EscrowAccount_status_idx" ON "EscrowAccount"("status");

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "subtotalAmount" DOUBLE PRECISION NOT NULL,
  "platformFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

CREATE TABLE IF NOT EXISTS "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmount" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PayoutRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "provider" TEXT NOT NULL DEFAULT 'STITCH',
  "providerReference" TEXT,
  "failureReason" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayoutRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_providerReference_key" ON "PayoutRequest"("providerReference");
CREATE INDEX IF NOT EXISTS "PayoutRequest_userId_idx" ON "PayoutRequest"("userId");
CREATE INDEX IF NOT EXISTS "PayoutRequest_walletId_idx" ON "PayoutRequest"("walletId");
CREATE INDEX IF NOT EXISTS "PayoutRequest_status_idx" ON "PayoutRequest"("status");

CREATE TABLE IF NOT EXISTS "GatewayEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventId" TEXT,
  "payload" JSONB,
  "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewayEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GatewayEvent_provider_eventType_eventId_key" ON "GatewayEvent"("provider","eventType","eventId");

CREATE TABLE IF NOT EXISTS "GatewayReference" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "externalRef" TEXT NOT NULL,
  "invoiceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewayReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GatewayReference_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GatewayReference_provider_externalRef_key" ON "GatewayReference"("provider","externalRef");
CREATE INDEX IF NOT EXISTS "GatewayReference_referenceType_referenceId_idx" ON "GatewayReference"("referenceType","referenceId");
