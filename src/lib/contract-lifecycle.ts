import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { notifyUser } from "@/lib/notify-user";
import { contractNotificationLink, contractProjectLink } from "@/lib/contract-notification";
import { assertApprovalsComplete } from "@/lib/legal/contract-approval-service";
import { emailGuestSignLinks, listContractSigners } from "@/lib/legal/contract-signer-service";
import { publishStakeholderSyncEvent } from "@/lib/stakeholder-ecosystem/sync-events";

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

export async function logContractEvent(
  contractId: string,
  eventType: string,
  opts?: { userId?: string; detail?: string; metadata?: Record<string, unknown> }
) {
  await prisma.projectContractEvent.create({
    data: {
      contractId,
      userId: opts?.userId ?? null,
      eventType,
      detail: opts?.detail ?? null,
      metadata: (opts?.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function sendProjectContract(
  contractId: string,
  senderUserId: string,
  opts?: { signatureDeadline?: Date | null }
) {
  const contract = await prisma.projectContract.findUnique({
    where: { id: contractId },
    include: {
      project: { select: { title: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!contract) throw new Error("Contract not found");

  const recipientUserId = contract.counterpartyUserId;
  const recipientLabel =
    contract.recipientLabel?.trim() ||
    contract.vendorName?.trim() ||
  contract.subject?.trim();
  if (!recipientUserId && !contract.recipientEmail?.trim()) {
    throw new Error("Select a recipient before sending this contract.");
  }

  const approvalCheck = await assertApprovalsComplete(contractId);
  if (!approvalCheck.ok) {
    throw new Error(approvalCheck.reason ?? "Complete internal approvals before sending.");
  }

  const sendableStatuses = ["DRAFT", "READY_TO_SEND", "UNDER_REVIEW", "INTERNAL_APPROVAL", "CHANGES_REQUESTED"];
  if (!sendableStatuses.includes(contract.status)) {
    throw new Error(`Cannot send contract in status ${contract.status}`);
  }

  const now = new Date();
  const updated = await prisma.projectContract.update({
    where: { id: contractId },
    data: {
      status: "SENT",
      sentAt: now,
      signatureDeadline: opts?.signatureDeadline ?? contract.signatureDeadline,
    },
  });

  await logContractEvent(contractId, "SENT", {
    userId: senderUserId,
    detail: `Sent to ${recipientLabel ?? "recipient"}`,
    metadata: { recipientUserId, recipientEmail: contract.recipientEmail },
  });

  if (recipientUserId) {
    await notifyUser({
      userId: recipientUserId,
      type: "CONTRACT_SENT",
      title: "Contract for your review",
      body: `${contract.project.title}: ${contract.subject ?? "Contract"} — please review and sign.`,
      metadata: {
        contractId,
        projectId: contract.projectId,
        url: contractNotificationLink(contractId, contract.projectId),
      },
    });
  }

  const signers = await listContractSigners(contractId);
  const guestEmails = signers.filter((s) => !s.userId && s.email).length;
  if (guestEmails > 0 || (!recipientUserId && contract.recipientEmail?.trim())) {
    await emailGuestSignLinks(contractId, contract.project.title, contract.subject ?? "Contract");
  }

  try {
    await publishStakeholderSyncEvent({
      projectId: contract.projectId,
      eventType: "CONTRACT_SENT",
      payload: { contractId, subject: contract.subject },
    });
  } catch {
    /* non-blocking */
  }

  return updated;
}

export async function markContractViewed(contractId: string, viewerUserId: string) {
  const contract = await prisma.projectContract.findUnique({ where: { id: contractId } });
  if (!contract) return null;
  if (contract.counterpartyUserId && contract.counterpartyUserId !== viewerUserId) {
    return contract;
  }
  if (contract.status !== "SENT" && contract.status !== "VIEWED") return contract;

  const updated =
    contract.viewedAt == null
      ? await prisma.projectContract.update({
          where: { id: contractId },
          data: { status: "VIEWED", viewedAt: new Date() },
        })
      : contract;

  if (contract.viewedAt == null) {
    await logContractEvent(contractId, "VIEWED", { userId: viewerUserId });
    if (contract.createdById) {
      await notifyUser({
        userId: contract.createdById,
        type: "CONTRACT_VIEWED",
        title: "Contract viewed",
        body: `${contract.subject ?? "Contract"} was opened by the recipient.`,
        metadata: {
          contractId,
          projectId: contract.projectId,
          url: contractProjectLink(contract.projectId, contractId),
        },
      });
    }
  }
  return updated;
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
