import { NextResponse } from "next/server";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { joinMeetAsUser } from "@/lib/meet/join";
import { MeetFullError } from "@/lib/meet/capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  if (meeting.status === "ENDED") {
    return NextResponse.json({ error: "This meeting has ended" }, { status: 410 });
  }

  const body = (await req.json().catch(() => null)) as {
    passcode?: string;
    joinIntent?: "host" | "participant";
  } | null;

  const isHost = meeting.hostUserId === session.userId || body?.joinIntent === "host";
  if (
    meeting.passcode &&
    !isHost &&
    String(body?.passcode ?? "").trim() !== meeting.passcode
  ) {
    return NextResponse.json(
      { error: "Passcode required", code: "PASSCODE_REQUIRED" },
      { status: 403 },
    );
  }

  try {
    const result = await joinMeetAsUser({
      meetingId: meeting.id,
      userId: session.userId,
      asHost: isHost,
    });
    return NextResponse.json({
      ok: true,
      meeting: result.meeting,
      participant: result.participant,
      role: result.role,
      dbMeetingId: meeting.id,
      capacity: result.capacity,
    });
  } catch (err) {
    if (err instanceof MeetFullError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          occupied: err.occupied,
          capacity: err.capacity,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join" },
      { status: 400 },
    );
  }
}
