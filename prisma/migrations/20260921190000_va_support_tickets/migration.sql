-- Creator VA support tickets (feature requests / bugs) for admin review
CREATE TABLE "VaSupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "creatorVisibleNote" TEXT,
    "sourceSurface" TEXT,
    "sourcePath" TEXT,
    "toolSlug" TEXT,
    "projectId" TEXT,
    "conversationId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaSupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VaSupportTicket_ticketNumber_key" ON "VaSupportTicket"("ticketNumber");
CREATE UNIQUE INDEX "VaSupportTicket_seq_key" ON "VaSupportTicket"("seq");
CREATE INDEX "VaSupportTicket_createdById_status_idx" ON "VaSupportTicket"("createdById", "status");
CREATE INDEX "VaSupportTicket_status_createdAt_idx" ON "VaSupportTicket"("status", "createdAt");
CREATE INDEX "VaSupportTicket_kind_status_idx" ON "VaSupportTicket"("kind", "status");

ALTER TABLE "VaSupportTicket" ADD CONSTRAINT "VaSupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VaSupportTicket" ADD CONSTRAINT "VaSupportTicket_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
