-- AlterTable
ALTER TABLE "ViewerProfile" ADD COLUMN "pinEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ViewerProfile" ADD COLUMN "pinHash" TEXT;
ALTER TABLE "ViewerProfile" ADD COLUMN "pinUpdatedAt" TIMESTAMP(3);
