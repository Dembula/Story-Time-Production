-- Viewer profiles (sub-accounts per subscriber) and content age/advisory for censorship.
CREATE TABLE "ViewerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ViewerProfile_userId_idx" ON "ViewerProfile"("userId");

ALTER TABLE "ViewerProfile" ADD CONSTRAINT "ViewerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Content" ADD COLUMN "minAge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Content" ADD COLUMN "advisory" JSONB;

ALTER TABLE "WatchSession" ADD COLUMN "viewerProfileId" TEXT;

CREATE INDEX "WatchSession_viewerProfileId_idx" ON "WatchSession"("viewerProfileId");

ALTER TABLE "WatchSession" ADD CONSTRAINT "WatchSession_viewerProfileId_fkey" FOREIGN KEY ("viewerProfileId") REFERENCES "ViewerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
