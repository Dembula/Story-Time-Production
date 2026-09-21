import { NextRequest, NextResponse } from "next/server";
import { ensureScriptAccess } from "@/lib/script-studio/collaboration-access";
import { prisma } from "@/lib/prisma";
import type { StoryCardMeta } from "@/lib/script-studio/story-cards";

type RouteParams = { params: Promise<{ scriptId: string }> };

type StudioMeta = {
  storyCards?: StoryCardMeta[];
  sceneColors?: Record<string, string>;
  lockedScenes?: string[];
  /** Title-page "Written by" credit for this script only (not account name). */
  writerCredit?: string;
  /** TV/series episode title shown under the series name on the title page. */
  episodeTitle?: string;
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;

  const meta = (gate.access.script.studioMeta ?? {}) as StudioMeta;
  return NextResponse.json({
    storyCards: meta.storyCards ?? [],
    sceneColors: meta.sceneColors ?? {},
    lockedScenes: meta.lockedScenes ?? [],
    writerCredit:
      typeof meta.writerCredit === "string" ? meta.writerCredit : undefined,
    episodeTitle:
      typeof meta.episodeTitle === "string" ? meta.episodeTitle : undefined,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { scriptId } = await params;
  const gate = await ensureScriptAccess(scriptId);
  if (gate.error) return gate.error;
  if (!gate.access.canWrite) {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<StudioMeta> | null;
  const prev = (gate.access.script.studioMeta ?? {}) as StudioMeta;
  const next: StudioMeta = {
    ...prev,
    storyCards: body?.storyCards ?? prev.storyCards ?? [],
    sceneColors: body?.sceneColors ?? prev.sceneColors ?? {},
    lockedScenes: body?.lockedScenes ?? prev.lockedScenes ?? [],
  };
  if (body && "writerCredit" in body) {
    const credit = typeof body.writerCredit === "string" ? body.writerCredit.trim() : "";
    if (credit) next.writerCredit = credit;
    else delete next.writerCredit;
  }
  if (body && "episodeTitle" in body) {
    const ep = typeof body.episodeTitle === "string" ? body.episodeTitle.trim() : "";
    if (ep) next.episodeTitle = ep;
    else delete next.episodeTitle;
  }

  const script = await prisma.creatorScript.update({
    where: { id: scriptId },
    data: { studioMeta: next },
  });

  return NextResponse.json({ studioMeta: script.studioMeta });
}
