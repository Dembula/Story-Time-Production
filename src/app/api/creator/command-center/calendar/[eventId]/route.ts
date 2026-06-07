import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteCreatorCalendarEvent,
  updateCreatorCalendarEvent,
} from "@/lib/creator-command-center-calendar";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

function creatorRoleOk(role: string | undefined) {
  return role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR" || role === "ADMIN";
}

type RouteCtx = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creatorRoleOk(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateCreatorCalendarEvent>[2] = {};
  if (typeof b.title === "string") patch.title = b.title;
  if (typeof b.description === "string" || b.description === null) patch.description = b.description as string | null;
  if (typeof b.startAt === "string") patch.startAt = b.startAt;
  if (typeof b.endAt === "string" || b.endAt === null) patch.endAt = b.endAt as string | null;
  if (typeof b.allDay === "boolean") patch.allDay = b.allDay;
  if (b.visibility === "TEAM" || b.visibility === "PERSONAL") patch.visibility = b.visibility;
  if (typeof b.projectId === "string" || b.projectId === null) patch.projectId = b.projectId as string | null;
  if (typeof b.assigneeId === "string" || b.assigneeId === null) patch.assigneeId = b.assigneeId as string | null;

  try {
    await updateCreatorCalendarEvent(userId, eventId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update event";
    if (isPrismaMissingTable(e, "CreatorCalendarEvent")) {
      return NextResponse.json({ error: "Calendar database not ready" }, { status: 503 });
    }
    const status = msg.includes("not found") ? 404 : msg.includes("Not allowed") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!creatorRoleOk(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId } = await ctx.params;

  try {
    await deleteCreatorCalendarEvent(userId, eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete event";
    if (isPrismaMissingTable(e, "CreatorCalendarEvent")) {
      return NextResponse.json({ error: "Calendar database not ready" }, { status: 503 });
    }
    const status = msg.includes("not found") ? 404 : msg.includes("Not allowed") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
