-- Network discoverable handle for creators (searchable in Network Discover).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "networkHandle" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_networkHandle_key" ON "User"("networkHandle");
