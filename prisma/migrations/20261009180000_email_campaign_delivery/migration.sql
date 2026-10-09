-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailCampaignDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "campaignKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "EmailCampaignDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EmailCampaignDelivery_email_campaignKey_key" ON "EmailCampaignDelivery"("email", "campaignKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailCampaignDelivery_campaignKey_sentAt_idx" ON "EmailCampaignDelivery"("campaignKey", "sentAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailCampaignDelivery_userId_idx" ON "EmailCampaignDelivery"("userId");
