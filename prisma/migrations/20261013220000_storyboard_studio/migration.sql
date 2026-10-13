-- Storyboard Studio: boards, frames, timed guest invites

CREATE TABLE IF NOT EXISTS "StoryboardBoard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scriptKey" TEXT,
    "scriptLabel" TEXT,
    "stylePreset" TEXT NOT NULL DEFAULT 'cinematic',
    "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "globalNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoryboardFrame" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "sceneNumber" TEXT,
    "sceneHeading" TEXT,
    "shotLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "directorNotes" TEXT,
    "imageUrl" TEXT,
    "imageStorageRef" TEXT,
    "generationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "generationError" TEXT,
    "lastEditPrompt" TEXT,
    "styleOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardFrame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoryboardGuestInvite" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "durationKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryboardGuestInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StoryboardGuestSession" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryboardGuestSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoryboardBoard_projectId_idx" ON "StoryboardBoard"("projectId");
CREATE INDEX IF NOT EXISTS "StoryboardBoard_createdById_idx" ON "StoryboardBoard"("createdById");
CREATE INDEX IF NOT EXISTS "StoryboardBoard_projectId_sortOrder_idx" ON "StoryboardBoard"("projectId", "sortOrder");

CREATE INDEX IF NOT EXISTS "StoryboardFrame_boardId_idx" ON "StoryboardFrame"("boardId");
CREATE INDEX IF NOT EXISTS "StoryboardFrame_projectId_idx" ON "StoryboardFrame"("projectId");
CREATE INDEX IF NOT EXISTS "StoryboardFrame_boardId_sortOrder_idx" ON "StoryboardFrame"("boardId", "sortOrder");
CREATE INDEX IF NOT EXISTS "StoryboardFrame_sceneId_idx" ON "StoryboardFrame"("sceneId");

CREATE UNIQUE INDEX IF NOT EXISTS "StoryboardGuestInvite_token_key" ON "StoryboardGuestInvite"("token");
CREATE INDEX IF NOT EXISTS "StoryboardGuestInvite_boardId_idx" ON "StoryboardGuestInvite"("boardId");
CREATE INDEX IF NOT EXISTS "StoryboardGuestInvite_projectId_idx" ON "StoryboardGuestInvite"("projectId");
CREATE INDEX IF NOT EXISTS "StoryboardGuestInvite_token_idx" ON "StoryboardGuestInvite"("token");
CREATE INDEX IF NOT EXISTS "StoryboardGuestInvite_createdById_idx" ON "StoryboardGuestInvite"("createdById");

CREATE UNIQUE INDEX IF NOT EXISTS "StoryboardGuestSession_token_key" ON "StoryboardGuestSession"("token");
CREATE INDEX IF NOT EXISTS "StoryboardGuestSession_inviteId_idx" ON "StoryboardGuestSession"("inviteId");
CREATE INDEX IF NOT EXISTS "StoryboardGuestSession_token_idx" ON "StoryboardGuestSession"("token");

ALTER TABLE "StoryboardBoard" ADD CONSTRAINT "StoryboardBoard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryboardBoard" ADD CONSTRAINT "StoryboardBoard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryboardFrame" ADD CONSTRAINT "StoryboardFrame_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "StoryboardBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryboardGuestInvite" ADD CONSTRAINT "StoryboardGuestInvite_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "StoryboardBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryboardGuestInvite" ADD CONSTRAINT "StoryboardGuestInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryboardGuestSession" ADD CONSTRAINT "StoryboardGuestSession_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "StoryboardGuestInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
