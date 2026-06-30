/** Client-safe contract constants and helpers (no server imports). */

/** Statuses that block production scheduling until resolved. */
export const SCHEDULE_BLOCKING_STATUSES = [
  "SENT",
  "VIEWED",
  "CHANGES_REQUESTED",
  "PARTIALLY_SIGNED",
  "AWAITING_SIGNATURE",
] as const;

export const CONTRACT_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "INTERNAL_APPROVAL",
  "READY_TO_SEND",
  "SENT",
  "VIEWED",
  "PARTIALLY_SIGNED",
  "AWAITING_SIGNATURE",
  "EXECUTED",
  "COMPLETED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "ARCHIVED",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const RECIPIENT_TYPES = [
  "CAST_MEMBER",
  "CREW_MEMBER",
  "CASTING_AGENCY",
  "CREATOR",
  "LOCATION_OWNER",
  "VENDOR",
  "INVESTOR",
  "LAW_FIRM",
  "SPONSOR",
  "GOVERNMENT",
  "PRODUCTION_COMPANY",
  "DISTRIBUTOR",
  "STREAMING_PLATFORM",
  "MUSIC_PUBLISHER",
  "INSURANCE",
  "BANK",
  "MANUAL",
] as const;

export type RecipientType = (typeof RECIPIENT_TYPES)[number];

export function recipientTypeLabel(type: string | null | undefined): string {
  const labels: Record<string, string> = {
    CAST_MEMBER: "Cast member",
    CREW_MEMBER: "Crew member",
    CASTING_AGENCY: "Casting agency",
    CREATOR: "Creator",
    LOCATION_OWNER: "Location owner",
    VENDOR: "Vendor",
    INVESTOR: "Investor",
    LAW_FIRM: "Law firm",
    SPONSOR: "Sponsor",
    GOVERNMENT: "Government",
    PRODUCTION_COMPANY: "Production company",
    DISTRIBUTOR: "Distributor",
    STREAMING_PLATFORM: "Streaming platform",
    MUSIC_PUBLISHER: "Music publisher",
    INSURANCE: "Insurance",
    BANK: "Bank",
    MANUAL: "Manual entry",
  };
  return labels[type ?? ""] ?? type ?? "Recipient";
}

export function contractStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    UNDER_REVIEW: "Under review",
    INTERNAL_APPROVAL: "Internal approval",
    READY_TO_SEND: "Ready to send",
    SENT: "Sent",
    VIEWED: "Viewed",
    PARTIALLY_SIGNED: "Partially signed",
    AWAITING_SIGNATURE: "Awaiting signature",
    EXECUTED: "Executed",
    COMPLETED: "Completed",
    CHANGES_REQUESTED: "Changes requested",
    REJECTED: "Rejected",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
    ARCHIVED: "Archived",
  };
  return labels[status] ?? status;
}

export function watermarkForStatus(status: string): string | null {
  if (status === "DRAFT" || status === "UNDER_REVIEW" || status === "INTERNAL_APPROVAL") {
    return "DRAFT";
  }
  if (
    status === "SENT" ||
    status === "VIEWED" ||
    status === "PARTIALLY_SIGNED" ||
    status === "AWAITING_SIGNATURE" ||
    status === "READY_TO_SEND"
  ) {
    return "PENDING SIGNATURE";
  }
  if (status === "EXECUTED" || status === "COMPLETED") return "EXECUTED";
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "REJECTED" || status === "CANCELLED") return "VOID";
  return null;
}

export function canUserSignAsCreator(
  contract: { createdById: string | null; status: string },
  userId: string,
  isProjectMember: boolean
): boolean {
  if (!isProjectMember) return false;
  return (
    isProjectMember &&
    (contract.status === "PARTIALLY_SIGNED" || contract.status === "AWAITING_SIGNATURE")
  );
}

export function canUserRespondAsCounterparty(
  contract: { counterpartyUserId: string | null; status: string },
  userId: string
): boolean {
  if (!contract.counterpartyUserId || contract.counterpartyUserId !== userId) return false;
  return ["SENT", "VIEWED", "CHANGES_REQUESTED", "AWAITING_SIGNATURE"].includes(contract.status);
}
