import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { writeExecutiveAudit } from "@/lib/executive/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const department = searchParams.get("department");

  const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

  try {
    const events = await prisma.executiveCalendarEvent.findMany({
      where: {
        startsAt: { gte: start, lte: end },
        ...(department ? { department } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        attendees: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
    });

    await writeExecutiveAudit({
      userId: actor.userId,
      email: actor.email,
      office: actor.office,
      action: "VIEW_CALENDAR",
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        allDay: e.allDay,
        department: e.department,
        priority: e.priority,
        status: e.status,
        eventType: e.eventType,
        notes: e.notes,
        owner: e.owner,
        attendees: e.attendees.map((a) => ({
          userId: a.userId,
          response: a.response,
          user: a.user,
        })),
      })),
    });
  } catch (e) {
    console.error("GET /api/executive/calendar", e);
    return NextResponse.json({ events: [], error: "Calendar unavailable until migration is applied." });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
    department?: string;
    priority?: string;
    eventType?: string;
    notes?: string;
    attendeeIds?: string[];
  } | null;

  const title = body?.title?.trim();
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const startsAt = body?.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;
  if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Valid startsAt and endsAt required" }, { status: 400 });
  }

  try {
    const event = await prisma.executiveCalendarEvent.create({
      data: {
        title,
        description: body?.description?.trim() || null,
        startsAt,
        endsAt,
        ownerId: actor.userId,
        createdById: actor.userId,
        department: body?.department?.trim() || "EXECUTIVE",
        priority: body?.priority || "MEDIUM",
        eventType: body?.eventType || "MEETING",
        notes: body?.notes?.trim() || null,
        attendees: body?.attendeeIds?.length
          ? {
              create: body.attendeeIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
    });

    await writeExecutiveAudit({
      userId: actor.userId,
      email: actor.email,
      office: actor.office,
      action: "CREATE_CALENDAR_EVENT",
      entityType: "ExecutiveCalendarEvent",
      entityId: event.id,
    });

    return NextResponse.json({ event: { id: event.id } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/executive/calendar", e);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
