-- Credit person identities for interactive credits
CREATE TABLE "CreditPerson" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "externalLinks" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPerson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPerson_normalizedName_key" ON "CreditPerson"("normalizedName");
CREATE UNIQUE INDEX "CreditPerson_userId_key" ON "CreditPerson"("userId");
CREATE INDEX "CreditPerson_userId_idx" ON "CreditPerson"("userId");

ALTER TABLE "CreditPerson" ADD CONSTRAINT "CreditPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrewMember" ADD COLUMN "creditPersonId" TEXT;
CREATE INDEX "CrewMember_creditPersonId_idx" ON "CrewMember"("creditPersonId");
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_creditPersonId_fkey" FOREIGN KEY ("creditPersonId") REFERENCES "CreditPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
