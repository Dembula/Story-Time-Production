import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";
import { meetSummaryToPdfBuffer } from "@/lib/meet/summary-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const session = await requireCreatorSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summary = await prisma.meetSummary.findUnique({
      where: { id },
      include: {
        meeting: {
          select: {
            hostUserId: true,
            participants: { where: { userId: session.userId }, select: { id: true } },
          },
        },
      },
    });
    if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const allowed =
      summary.createdByUserId === session.userId ||
      summary.meeting.hostUserId === session.userId ||
      summary.meeting.participants.length > 0;
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const pdf = await meetSummaryToPdfBuffer({
      title: summary.title,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      decisions: summary.decisions,
      actionItems: summary.actionItems,
      durationSec: summary.durationSec,
      createdAt: summary.createdAt,
      recordingUrl: summary.recordingUrl,
    });
    const filename = `story-time-meet-${summary.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "summary"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[meet/summaries/pdf]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build PDF" },
      { status: 500 },
    );
  }
}
