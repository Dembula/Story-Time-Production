import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createCreatorCalendarEvent,
  getCommandCenterCalendar,
  parseCalendarMonthParam,
} from "@/lib/creator-command-center-calendar";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

function creatorRoleOk(role: string | undefined) {
  return role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR" || role === "ADMIN";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creatorRoleOk(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const month = parseCalendarMonthParam(req.nextUrl.searchParams.get("month"));

  try {
    const payload = await getCommandCenterCalendar(userId, month);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[command-center/calendar GET]", e);
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creatorRoleOk(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title : "";
  const description = typeof b.description === "string" ? b.description : null;
  const startAt = typeof b.startAt === "string" ? b.startAt : "";
  const endAt = typeof b.endAt === "string" ? b.endAt : null;
  const allDay = b.allDay !== false;
  const visibility = b.visibility === "TEAM" ? "TEAM" : "PERSONAL";
  const projectId = typeof b.projectId === "string" && b.projectId.trim() ? b.projectId.trim() : null;
  const assigneeId = typeof b.assigneeId === "string" && b.assigneeId.trim() ? b.assigneeId.trim() : null;

  if (!startAt) return NextResponse.json({ error: "startAt is required" }, { status: 400 });

  try {
    const created = await createCreatorCalendarEvent(userId, {
      title,
      description,
      startAt,
      endAt,
      allDay,
      visibility,
      projectId,
      assigneeId,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create event";
    if (isPrismaMissingTable(e, "CreatorCalendarEvent")) {
      return NextResponse.json(
        { error: "Calendar tasks are not available until database migrations are applied." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
