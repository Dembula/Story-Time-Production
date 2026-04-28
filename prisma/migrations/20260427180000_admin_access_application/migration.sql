-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminAccessApplication" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "AdminAccessApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAccessApplication_email_idx" ON "AdminAccessApplication"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAccessApplication_status_idx" ON "AdminAccessApplication"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminAccessApplication_reviewedById_fkey'
  ) THEN
    ALTER TABLE "AdminAccessApplication" ADD CONSTRAINT "AdminAccessApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
