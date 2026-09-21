import "server-only";

import { prisma } from "@/lib/prisma";

export const VA_TICKET_KINDS = ["FEATURE", "BUG", "IMPROVEMENT", "QUESTION"] as const;
export type VaTicketKind = (typeof VA_TICKET_KINDS)[number];

export const VA_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "APPROVED",
  "FIXED",
  "REJECTED",
  "CLOSED",
] as const;
export type VaTicketStatus = (typeof VA_TICKET_STATUSES)[number];

export function normalizeTicketNumber(raw: string): string | null {
  const trimmed = raw.trim().toUpperCase();
  if (/^ST-\d{3,}$/.test(trimmed)) return trimmed;
  if (/^\d{3,}$/.test(trimmed)) return `ST-${trimmed}`;
  const m = trimmed.match(/ST[\s#-]*(\d{3,})/);
  if (m) return `ST-${m[1]}`;
  return null;
}

export function statusLabelForCreator(status: string): string {
  switch (status) {
    case "OPEN":
      return "submitted — waiting for the admin team";
    case "IN_PROGRESS":
      return "in progress — the team is working on it";
    case "APPROVED":
      return "approved — accepted for the roadmap";
    case "FIXED":
      return "fixed / resolved";
    case "REJECTED":
      return "not moving forward right now";
    case "CLOSED":
      return "closed";
    default:
      return status.toLowerCase();
  }
}

async function nextTicketSeq(): Promise<number> {
  const last = await prisma.vaSupportTicket.findFirst({
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  return (last?.seq ?? 1000) + 1;
}

export async function createVaSupportTicket(input: {
  userId: string;
  kind: VaTicketKind;
  title: string;
  description: string;
  sourceSurface?: string | null;
  sourcePath?: string | null;
  toolSlug?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
}) {
  const title = input.title.trim().slice(0, 200);
  const description = input.description.trim().slice(0, 8000);
  if (!title || !description) {
    throw new Error("Title and description are required.");
  }
  const kind = VA_TICKET_KINDS.includes(input.kind) ? input.kind : "FEATURE";

  // Retry on rare seq collisions.
  for (let attempt = 0; attempt < 3; attempt++) {
    const seq = await nextTicketSeq();
    const ticketNumber = `ST-${seq}`;
    try {
      return await prisma.vaSupportTicket.create({
        data: {
          ticketNumber,
          seq,
          kind,
          title,
          description,
          status: "OPEN",
          sourceSurface: input.sourceSurface ?? undefined,
          sourcePath: input.sourcePath ?? undefined,
          toolSlug: input.toolSlug ?? undefined,
          projectId: input.projectId ?? undefined,
          conversationId: input.conversationId ?? undefined,
          createdById: input.userId,
        },
      });
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  throw new Error("Could not allocate a ticket number.");
}

export async function lookupVaSupportTicket(params: {
  userId: string;
  ticketNumber: string;
  /** Admins can look up any ticket; creators only their own. */
  asAdmin?: boolean;
}) {
  const ticketNumber = normalizeTicketNumber(params.ticketNumber);
  if (!ticketNumber) return null;
  const ticket = await prisma.vaSupportTicket.findUnique({
    where: { ticketNumber },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!ticket) return null;
  if (!params.asAdmin && ticket.createdById !== params.userId) return null;
  return ticket;
}

export async function listCreatorVaSupportTickets(userId: string, take = 12) {
  return prisma.vaSupportTicket.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export function formatTicketForVa(ticket: {
  ticketNumber: string;
  kind: string;
  title: string;
  status: string;
  creatorVisibleNote: string | null;
  adminNotes?: string | null;
  updatedAt: Date;
}): string {
  const note =
    ticket.creatorVisibleNote?.trim() ||
    (ticket.status === "REJECTED" ? ticket.adminNotes?.trim() : null) ||
    null;
  const noteLine = note ? ` Note for you: ${note}` : "";
  return `${ticket.ticketNumber} (${ticket.kind}) “${ticket.title}” — ${statusLabelForCreator(ticket.status)}.${noteLine}`;
}
