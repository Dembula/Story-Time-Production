-- Script Writing Studio collaboration tables

ALTER TABLE "CreatorScript" ADD COLUMN IF NOT EXISTS "studioMeta" JSONB;

CREATE TABLE IF NOT EXISTS "CreatorScriptVersion" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "versionLabel" TEXT,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreatorScriptVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreatorScriptComment" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lineIndex" INTEGER,
    "sceneHeading" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorScriptComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreatorScriptVersion_scriptId_idx" ON "CreatorScriptVersion"("scriptId");
CREATE INDEX IF NOT EXISTS "CreatorScriptVersion_createdById_idx" ON "CreatorScriptVersion"("createdById");
CREATE INDEX IF NOT EXISTS "CreatorScriptComment_scriptId_idx" ON "CreatorScriptComment"("scriptId");
CREATE INDEX IF NOT EXISTS "CreatorScriptComment_authorId_idx" ON "CreatorScriptComment"("authorId");
CREATE INDEX IF NOT EXISTS "CreatorScriptComment_parentId_idx" ON "CreatorScriptComment"("parentId");

DO $$ BEGIN
    ALTER TABLE "CreatorScriptVersion" ADD CONSTRAINT "CreatorScriptVersion_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CreatorScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptVersion" ADD CONSTRAINT "CreatorScriptVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptComment" ADD CONSTRAINT "CreatorScriptComment_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CreatorScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptComment" ADD CONSTRAINT "CreatorScriptComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptComment" ADD CONSTRAINT "CreatorScriptComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CreatorScriptComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
