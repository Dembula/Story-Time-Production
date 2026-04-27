-- CreateTable
CREATE TABLE "AdminAccessApplication" (
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
CREATE INDEX "AdminAccessApplication_email_idx" ON "AdminAccessApplication"("email");

-- CreateIndex
CREATE INDEX "AdminAccessApplication_status_idx" ON "AdminAccessApplication"("status");

-- AddForeignKey
ALTER TABLE "AdminAccessApplication" ADD CONSTRAINT "AdminAccessApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
