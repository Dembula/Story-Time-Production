import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMeetRtcIdentity } from "@/lib/meet/access";
import { noteFromDbRow } from "@/lib/meet/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Recent in-meeting chat for admitted peers (hosts + guests). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId: rawId } = await ctx.params;
  const meeting = await prisma.meetMeeting.findFirst({
    where: { OR: [{ id: rawId }, { code: rawId }, { code: rawId.toUpperCase() }] },
    select: { id: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const identity = await resolveMeetRtcIdentity(meeting.id);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.kind === "guest" && identity.status === "WAITING") {
    return NextResponse.json({ error: "Waiting for host admission" }, { status: 403 });
  }

  const rows = await prisma.meetNote.findMany({
    where: { meetingId: meeting.id, source: "CHAT" },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  return NextResponse.json({
    messages: rows.map((row) => {
      const note = noteFromDbRow(row);
      return {
        id: note.id,
        text: note.text,
        speakerName: note.speakerName,
        speakerPeerId: note.speakerPeerId,
        at: note.at,
      };
    }),
  });
}
