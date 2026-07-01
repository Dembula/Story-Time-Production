-- Remove AFDA education fallback values written before explicit profile fields were required.
UPDATE "User"
SET "education" = NULL
WHERE "education" IS NOT NULL
  AND LOWER(TRIM("education")) IN (
    'afda',
    'afda film school',
    'afda johannesburg',
    'afda cape town',
    'afda durban',
    'afda film school johannesburg',
    'afda film school cape town'
  );

UPDATE "PendingCreatorSignup"
SET "education" = NULL
WHERE "education" IS NOT NULL
  AND LOWER(TRIM("education")) IN (
    'afda',
    'afda film school',
    'afda johannesburg',
    'afda cape town',
    'afda durban',
    'afda film school johannesburg',
    'afda film school cape town'
  );

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showCreatorAboutOnTitles" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CreditPerson" ADD COLUMN IF NOT EXISTS "generatedBlurb" TEXT;
ALTER TABLE "CreditPerson" ADD COLUMN IF NOT EXISTS "blurbCreditsHash" TEXT;
ALTER TABLE "CreditPerson" ADD COLUMN IF NOT EXISTS "blurbUpdatedAt" TIMESTAMP(3);
