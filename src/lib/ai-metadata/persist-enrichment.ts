import "server-only";

import { prisma } from "@/lib/prisma";
import { embedText } from "./embeddings";
import type { EnrichmentResult, SceneSegment } from "./types";

export type SceneIntelligenceSource = "script" | "project" | "catalogue";

export type ScriptAnalysisMeta = {
  used: boolean;
  sourceType: string | null;
  truncated?: boolean;
  error?: string | null;
  label?: string | null;
};

export async function persistEnrichmentResult(
  contentId: string,
  input: {
    title: string;
    description?: string | null;
    parsed: EnrichmentResult;
    sceneSource: SceneIntelligenceSource;
    scriptLabel?: string | null;
    scriptAnalysis?: ScriptAnalysisMeta | null;
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
        scriptAnalysis: input.scriptAnalysis ?? {
          used: input.sceneSource === "script",
          sourceType: input.sceneSource === "script" ? "script" : input.sceneSource,
          truncated: false,
          error: null,
          label: input.scriptLabel ?? null,
        },
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

  await indexRagFromEnrichment(contentId);
  await indexGraphFromEnrichment(contentId);

  const content = await prisma.content.findFirst({
    where: { id: contentId },
    select: { linkedProjectId: true },
  });
  if (content?.linkedProjectId) {
    await indexProjectGraph(content.linkedProjectId);
  }

  return { ...input.parsed, embedding };
}

async function indexProjectGraph(projectId: string): Promise<void> {
  try {
    const { syncProjectKnowledgeGraph } = await import("@/lib/ai-os/knowledge-graph/sync-project");
    await syncProjectKnowledgeGraph(projectId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("Project knowledge graph sync failed:", e);
    }
  }
}

async function indexGraphFromEnrichment(contentId: string): Promise<void> {
  try {
    const { syncContentKnowledgeGraph } = await import("@/lib/ai-os/knowledge-graph/sync-content");
    await syncContentKnowledgeGraph(contentId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("Knowledge graph sync failed:", e);
    }
  }
}

async function indexRagFromEnrichment(contentId: string): Promise<void> {
  try {
    const { indexCatalogueFromEnrichment, indexScenesForContent } = await import(
      "@/lib/ai-os/rag/index-catalogue"
    );
    await indexCatalogueFromEnrichment(contentId);
    await indexScenesForContent(contentId);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("RAG index from enrichment failed:", e);
    }
  }
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
