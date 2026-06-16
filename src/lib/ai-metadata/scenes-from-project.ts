import "server-only";

import { prisma } from "@/lib/prisma";
import type { SceneSegment } from "./types";

/** Map synced project screenplay scenes + breakdown cast into playback scene rows. */
export async function buildPlaybackScenesFromLinkedProject(
  linkedProjectId: string,
  durationSeconds: number | null,
): Promise<SceneSegment[] | null> {
  const rows = await prisma.projectScene.findMany({
    where: { projectId: linkedProjectId },
    orderBy: { number: "asc" },
    include: {
      breakdownCharacters: { select: { name: true } },
    },
  });

  if (rows.length === 0) return null;

  const runtime = Math.max(durationSeconds ?? 0, rows.length * 30, 60);
  const count = rows.length;

  return rows.map((scene, index) => {
    const startSeconds = (index / count) * runtime;
    const endSeconds = ((index + 1) / count) * runtime;
    const actors = scene.breakdownCharacters
      .map((c) => c.name.trim())
      .filter(Boolean);
    const summary =
      scene.summary?.trim() ||
      scene.heading?.trim() ||
      `Scene ${scene.number}`;

    return {
      startSeconds,
      endSeconds,
      summary,
      mood: scene.timeOfDay?.toLowerCase() ?? undefined,
      actors,
      tags: [scene.intExt, scene.timeOfDay].filter((v): v is string => Boolean(v?.trim())),
    };
  });
}
