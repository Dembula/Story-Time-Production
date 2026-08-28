import { prisma } from "@/lib/prisma";

const DEAL_MESSAGING_STATUSES = new Set(["ACCEPTED", "APPROVED", "ACTIVE", "CONFIRMED"]);

function dealAllowsMessaging(status: string, paymentTransactionId?: string | null): boolean {
  if (paymentTransactionId) return true;
  return DEAL_MESSAGING_STATUSES.has(status);
}

export async function assertMarketplaceMessagingAccess(args: {
  userId: string;
  requestId?: string | null;
  locationBookingId?: string | null;
  crewTeamRequestId?: string | null;
  castingInquiryId?: string | null;
  cateringBookingId?: string | null;
  /** When true (POST), creators may only message after a stakeholder accepts / approves the deal. */
  requireActiveDeal?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (args.requestId) {
    const row = await prisma.equipmentRequest.findUnique({
      where: { id: args.requestId },
      select: { requesterId: true, companyId: true, status: true, paymentTransactionId: true },
    });
    if (!row) return { ok: false, error: "Request not found", status: 404 };
    if (args.userId !== row.requesterId && args.userId !== row.companyId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    if (args.requireActiveDeal && !dealAllowsMessaging(row.status, row.paymentTransactionId)) {
      return {
        ok: false,
        error: "Messaging opens once your equipment request is approved.",
        status: 403,
      };
    }
    return { ok: true };
  }

  if (args.locationBookingId) {
    const row = await prisma.locationBooking.findUnique({
      where: { id: args.locationBookingId },
      select: { requesterId: true, ownerId: true, status: true, paymentTransactionId: true },
    });
    if (!row) return { ok: false, error: "Booking not found", status: 404 };
    if (args.userId !== row.requesterId && args.userId !== row.ownerId) {
      return { ok: false, error: "Forbidden", status: 403 };
    }
    if (args.requireActiveDeal && !dealAllowsMessaging(row.status, row.paymentTransactionId)) {
      return {
        ok: false,
        error: "Messaging opens once your location booking is approved.",
        status: 403,
      };
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
    if (args.requireActiveDeal && !dealAllowsMessaging(row.status, row.paymentTransactionId)) {
      return {
        ok: false,
        error: "Messaging opens once the crew team accepts your request.",
        status: 403,
      };
    }
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
    if (args.requireActiveDeal && !dealAllowsMessaging(row.status, row.paymentTransactionId)) {
      return {
        ok: false,
        error: "Messaging opens once the casting agency accepts your inquiry.",
        status: 403,
      };
    }
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
    if (args.requireActiveDeal && !dealAllowsMessaging(row.status, row.paymentTransactionId)) {
      return {
        ok: false,
        error: "Messaging opens once your catering booking is approved.",
        status: 403,
      };
    }
    return { ok: true };
  }

  return { ok: false, error: "No conversation target", status: 400 };
}

/** Client-side helper: thread appears in Messages once a deal is active. */
export function marketplaceThreadIsOpen(status: string, paymentTransactionId?: string | null): boolean {
  return dealAllowsMessaging(status, paymentTransactionId);
}
