import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { linkOrIngestStreamForUrl } from "@/lib/stream-ingest-link";

const DEFAULT_TAKE_STATUSES = ["approved", "circle"];

/**
 * Promote approved dailies clips into post-production footage assets so
 * editing / VFX / color tools can consume production media. Idempotent:
 * clips already promoted (tracked via metadata.sourceDailiesClipId) are skipped.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | { takeStatuses?: string[]; clipIds?: string[] }
    | null;

  const takeStatuses =
    Array.isArray(body?.takeStatuses) && body.takeStatuses.length > 0
      ? body.takeStatuses.filter((s) => typeof s === "string")
      : DEFAULT_TAKE_STATUSES;

  const clips = await prisma.dailiesClip.findMany({
    where: {
      projectId,
      videoUrl: { not: null },
      ...(Array.isArray(body?.clipIds) && body.clipIds.length > 0
        ? { id: { in: body.clipIds } }
        : { takeStatus: { in: takeStatuses } }),
    },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      sceneId: true,
      shootDayId: true,
      shotNumber: true,
      takeNumber: true,
      slate: true,
      camera: true,
      takeStatus: true,
      scene: { select: { number: true, heading: true } },
    },
    orderBy: [{ sceneId: "asc" }, { sortOrder: "asc" }],
  });

  if (clips.length === 0) {
    return NextResponse.json({ promoted: 0, skipped: 0, message: "No matching dailies clips to promote." });
  }

  // Idempotency: find footage assets already created from these clips.
  const existingAssets = await prisma.footageAsset.findMany({
    where: { projectId, metadata: { contains: "sourceDailiesClipId" } },
    select: { metadata: true },
  });
  const promotedClipIds = new Set<string>();
  for (const asset of existingAssets) {
    try {
      const meta = JSON.parse(asset.metadata ?? "{}") as { sourceDailiesClipId?: string };
      if (meta.sourceDailiesClipId) promotedClipIds.add(meta.sourceDailiesClipId);
    } catch {
      // ignore malformed metadata
    }
  }

  let promoted = 0;
  let skipped = 0;
  const created: { id: string; fileUrl: string }[] = [];

  for (const clip of clips) {
    if (!clip.videoUrl || promotedClipIds.has(clip.id)) {
      skipped++;
      continue;
    }

    const labelParts = [
      clip.scene?.number ? `Scene ${clip.scene.number}` : null,
      clip.slate || clip.shotNumber || null,
      clip.takeNumber ? `Take ${clip.takeNumber}` : null,
      clip.title || null,
    ].filter(Boolean);

    const asset = await prisma.footageAsset.create({
      data: {
        projectId,
        sceneId: clip.sceneId ?? null,
        type: "RAW_FOOTAGE",
        label: labelParts.join(" · ") || "Dailies clip",
        fileUrl: clip.videoUrl,
        metadata: JSON.stringify({
          sourceDailiesClipId: clip.id,
          shootDayId: clip.shootDayId,
          camera: clip.camera,
          takeStatus: clip.takeStatus,
          promotedAt: new Date().toISOString(),
        }),
      },
    });
    created.push({ id: asset.id, fileUrl: asset.fileUrl });
    promoted++;
  }

  after(async () => {
    for (const asset of created) {
      await linkOrIngestStreamForUrl(asset.fileUrl, "FootageAsset", asset.id, {
        area: "footage",
        projectId,
      }).catch(() => {});
    }
  });

  return NextResponse.json({ promoted, skipped, total: clips.length }, { status: promoted > 0 ? 201 : 200 });
}
