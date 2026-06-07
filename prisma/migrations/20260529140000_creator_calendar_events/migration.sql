-- CreateTable
CREATE TABLE "CreatorCalendarEvent" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "visibility" TEXT NOT NULL DEFAULT 'PERSONAL',
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_ownerUserId_idx" ON "CreatorCalendarEvent"("ownerUserId");

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_companyId_idx" ON "CreatorCalendarEvent"("companyId");

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_projectId_idx" ON "CreatorCalendarEvent"("projectId");

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_startAt_idx" ON "CreatorCalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_assigneeId_idx" ON "CreatorCalendarEvent"("assigneeId");

-- CreateIndex
CREATE INDEX "CreatorCalendarEvent_visibility_idx" ON "CreatorCalendarEvent"("visibility");

-- AddForeignKey
ALTER TABLE "CreatorCalendarEvent" ADD CONSTRAINT "CreatorCalendarEvent_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCalendarEvent" ADD CONSTRAINT "CreatorCalendarEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "StudioCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCalendarEvent" ADD CONSTRAINT "CreatorCalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "OriginalProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCalendarEvent" ADD CONSTRAINT "CreatorCalendarEvent_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCalendarEvent" ADD CONSTRAINT "CreatorCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
