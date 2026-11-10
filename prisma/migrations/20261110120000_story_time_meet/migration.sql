-- Story Time Meet (built-in WebRTC meetings)

CREATE TABLE IF NOT EXISTS "MeetMeeting" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "passcode" TEXT,
    "waitingRoom" BOOLEAN NOT NULL DEFAULT true,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetMeeting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetMeeting_code_key" ON "MeetMeeting"("code");
CREATE INDEX IF NOT EXISTS "MeetMeeting_hostUserId_idx" ON "MeetMeeting"("hostUserId");
CREATE INDEX IF NOT EXISTS "MeetMeeting_status_idx" ON "MeetMeeting"("status");
CREATE INDEX IF NOT EXISTS "MeetMeeting_scheduledAt_idx" ON "MeetMeeting"("scheduledAt");

CREATE TABLE IF NOT EXISTS "MeetParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "peerId" TEXT,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isVideoOff" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetParticipant_meetingId_idx" ON "MeetParticipant"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetParticipant_userId_idx" ON "MeetParticipant"("userId");
CREATE INDEX IF NOT EXISTS "MeetParticipant_meetingId_leftAt_idx" ON "MeetParticipant"("meetingId", "leftAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetParticipant_open_unique"
  ON "MeetParticipant" ("meetingId", "userId")
  WHERE "leftAt" IS NULL;

CREATE TABLE IF NOT EXISTS "MeetGuest" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "peerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admittedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetGuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetGuest_sessionToken_key" ON "MeetGuest"("sessionToken");
CREATE INDEX IF NOT EXISTS "MeetGuest_meetingId_idx" ON "MeetGuest"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetGuest_status_idx" ON "MeetGuest"("status");

CREATE TABLE IF NOT EXISTS "MeetInvite" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "MeetInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetInvite_token_key" ON "MeetInvite"("token");
CREATE INDEX IF NOT EXISTS "MeetInvite_meetingId_idx" ON "MeetInvite"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetInvite_invitedUserId_idx" ON "MeetInvite"("invitedUserId");
CREATE INDEX IF NOT EXISTS "MeetInvite_email_idx" ON "MeetInvite"("email");

CREATE TABLE IF NOT EXISTS "MeetSignal" (
    "id" SERIAL NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fromPeer" TEXT NOT NULL,
    "toPeer" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetSignal_meetingId_id_idx" ON "MeetSignal"("meetingId", "id");
CREATE INDEX IF NOT EXISTS "MeetSignal_createdAt_idx" ON "MeetSignal"("createdAt");

CREATE TABLE IF NOT EXISTS "MeetNote" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetNote_meetingId_idx" ON "MeetNote"("meetingId");

CREATE TABLE IF NOT EXISTS "MeetSummary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB,
    "decisions" JSONB,
    "actionItems" JSONB,
    "transcript" TEXT,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetSummary_meetingId_key" ON "MeetSummary"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetSummary_createdByUserId_idx" ON "MeetSummary"("createdByUserId");

DO $$ BEGIN
  ALTER TABLE "MeetMeeting" ADD CONSTRAINT "MeetMeeting_hostUserId_fkey"
    FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetParticipant" ADD CONSTRAINT "MeetParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetGuest" ADD CONSTRAINT "MeetGuest_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetInvite" ADD CONSTRAINT "MeetInvite_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetInvite" ADD CONSTRAINT "MeetInvite_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetInvite" ADD CONSTRAINT "MeetInvite_invitedUserId_fkey"
    FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSignal" ADD CONSTRAINT "MeetSignal_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetNote" ADD CONSTRAINT "MeetNote_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetNote" ADD CONSTRAINT "MeetNote_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSummary" ADD CONSTRAINT "MeetSummary_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "MeetMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetSummary" ADD CONSTRAINT "MeetSummary_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
