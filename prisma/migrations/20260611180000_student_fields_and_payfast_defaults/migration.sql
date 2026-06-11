-- Student registration fields on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "institutionName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentId" TEXT;

-- Lock student-work flag at upload time
ALTER TABLE "Content" ADD COLUMN IF NOT EXISTS "isStudentWork" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MusicTrack" ADD COLUMN IF NOT EXISTS "isStudentWork" BOOLEAN NOT NULL DEFAULT false;

-- Payment provider default: Stitch removed, PayFast is the configured provider
ALTER TABLE "PaymentRecord" ALTER COLUMN "provider" SET DEFAULT 'PAYFAST';
ALTER TABLE "PaymentWebhookEvent" ALTER COLUMN "provider" SET DEFAULT 'PAYFAST';
ALTER TABLE "PayoutRequest" ALTER COLUMN "provider" SET DEFAULT 'PAYFAST';
ALTER TABLE "ViewerPaymentMethod" ALTER COLUMN "provider" SET DEFAULT 'PAYFAST';
