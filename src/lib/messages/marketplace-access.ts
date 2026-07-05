import { prisma } from "@/lib/prisma";

export async function assertMarketplaceMessagingAccess(args: {
  userId: string;
  requestId?: string | null;
  locationBookingId?: string | null;
  crewTeamRequestId?: string | null;
  castingInquiryId?: string | null;
  cateringBookingId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (args.requestId) {
    const row = await prisma.equipmentRequest.findUnique({
      where: { id: args.requestId },
      select: { requesterId: true, companyId: true, paymentTransactionId: true },
    });
    if (!row) return { ok: false, error: "Request not found", status: 404 };
    if (args.userId !== row.requesterId && args.userId !== row.companyId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    return { ok: true };
  }

  if (args.locationBookingId) {
    const row = await prisma.locationBooking.findUnique({
      where: { id: args.locationBookingId },
      select: { requesterId: true, ownerId: true },
    });
    if (!row) return { ok: false, error: "Booking not found", status: 404 };
    if (args.userId !== row.requesterId && args.userId !== row.ownerId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    return { ok: true };
  }

  if (args.crewTeamRequestId) {
    const row = await prisma.crewTeamRequest.findUnique({
      where: { id: args.crewTeamRequestId },
      include: { crewTeam: { select: { userId: true } } },
    });
    if (!row) return { ok: false, error: "Request not found", status: 404 };
    if (args.userId !== row.creatorId && args.userId !== row.crewTeam.userId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    // General crew inquiries are free — messaging unlocks on send.
    return { ok: true };
  }

  if (args.castingInquiryId) {
    const row = await prisma.castingInquiry.findUnique({
      where: { id: args.castingInquiryId },
      include: { agency: { select: { userId: true } } },
    });
    if (!row) return { ok: false, error: "Inquiry not found", status: 404 };
    if (args.userId !== row.creatorId && args.userId !== row.agency.userId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    // General casting inquiries are free — messaging unlocks on send.
    return { ok: true };
  }

  if (args.cateringBookingId) {
    const row = await prisma.cateringBooking.findUnique({
      where: { id: args.cateringBookingId },
      include: { cateringCompany: { select: { userId: true } } },
    });
    if (!row) return { ok: false, error: "Booking not found", status: 404 };
    if (args.userId !== row.creatorId && args.userId !== row.cateringCompany.userId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    return { ok: true };
  }

  return { ok: false, error: "No conversation target", status: 400 };
}
