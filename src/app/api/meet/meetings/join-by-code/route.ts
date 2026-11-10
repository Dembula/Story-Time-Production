import { NextResponse } from "next/server";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { joinMeetAsUser } from "@/lib/meet/join";
import { MeetFullError } from "@/lib/meet/capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    code?: string;
    link?: string;
    passcode?: string;
  } | null;

  let code = String(body?.code ?? "").trim();
  if (!code && body?.link) {
    const m = String(body.link).match(/\/meet\/([^/?#]+)/i);
    if (m?.[1]) code = decodeURIComponent(m[1]);
  }
  if (!code) {
    return NextResponse.json({ error: "Meeting code or link required" }, { status: 400 });
  }

  const meeting = await resolveMeetByIdOrCode(code);
  if (!meeting) {
    return NextResponse.json(
      { error: "Meeting not found", details: "Check the code or ask the host for a new link." },
      { status: 404 },
    );
  }
  if (meeting.status === "ENDED") {
    return NextResponse.json({ error: "This meeting has ended" }, { status: 410 });
  }

  const isHost = meeting.hostUserId === session.userId;
  if (meeting.passcode && !isHost && String(body?.passcode ?? "").trim() !== meeting.passcode) {
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
