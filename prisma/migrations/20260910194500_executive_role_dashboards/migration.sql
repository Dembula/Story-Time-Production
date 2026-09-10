-- Executive Role Dashboard System
CREATE TABLE IF NOT EXISTS "ExecutiveSeat" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutiveSeat_email_key" ON "ExecutiveSeat"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ExecutiveSeat_userId_key" ON "ExecutiveSeat"("userId");
CREATE INDEX IF NOT EXISTS "ExecutiveSeat_office_idx" ON "ExecutiveSeat"("office");
CREATE INDEX IF NOT EXISTS "ExecutiveSeat_active_idx" ON "ExecutiveSeat"("active");

CREATE TABLE IF NOT EXISTS "ExecutiveAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "office" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'OK',
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveAuditLog_userId_idx" ON "ExecutiveAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "ExecutiveAuditLog_office_idx" ON "ExecutiveAuditLog"("office");
CREATE INDEX IF NOT EXISTS "ExecutiveAuditLog_createdAt_idx" ON "ExecutiveAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ExecutiveAuditLog_action_idx" ON "ExecutiveAuditLog"("action");

CREATE TABLE IF NOT EXISTS "ExecutiveCalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "eventType" TEXT NOT NULL DEFAULT 'MEETING',
    "relatedContentId" TEXT,
    "relatedCampaignId" TEXT,
    "relatedCreatorId" TEXT,
    "relatedProjectId" TEXT,
    "relatedReportId" TEXT,
    "notes" TEXT,
    "reminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveCalendarEvent_startsAt_idx" ON "ExecutiveCalendarEvent"("startsAt");
CREATE INDEX IF NOT EXISTS "ExecutiveCalendarEvent_ownerId_idx" ON "ExecutiveCalendarEvent"("ownerId");
CREATE INDEX IF NOT EXISTS "ExecutiveCalendarEvent_department_idx" ON "ExecutiveCalendarEvent"("department");
CREATE INDEX IF NOT EXISTS "ExecutiveCalendarEvent_status_idx" ON "ExecutiveCalendarEvent"("status");

CREATE TABLE IF NOT EXISTS "ExecutiveCalendarAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ExecutiveCalendarAttendee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutiveCalendarAttendee_eventId_userId_key" ON "ExecutiveCalendarAttendee"("eventId", "userId");
CREATE INDEX IF NOT EXISTS "ExecutiveCalendarAttendee_userId_idx" ON "ExecutiveCalendarAttendee"("userId");

CREATE TABLE IF NOT EXISTS "ExecutiveThread" (
    "id" TEXT NOT NULL,
    "subject" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'GROUP',
    "sensitivity" TEXT NOT NULL DEFAULT 'STANDARD',
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveThread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveThread_kind_idx" ON "ExecutiveThread"("kind");
CREATE INDEX IF NOT EXISTS "ExecutiveThread_updatedAt_idx" ON "ExecutiveThread"("updatedAt");

CREATE TABLE IF NOT EXISTS "ExecutiveThreadMember" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "office" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveThreadMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExecutiveThreadMember_threadId_userId_key" ON "ExecutiveThreadMember"("threadId", "userId");
CREATE INDEX IF NOT EXISTS "ExecutiveThreadMember_userId_idx" ON "ExecutiveThreadMember"("userId");

CREATE TABLE IF NOT EXISTS "ExecutiveMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "parentMessageId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveMessage_threadId_createdAt_idx" ON "ExecutiveMessage"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "ExecutiveMessage_senderId_idx" ON "ExecutiveMessage"("senderId");

CREATE TABLE IF NOT EXISTS "ExecutiveReport" (
    "id" TEXT NOT NULL,
    "office" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveReport_office_idx" ON "ExecutiveReport"("office");
CREATE INDEX IF NOT EXISTS "ExecutiveReport_createdById_idx" ON "ExecutiveReport"("createdById");

CREATE TABLE IF NOT EXISTS "ExecutiveReportSchedule" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    "hourLocal" INTEGER NOT NULL DEFAULT 8,
    "weekday" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutiveReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveReportSchedule_reportId_idx" ON "ExecutiveReportSchedule"("reportId");
CREATE INDEX IF NOT EXISTS "ExecutiveReportSchedule_active_nextRunAt_idx" ON "ExecutiveReportSchedule"("active", "nextRunAt");

-- Seed seats
INSERT INTO "ExecutiveSeat" ("id", "email", "office", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'lungelonomvete@gmail.com', 'CEO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'ngwenyatholwana45@gmail.com', 'COO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'sabelonomvete@icloud.com', 'CMO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'mzamomalizo@gmail.com', 'CFO', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'acenomvete@icloud.com', 'CIO', true, NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "office" = EXCLUDED."office", "active" = true, "updatedAt" = NOW();
