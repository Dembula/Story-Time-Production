-- CreateTable
CREATE TABLE "StreamAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "playbackUrl" TEXT,
    "hlsUrl" TEXT,
    "iframeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "entityType" TEXT,
    "entityId" TEXT,
    "lastError" TEXT,
    "lastWebhookAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamAsset_uid_key" ON "StreamAsset"("uid");

-- CreateIndex
CREATE INDEX "StreamAsset_entityType_entityId_idx" ON "StreamAsset"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "StreamAsset_status_idx" ON "StreamAsset"("status");
