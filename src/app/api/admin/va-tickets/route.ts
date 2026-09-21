import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiPath } from "@/lib/admin-api-auth";
import {
  VA_TICKET_STATUSES,
  type VaTicketStatus,
} from "@/lib/modoc/va-support-tickets";

export async function GET(req: NextRequest) {
  const actor = await requireAdminApiPath("/api/admin/va-tickets");
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const kind = searchParams.get("kind");
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (kind && kind !== "all") where.kind = kind;
  if (q) {
    where.OR = [
      { ticketNumber: { contains: q.toUpperCase(), mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { createdBy: { email: { contains: q, mode: "insensitive" } } },
      { createdBy: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [tickets, counts] = await Promise.all([
    prisma.vaSupportTicket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.vaSupportTicket.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;

  return NextResponse.json({ tickets, byStatus });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminApiPath("/api/admin/va-tickets");
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const body = await req.json().catch(() => ({}));
  const {
    id,
    status,
    adminNotes,
    creatorVisibleNote,
  } = body as {
    id?: string;
    status?: string;
    adminNotes?: string | null;
    creatorVisibleNote?: string | null;
  };

  if (!id || !status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }
  if (!(VA_TICKET_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.vaSupportTicket.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (status === "REJECTED") {
    const note = (creatorVisibleNote ?? adminNotes ?? "").toString().trim();
    if (!note) {
      return NextResponse.json(
        { error: "Add a creator-facing note when rejecting so the VA can explain why." },
        { status: 400 },
      );
    }
  }

  const terminal = ["FIXED", "APPROVED", "REJECTED", "CLOSED"].includes(status);
  const updated = await prisma.vaSupportTicket.update({
    where: { id },
    data: {
      status: status as VaTicketStatus,
      adminNotes:
        adminNotes === undefined ? undefined : adminNotes?.toString().trim() || null,
      creatorVisibleNote:
        creatorVisibleNote === undefined
          ? undefined
          : creatorVisibleNote?.toString().trim() || null,
      reviewedById: actor.id,
      reviewedAt: terminal || status === "IN_PROGRESS" ? new Date() : existing.reviewedAt,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(updated);
}
