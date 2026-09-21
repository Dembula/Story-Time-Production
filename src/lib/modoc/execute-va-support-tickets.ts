import "server-only";

import type { ModocActionPayload, ModocActionType } from "@/lib/modoc/action-types";
import type { ModocActionResult } from "@/lib/modoc/actions";
import {
  createVaSupportTicket,
  formatTicketForVa,
  listCreatorVaSupportTickets,
  lookupVaSupportTicket,
  type VaTicketKind,
  VA_TICKET_KINDS,
} from "@/lib/modoc/va-support-tickets";

function resolveKind(payload: ModocActionPayload): VaTicketKind {
  const raw = (payload.kind || payload.ticketKind || "FEATURE").toString().toUpperCase();
  if ((VA_TICKET_KINDS as readonly string[]).includes(raw)) return raw as VaTicketKind;
  if (raw.includes("BUG")) return "BUG";
  if (raw.includes("IMPROVE")) return "IMPROVEMENT";
  if (raw.includes("QUEST")) return "QUESTION";
  return "FEATURE";
}

export async function executeVaSupportTicketAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult | null> {
  if (
    action !== "submit_support_ticket" &&
    action !== "lookup_support_ticket" &&
    action !== "list_my_support_tickets"
  ) {
    return null;
  }

  if (action === "submit_support_ticket") {
    const title = (payload.title || payload.name || "").toString().trim();
    const description = (
      payload.description ||
      payload.notes ||
      payload.content ||
      payload.message ||
      ""
    )
      .toString()
      .trim();
    if (!title || !description) {
      return {
        ok: false,
        error: "Need a short title and a description to file the ticket.",
        status: 400,
      };
    }
    try {
      const ticket = await createVaSupportTicket({
        userId,
        kind: resolveKind(payload),
        title,
        description,
        sourceSurface: payload.sourceSurface?.toString() || null,
        sourcePath: payload.sourcePath?.toString() || null,
        toolSlug: payload.toolSlug?.toString() || payload.category?.toString() || null,
        projectId: payload.projectId || null,
        conversationId: null,
      });
      return {
        ok: true,
        message: `Ticket ${ticket.ticketNumber} filed (${ticket.kind}). Tell the creator this number and that they can ask you anytime for status.`,
        data: {
          ticketNumber: ticket.ticketNumber,
          status: ticket.status,
          kind: ticket.kind,
          title: ticket.title,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Could not create ticket",
        status: 500,
      };
    }
  }

  if (action === "lookup_support_ticket") {
    const raw =
      payload.ticketNumber ||
      payload.name ||
      payload.title ||
      payload.message ||
      "";
    const ticket = await lookupVaSupportTicket({
      userId,
      ticketNumber: raw.toString(),
    });
    if (!ticket) {
      return {
        ok: false,
        error: "I couldn't find that ticket under your account. Double-check the number (e.g. ST-1042).",
        status: 404,
      };
    }
    return {
      ok: true,
      message: formatTicketForVa(ticket),
      data: {
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        kind: ticket.kind,
        title: ticket.title,
        creatorVisibleNote: ticket.creatorVisibleNote,
      },
    };
  }

  const tickets = await listCreatorVaSupportTickets(userId, 12);
  if (tickets.length === 0) {
    return {
      ok: true,
      message: "You don't have any support tickets yet.",
      data: { tickets: [] },
    };
  }
  return {
    ok: true,
    message: tickets.map(formatTicketForVa).join("\n"),
    data: {
      tickets: tickets.map((t) => ({
        ticketNumber: t.ticketNumber,
        status: t.status,
        kind: t.kind,
        title: t.title,
      })),
    },
  };
}
