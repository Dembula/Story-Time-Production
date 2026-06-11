-- VA auto-learning at scale: playbook rules, action log, topic stats
CREATE TABLE "ModocPlaybookRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "whenText" TEXT NOT NULL,
    "thenText" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'pattern_detected',
    "version" INTEGER NOT NULL DEFAULT 1,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModocPlaybookRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModocActionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "eventId" TEXT,
    "taskIds" JSONB,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModocActionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModocTopicStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModocTopicStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModocPlaybookRule_userId_ruleKey_key" ON "ModocPlaybookRule"("userId", "ruleKey");
CREATE INDEX "ModocPlaybookRule_userId_idx" ON "ModocPlaybookRule"("userId");
CREATE INDEX "ModocPlaybookRule_userId_hits_idx" ON "ModocPlaybookRule"("userId", "hits");
CREATE INDEX "ModocPlaybookRule_userId_confidence_idx" ON "ModocPlaybookRule"("userId", "confidence");
CREATE INDEX "ModocPlaybookRule_userId_updatedAt_idx" ON "ModocPlaybookRule"("userId", "updatedAt");

CREATE INDEX "ModocActionLog_userId_createdAt_idx" ON "ModocActionLog"("userId", "createdAt");
CREATE INDEX "ModocActionLog_userId_action_idx" ON "ModocActionLog"("userId", "action");
CREATE INDEX "ModocActionLog_conversationId_idx" ON "ModocActionLog"("conversationId");

CREATE UNIQUE INDEX "ModocTopicStat_userId_topic_key" ON "ModocTopicStat"("userId", "topic");
CREATE INDEX "ModocTopicStat_userId_idx" ON "ModocTopicStat"("userId");
CREATE INDEX "ModocTopicStat_userId_count_idx" ON "ModocTopicStat"("userId", "count");

ALTER TABLE "ModocPlaybookRule" ADD CONSTRAINT "ModocPlaybookRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModocActionLog" ADD CONSTRAINT "ModocActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModocTopicStat" ADD CONSTRAINT "ModocTopicStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
