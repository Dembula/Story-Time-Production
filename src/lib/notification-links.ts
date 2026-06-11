export type NotificationItem = {
  id: string;
  type: string;
  metadata?: string | null;
};

type NotificationMeta = {
  url?: string;
  requestId?: string;
  bookingId?: string;
  inquiryId?: string;
  contentId?: string;
  projectId?: string;
  pitchId?: string;
  threadId?: string;
  conversationId?: string;
  messageId?: string;
};

function parseMeta(raw: string | null | undefined): NotificationMeta {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as NotificationMeta;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function resolveNotificationUrl(
  n: NotificationItem,
  role?: string | null,
): string | null {
  const meta = parseMeta(n.metadata);
  if (meta.url && typeof meta.url === "string") return meta.url;

  if (meta.contentId) {
    if (role === "CONTENT_CREATOR" || role === "ADMIN") {
      return `/creator/catalogue/reviews/${meta.contentId}`;
    }
    return null;
  }
  if (meta.pitchId && meta.projectId) {
    return `/creator/projects/${meta.projectId}/overview`;
  }
  if (n.type === "VA_SUGGESTION" || n.type === "VA_ACTION_COMPLETE") {
    if (meta.url && typeof meta.url === "string") return meta.url;
    if (meta.projectId) {
      return `/creator/projects/${meta.projectId}/pre-production/script-breakdown`;
    }
  }

  if (meta.projectId) {
    return `/creator/projects/${meta.projectId}/overview`;
  }
  if (meta.pitchId) {
    return "/creator/originals/submit";
  }

  if (n.type.startsWith("MARKETPLACE_")) {
    if (role === "CREW_TEAM") return "/crew-team/requests";
    if (role === "LOCATION_OWNER") return "/location-owner/bookings";
    if (role === "CATERING_COMPANY") return "/catering-company/bookings";
    if (role === "EQUIPMENT_COMPANY") return "/equipment-company/requests";
    if (role === "CASTING_AGENCY") return "/casting-agency/inquiries";
    if (n.type.includes("EQUIPMENT")) return "/creator/equipment";
    if (n.type.includes("LOCATION")) return "/creator/locations";
    if (n.type.includes("CATERING")) return "/creator/catering";
    if (n.type.includes("CREW")) return "/creator/crew";
    if (n.type.includes("CASTING")) return "/creator/cast";
  }

  const networkLike =
    n.type.includes("NETWORK") ||
    n.type.includes("MESSAGE") ||
    n.type === "PROJECT_COLLAB_INVITE";
  if (networkLike) {
    const thread = meta.threadId || meta.conversationId || meta.messageId;
    if (role === "CREW_TEAM") {
      return thread
        ? `/crew-team/messages?thread=${encodeURIComponent(thread)}`
        : "/crew-team/messages";
    }
    if (role === "LOCATION_OWNER") {
      return thread
        ? `/location-owner/messages?thread=${encodeURIComponent(thread)}`
        : "/location-owner/messages";
    }
    if (role === "CATERING_COMPANY") {
      return thread
        ? `/catering-company/messages?thread=${encodeURIComponent(thread)}`
        : "/catering-company/messages";
    }
    if (role === "EQUIPMENT_COMPANY") {
      return thread
        ? `/equipment-company/messages?thread=${encodeURIComponent(thread)}`
        : "/equipment-company/messages";
    }
    if (role === "CASTING_AGENCY") {
      return thread
        ? `/casting-agency/invitations?thread=${encodeURIComponent(thread)}`
        : "/casting-agency/invitations";
    }
    return thread
      ? `/creator/network?tab=messages&thread=${encodeURIComponent(thread)}`
      : "/creator/network?tab=messages";
  }

  return null;
}

export function notificationActionLabel(n: NotificationItem): string {
  if (n.type === "VA_ACTION_COMPLETE") return "View result";
  if (n.type.includes("MESSAGE") || n.type.includes("NETWORK")) return "View message";
  if (n.type.includes("INVITE")) return "View invite";
  if (n.type.includes("CONTRACT")) return "View contract";
  if (n.type.startsWith("MARKETPLACE_")) return "View request";
  return "Open";
}

