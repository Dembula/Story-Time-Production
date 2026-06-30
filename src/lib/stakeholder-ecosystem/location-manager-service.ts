import { prisma } from "@/lib/prisma";

export async function listManagedListings(userId: string) {
  return prisma.locationListingManager.findMany({
    where: { userId },
    include: { listing: { select: { id: true, name: true, city: true, type: true } } },
  });
}

export async function listOwnerListings(userId: string) {
  return prisma.locationListing.findMany({
    where: { companyId: userId },
    select: { id: true, name: true, city: true, type: true },
  });
}

export async function listManagersForOwner(ownerUserId: string) {
  const ownedIds = (await listOwnerListings(ownerUserId)).map((l) => l.id);
  if (ownedIds.length === 0) return [];
  return prisma.locationListingManager.findMany({
    where: { listingId: { in: ownedIds } },
    include: {
      listing: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
export async function assignLocationManager(input: {
  ownerUserId: string;
  listingId: string;
  managerUserId: string;
  canApproveBookings?: boolean;
}) {
  const listing = await prisma.locationListing.findFirst({
    where: { id: input.listingId, companyId: input.ownerUserId },
  });
  if (!listing) return { error: "Listing not found or not owned by you" as const };
  const row = await prisma.locationListingManager.upsert({
    where: { listingId_userId: { listingId: input.listingId, userId: input.managerUserId } },
    create: {
      listingId: input.listingId,
      userId: input.managerUserId,
      role: "MANAGER",
      canApproveBookings: input.canApproveBookings ?? false,
    },
    update: { canApproveBookings: input.canApproveBookings ?? false },
  });
  return { error: null, manager: row };
}

export async function resolveManagerUserIdByEmail(email: string) {
  const normalized = email.trim();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  return user;
}

export async function userCanApproveLocationBooking(
  userId: string,
  booking: { ownerId: string; locationId: string },
) {
  if (booking.ownerId === userId) return true;
  const mgr = await prisma.locationListingManager.findFirst({
    where: { userId, listingId: booking.locationId, canApproveBookings: true },
  });
  return !!mgr;
}

export async function removeLocationManager(input: {
  ownerUserId: string;
  listingId: string;
  managerUserId: string;
}) {
  const listing = await prisma.locationListing.findFirst({
    where: { id: input.listingId, companyId: input.ownerUserId },
  });
  if (!listing) return { error: "Listing not found or not owned by you" as const };
  await prisma.locationListingManager.deleteMany({
    where: { listingId: input.listingId, userId: input.managerUserId },
  });
  return { error: null };
}

export async function bookingsForLocationContext(userId: string, mode: "owner" | "manager") {
  if (mode === "owner") {
    return prisma.locationBooking.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { location: { select: { name: true } }, requester: { select: { name: true } } },
    });
  }
  const managed = await listManagedListings(userId);
  const listingIds = managed.map((m) => m.listingId);
  if (listingIds.length === 0) return [];
  return prisma.locationBooking.findMany({
    where: { locationId: { in: listingIds } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { location: { select: { name: true } }, requester: { select: { name: true } } },
  });
}
