import { notifyUser } from "@/lib/notify-user";

export async function notifyEquipmentRequestCreated(params: {
  companyUserId: string;
  requesterName?: string | null;
  equipmentName: string;
  requestId: string;
}) {
  await notifyUser({
    userId: params.companyUserId,
    type: "MARKETPLACE_EQUIPMENT_REQUEST",
    title: "New equipment rental request",
    body: `${params.requesterName || "A creator"} requested ${params.equipmentName}.`,
    metadata: { url: "/equipment-company/requests", requestId: params.requestId },
    email: {
      subject: "New equipment rental request on Story Time",
      text: `${params.requesterName || "A creator"} sent a rental request for ${params.equipmentName}. Open your dashboard to respond.`,
    },
  });
}

export async function notifyEquipmentRequestStatus(params: {
  creatorUserId: string;
  equipmentName: string;
  status: string;
  requestId: string;
}) {
  const approved = params.status === "APPROVED";
  await notifyUser({
    userId: params.creatorUserId,
    type: approved ? "MARKETPLACE_EQUIPMENT_APPROVED" : "MARKETPLACE_EQUIPMENT_DECLINED",
    title: approved ? "Equipment request approved" : "Equipment request updated",
    body: `Your request for ${params.equipmentName} is now ${params.status.toLowerCase()}.`,
    metadata: { url: "/creator/equipment", requestId: params.requestId },
  });
}

export async function notifyLocationBookingCreated(params: {
  ownerUserId: string;
  requesterName?: string | null;
  locationName: string;
  bookingId: string;
}) {
  await notifyUser({
    userId: params.ownerUserId,
    type: "MARKETPLACE_LOCATION_BOOKING",
    title: "New location booking request",
    body: `${params.requesterName || "A creator"} wants to book ${params.locationName}.`,
    metadata: { url: "/location-owner/bookings", bookingId: params.bookingId },
    email: {
      subject: "New location booking on Story Time",
      text: `${params.requesterName || "A creator"} requested to book ${params.locationName}. Review it in your booking inbox.`,
    },
  });
}

export async function notifyLocationBookingStatus(params: {
  creatorUserId: string;
  locationName: string;
  status: string;
  bookingId: string;
}) {
  const approved = params.status === "APPROVED";
  await notifyUser({
    userId: params.creatorUserId,
    type: approved ? "MARKETPLACE_LOCATION_APPROVED" : "MARKETPLACE_LOCATION_DECLINED",
    title: approved ? "Location booking approved" : "Location booking updated",
    body: `Your booking for ${params.locationName} is ${params.status.toLowerCase()}.`,
    metadata: { url: "/creator/locations", bookingId: params.bookingId },
  });
}

export async function notifyCateringBookingCreated(params: {
  companyUserId: string;
  creatorName?: string | null;
  companyName: string;
  bookingId: string;
}) {
  await notifyUser({
    userId: params.companyUserId,
    type: "MARKETPLACE_CATERING_BOOKING",
    title: "New catering booking request",
    body: `${params.creatorName || "A creator"} requested catering from ${params.companyName}.`,
    metadata: { url: "/catering-company/bookings", bookingId: params.bookingId },
  });
}

export async function notifyCateringBookingStatus(params: {
  creatorUserId: string;
  companyName: string;
  status: string;
  bookingId: string;
}) {
  const approved = params.status === "APPROVED";
  await notifyUser({
    userId: params.creatorUserId,
    type: approved ? "MARKETPLACE_CATERING_APPROVED" : "MARKETPLACE_CATERING_DECLINED",
    title: approved ? "Catering booking approved" : "Catering booking updated",
    body: `Your catering request for ${params.companyName} is ${params.status.toLowerCase()}.`,
    metadata: { url: "/creator/catering", bookingId: params.bookingId },
  });
}

export async function notifyCrewRequestCreated(params: {
  teamUserId: string;
  creatorName?: string | null;
  teamName: string;
  requestId: string;
}) {
  await notifyUser({
    userId: params.teamUserId,
    type: "MARKETPLACE_CREW_REQUEST",
    title: "New crew team request",
    body: `${params.creatorName || "A creator"} sent a request to ${params.teamName}.`,
    metadata: { url: "/crew-team/requests", requestId: params.requestId },
  });
}

export async function notifyCrewRequestStatus(params: {
  creatorUserId: string;
  teamName: string;
  status: string;
  requestId: string;
}) {
  const accepted = params.status === "ACCEPTED";
  await notifyUser({
    userId: params.creatorUserId,
    type: accepted ? "MARKETPLACE_CREW_ACCEPTED" : "MARKETPLACE_CREW_DECLINED",
    title: accepted ? "Crew request accepted" : "Crew request updated",
    body: `${params.teamName} ${accepted ? "accepted" : "updated"} your crew request (${params.status.toLowerCase()}).`,
    metadata: { url: "/creator/crew", requestId: params.requestId },
  });
}

export async function notifyCastingInquiryCreated(params: {
  agencyUserId: string;
  creatorName?: string | null;
  agencyName: string;
  inquiryId: string;
}) {
  await notifyUser({
    userId: params.agencyUserId,
    type: "MARKETPLACE_CASTING_INQUIRY",
    title: "New casting inquiry",
    body: `${params.creatorName || "A creator"} contacted ${params.agencyName}.`,
    metadata: { url: "/casting-agency/inquiries", inquiryId: params.inquiryId },
  });
}

export async function notifyCastingInquiryStatus(params: {
  creatorUserId: string;
  agencyName: string;
  status: string;
  inquiryId: string;
}) {
  await notifyUser({
    userId: params.creatorUserId,
    type: "MARKETPLACE_CASTING_INQUIRY_UPDATE",
    title: "Casting inquiry update",
    body: `${params.agencyName} marked your inquiry as ${params.status.toLowerCase()}.`,
    metadata: { url: "/creator/cast", inquiryId: params.inquiryId },
  });
}
