import "server-only";

import { prisma } from "@/lib/prisma";
import { enrichContentById } from "./enrich-content";
import { contentHasScriptSource } from "./resolve-content-script";

/** Queue AI scene intelligence when a title has script sources but no scene rows yet. */
export async function ensureSceneIntelligence(contentId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY?.trim()) return;

  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      scriptUrl: true,
      tags: true,
      linkedProjectId: true,
      enrichment: { select: { status: true } },
      _count: { select: { scenes: true } },
    },
  });
  if (!content) return;
  if (content._count.scenes > 0) return;
  if (content.enrichment?.status === "PROCESSING") return;
  if (!contentHasScriptSource(content)) return;

  await enrichContentById(contentId);
}
