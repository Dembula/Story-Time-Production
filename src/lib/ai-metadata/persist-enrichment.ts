import "server-only";

import { prisma } from "@/lib/prisma";
import { embedText } from "./embeddings";
import type { EnrichmentResult, SceneSegment } from "./types";

export type SceneIntelligenceSource = "script" | "project" | "catalogue";

export async function persistEnrichmentResult(
  contentId: string,
  input: {
    title: string;
    description?: string | null;
    parsed: EnrichmentResult;
    sceneSource: SceneIntelligenceSource;
    scriptLabel?: string | null;
  },
): Promise<EnrichmentResult> {
  const embedInput = [
    input.title,
    input.description,
    input.parsed.narrativeSummary,
    input.parsed.moodTags?.join(", "),
    input.parsed.atmosphere,
    input.scriptLabel,
  ]
    .filter(Boolean)
    .join("\n");
  const embedding = (await embedText(embedInput)) ?? [];

  const enrichment = await prisma.contentEnrichment.upsert({
    where: { contentId },
    create: { contentId, status: "PROCESSING" },
    update: { status: "PROCESSING", error: null },
  });

  await prisma.contentEnrichment.update({
    where: { id: enrichment.id },
    data: {
      status: "READY",
      moodTags: input.parsed.moodTags ?? [],
      atmosphere: input.parsed.atmosphere ?? null,
      pacing: input.parsed.pacing ?? null,
      narrativeJson: {
        summary: input.parsed.narrativeSummary,
        sceneSource: input.sceneSource,
        scriptLabel: input.scriptLabel ?? null,
      },
      dialogueIndex: input.parsed.dialogueIndex ?? [],
      embedding,
      processedAt: new Date(),
      error: null,
    },
  });

  await prisma.contentScene.deleteMany({ where: { contentId } });
  const scenes = (input.parsed.scenes ?? []) as SceneSegment[];
  if (scenes.length > 0) {
    await prisma.contentScene.createMany({
      data: scenes.map((s) => ({
        contentId,
        enrichmentId: enrichment.id,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        summary: s.summary,
        mood: s.mood ?? null,
        actors: s.actors ?? [],
        tags: s.tags ?? [],
      })),
    });
  }

  return { ...input.parsed, embedding };
}

export async function markEnrichmentFailed(contentId: string, error: unknown): Promise<void> {
  await prisma.contentEnrichment.upsert({
    where: { contentId },
    create: {
      contentId,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Enrichment failed",
    },
    update: {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Enrichment failed",
    },
  });
}
