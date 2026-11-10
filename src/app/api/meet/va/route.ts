import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { generateMeetSummaryReport } from "@/lib/meet/va";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetingId = new URL(req.url).searchParams.get("meetingId")?.trim();
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });

  const meeting = await resolveMeetByIdOrCode(meetingId);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await prisma.meetNote.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    mode?: "note" | "report";
    meetingId?: string;
    body?: string;
    source?: "MANUAL" | "VA" | "SPEECH";
    endMeeting?: boolean;
    recordingUrl?: string | null;
  } | null;

  const meetingId = String(body?.meetingId ?? "").trim();
  const meeting = await resolveMeetByIdOrCode(meetingId);
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  if (body?.mode === "note") {
    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ error: "Note body required" }, { status: 400 });
    const source =
      body.source === "SPEECH" || body.source === "VA" || body.source === "MANUAL"
        ? body.source
        : "MANUAL";
    const note = await prisma.meetNote.create({
      data: {
        meetingId: meeting.id,
        authorUserId: session.userId,
        source,
        body: text,
      },
    });
    return NextResponse.json({ ok: true, note });
  }

  // mode === report (default)
  const notes = await prisma.meetNote.findMany({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "asc" },
  });
  const participantCount = await prisma.meetParticipant.count({
    where: { meetingId: meeting.id },
  });
  const started = meeting.startedAt ?? meeting.createdAt;
  const ended = meeting.endedAt ?? new Date();
  const durationSec = Math.max(0, Math.floor((ended.getTime() - started.getTime()) / 1000));

  const report = await generateMeetSummaryReport({
    title: meeting.title,
    notes: notes.map((n) => n.body),
    transcript: notes
      .filter((n) => n.source === "SPEECH")
      .map((n) => n.body)
      .join("\n"),
    elapsedMinutes: durationSec / 60,
    participantCount,
  });

  if (body?.endMeeting !== false) {
    await prisma.meetMeeting.update({
      where: { id: meeting.id },
      data: { status: "ENDED", endedAt: meeting.endedAt ?? new Date() },
    });
    await prisma.meetParticipant.updateMany({
      where: { meetingId: meeting.id, leftAt: null },
      data: { leftAt: new Date() },
    });
  }

  const recordingUrl =
    typeof body?.recordingUrl === "string" && body.recordingUrl.trim()
      ? body.recordingUrl.trim()
      : undefined;

  const summary = await prisma.meetSummary.upsert({
    where: { meetingId: meeting.id },
    create: {
      meetingId: meeting.id,
      createdByUserId: session.userId,
      title: meeting.title,
      summary: report.summary,
      keyPoints: report.keyPoints,
      decisions: report.decisions,
      actionItems: report.actionItems,
      transcript: notes.map((n) => n.body).join("\n"),
      recordingUrl: recordingUrl ?? null,
      durationSec,
    },
    update: {
      summary: report.summary,
      keyPoints: report.keyPoints,
      decisions: report.decisions,
      actionItems: report.actionItems,
      transcript: notes.map((n) => n.body).join("\n"),
      durationSec,
      ...(recordingUrl ? { recordingUrl } : {}),
    },
  });

  return NextResponse.json({ ok: true, summary, report });
}
