-- Interactive product-tour completion / dismissal (per authenticated user).
CREATE TABLE IF NOT EXISTS "UserTourProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tourVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTourProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserTourProgress_userId_tourId_key" ON "UserTourProgress"("userId", "tourId");
CREATE INDEX IF NOT EXISTS "UserTourProgress_userId_status_idx" ON "UserTourProgress"("userId", "status");
CREATE INDEX IF NOT EXISTS "UserTourProgress_tourId_idx" ON "UserTourProgress"("tourId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserTourProgress_userId_fkey'
  ) THEN
    ALTER TABLE "UserTourProgress"
      ADD CONSTRAINT "UserTourProgress_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
