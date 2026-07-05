import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma-types";

export type StakeholderSyncEventType = "SCHEDULE_CHANGED" | "BOOKING_UPDATED" | "CONTRACT_SENT";

async function resolveVendorUserIdsForProject(projectId: string): Promise<string[]> {
  const ids = new Set<string>();

  const vendors = await prisma.projectVendor.findMany({
    where: { projectId, status: "ACTIVE" },
    include: {
      equipmentListing: { select: { companyId: true } },
      cateringCompany: { select: { userId: true } },
      locationListing: { select: { companyId: true } },
      crewTeam: { select: { userId: true } },
    },
  });

  for (const v of vendors) {
    if (v.counterpartyUserId) ids.add(v.counterpartyUserId);
    if (v.equipmentListing?.companyId) ids.add(v.equipmentListing.companyId);
    if (v.cateringCompany?.userId) ids.add(v.cateringCompany.userId);
    if (v.locationListing?.companyId) ids.add(v.locationListing.companyId);
    if (v.crewTeam?.userId) ids.add(v.crewTeam.userId);
  }

  const crewInvites = await prisma.crewInvitation.findMany({
    where: { projectId, status: { in: ["PENDING", "ACCEPTED"] } },
    select: { crewTeam: { select: { userId: true } } },
  });
  for (const c of crewInvites) {
    if (c.crewTeam?.userId) ids.add(c.crewTeam.userId);
  }

  const managers = await prisma.locationListingManager.findMany({
    where: { listing: { projectVendors: { some: { projectId } } } },
    select: { userId: true },
  });
  for (const m of managers) ids.add(m.userId);

  return [...ids];
}

export async function publishStakeholderSyncEvent(input: {
  projectId: string;
  eventType: StakeholderSyncEventType;
  payload?: Record<string, unknown>;
}) {
  const targetUserIds = await resolveVendorUserIdsForProject(input.projectId);
  if (targetUserIds.length === 0) return null;

  return prisma.stakeholderSyncEvent.create({
    data: {
      projectId: input.projectId,
      eventType: input.eventType,
      targetUserIds,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function fetchSyncEventsForUser(userId: string, since: Date) {
  return prisma.stakeholderSyncEvent.findMany({
    where: {
      createdAt: { gt: since },
      targetUserIds: { has: userId },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { project: { select: { title: true } } },
  });
}

/** Publish booking sync when a location tied to a project vendor is updated. */
export async function publishBookingSyncForLocation(
  locationListingId: string,
  payload: Record<string, unknown>,
) {
  const vendor = await prisma.projectVendor.findFirst({
    where: { locationListingId },
    select: { projectId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!vendor?.projectId) return null;
  return publishStakeholderSyncEvent({
    projectId: vendor.projectId,
    eventType: "BOOKING_UPDATED",
    payload,
  });
}
