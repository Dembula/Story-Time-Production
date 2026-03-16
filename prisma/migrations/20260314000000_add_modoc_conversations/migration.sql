-- MODOC (AI assistant) conversation and message persistence for saving and resuming chats.
CREATE TABLE "ModocConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT,
    "pageContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModocConversation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModocConversation_userId_idx" ON "ModocConversation"("userId");
CREATE INDEX "ModocConversation_createdAt_idx" ON "ModocConversation"("createdAt");

ALTER TABLE "ModocConversation" ADD CONSTRAINT "ModocConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModocMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModocMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModocMessage_conversationId_idx" ON "ModocMessage"("conversationId");
CREATE INDEX "ModocMessage_createdAt_idx" ON "ModocMessage"("createdAt");

ALTER TABLE "ModocMessage" ADD CONSTRAINT "ModocMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ModocConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
