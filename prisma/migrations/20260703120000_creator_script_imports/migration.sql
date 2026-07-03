-- Creator script import vault: stores original uploaded files + extraction metadata

CREATE TABLE IF NOT EXISTS "CreatorScriptImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT,
    "projectId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "sourceType" TEXT NOT NULL,
    "extractionMethod" TEXT,
    "extractedChars" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorScriptImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreatorScriptImport_userId_idx" ON "CreatorScriptImport"("userId");
CREATE INDEX IF NOT EXISTS "CreatorScriptImport_scriptId_idx" ON "CreatorScriptImport"("scriptId");
CREATE INDEX IF NOT EXISTS "CreatorScriptImport_projectId_idx" ON "CreatorScriptImport"("projectId");
CREATE INDEX IF NOT EXISTS "CreatorScriptImport_createdAt_idx" ON "CreatorScriptImport"("createdAt");

DO $$ BEGIN
    ALTER TABLE "CreatorScriptImport" ADD CONSTRAINT "CreatorScriptImport_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptImport" ADD CONSTRAINT "CreatorScriptImport_scriptId_fkey"
        FOREIGN KEY ("scriptId") REFERENCES "CreatorScript"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "CreatorScriptImport" ADD CONSTRAINT "CreatorScriptImport_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
