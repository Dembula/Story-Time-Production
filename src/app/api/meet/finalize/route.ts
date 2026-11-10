import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { generateMeetSummaryReport } from "@/lib/meet/va";
import { notifyUser } from "@/lib/notify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Background-friendly Meet wrap-up: VA summary + optional recording URL + bell notify. */
export async function POST(req: Request) {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    meetingId?: string;
    recordingUrl?: string | null;
    notify?: boolean;
  } | null;

  const meeting = await resolveMeetByIdOrCode(String(body?.meetingId ?? "").trim());
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

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

  await prisma.meetMeeting.update({
    where: { id: meeting.id },
    data: { status: "ENDED", endedAt: meeting.endedAt ?? new Date() },
  });
  await prisma.meetParticipant.updateMany({
    where: { meetingId: meeting.id, leftAt: null },
    data: { leftAt: new Date() },
  });

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

  if (body?.notify !== false) {
    await notifyUser({
      userId: session.userId,
      type: "meet_summary_ready",
      title: "Meet summary ready",
      body: `“${meeting.title}” notes${recordingUrl ? " and recording" : ""} are ready.`,
      metadata: {
        meetingId: meeting.id,
        summaryId: summary.id,
        href: "/creator/meet/summaries",
        code: meeting.code,
      },
    });
  }

  return NextResponse.json({ ok: true, summary, report });
}
