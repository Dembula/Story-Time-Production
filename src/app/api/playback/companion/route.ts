import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildPlaybackCompanion } from "@/lib/playback-ai/companion";
import { applySpoilerGate } from "@/lib/playback-ai/spoiler-policy";

export const maxDuration = 15;

/** Async playback companion — never blocks HLS; client fetches in background. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const url = new URL(req.url);
  const contentId = url.searchParams.get("contentId")?.trim();
  const positionRaw = url.searchParams.get("positionSeconds");
  const durationRaw = url.searchParams.get("durationSeconds");
  const positionSeconds = positionRaw ? Math.max(0, parseFloat(positionRaw)) : 0;
  const durationSeconds =
    durationRaw && Number.isFinite(parseFloat(durationRaw)) ? Math.max(0, parseFloat(durationRaw)) : null;

  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  try {
    const payload = await buildPlaybackCompanion({
      contentId,
      positionSeconds,
      userId,
    });
    const gated = applySpoilerGate(payload, { positionSeconds, durationSeconds });
    return NextResponse.json(gated, {
      headers: {
        "Cache-Control": "private, max-age=8",
      },
    });
  } catch (e) {
    console.error("Playback companion error:", e);
    return NextResponse.json(
      {
        contentId,
        positionSeconds,
        scene: null,
        graph: null,
        ragSnippets: [],
        trivia: [],
        spoilerSafe: true,
        watchProgressPercent: 0,
      },
      { status: 200 },
    );
  }
}
