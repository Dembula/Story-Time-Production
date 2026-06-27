import { prisma } from "@/lib/prisma";
import { buildContentGraphContext, formatGraphContextForPrompt } from "@/lib/ai-os/knowledge-graph/query";
import { retrieveKnowledge } from "@/lib/ai-os/rag/retrieve";
import { logAiRequest } from "@/lib/ai-os/observability/log-request";

export type PlaybackCompanionPayload = {
  contentId: string;
  positionSeconds: number;
  scene: {
    id: string;
    summary: string | null;
    mood: string | null;
    actors: string[];
    startSeconds: number;
    endSeconds: number;
  } | null;
  graph: {
    actors: string[];
    genres: string[];
    themes: string[];
    festivals: string[];
    cast: string[];
    relatedTitles: string[];
  } | null;
  ragSnippets: string[];
  trivia: string[];
};

export async function buildPlaybackCompanion(params: {
  contentId: string;
  positionSeconds: number;
  userId?: string | null;
}): Promise<PlaybackCompanionPayload> {
  const started = Date.now();

  const [scene, graphCtx] = await Promise.all([
    prisma.contentScene.findFirst({
      where: {
        contentId: params.contentId,
        startSeconds: { lte: params.positionSeconds },
        endSeconds: { gt: params.positionSeconds },
      },
      select: {
        id: true,
        summary: true,
        mood: true,
        actors: true,
        startSeconds: true,
        endSeconds: true,
      },
    }),
    buildContentGraphContext(params.contentId),
  ]);

  const sceneActors = Array.isArray(scene?.actors) ? (scene!.actors as string[]) : [];
  const queryParts = [
    scene?.summary,
    scene?.mood,
    ...sceneActors,
    graphCtx?.title,
  ].filter(Boolean);

  let ragSnippets: string[] = [];
  if (queryParts.length > 0) {
    const rag = await retrieveKnowledge({
      query: queryParts.join(" ").slice(0, 500),
      sourceTypes: ["scene", "catalogue"],
      contentId: params.contentId,
      limit: 3,
      minScore: 0.1,
    });
    ragSnippets = rag.chunks.map((c) => c.chunkText.slice(0, 400));
  }

  const trivia: string[] = [];
  if (scene?.summary) trivia.push(scene.summary);
  if (scene?.mood) trivia.push(`Mood: ${scene.mood}`);
  if (graphCtx?.relatedContent.length) {
    trivia.push(`Related titles: ${graphCtx.relatedContent.map((r) => r.title).join(", ")}`);
  }

  const payload: PlaybackCompanionPayload = {
    contentId: params.contentId,
    positionSeconds: params.positionSeconds,
    scene: scene
      ? {
          id: scene.id,
          summary: scene.summary,
          mood: scene.mood,
          actors: sceneActors,
          startSeconds: scene.startSeconds,
          endSeconds: scene.endSeconds,
        }
      : null,
    graph: graphCtx
      ? {
          actors: graphCtx.actors,
          genres: graphCtx.genres,
          themes: graphCtx.themes,
          festivals: graphCtx.festivals,
          cast: graphCtx.cast.map((c) => c.name),
          relatedTitles: graphCtx.relatedContent.map((r) => r.title),
        }
      : null,
    ragSnippets,
    trivia,
  };

  logAiRequest({
    userId: params.userId,
    route: "playback/companion",
    agentId: "agent.playback-companion",
    latencyMs: Date.now() - started,
    ragHitCount: ragSnippets.length,
    graphEdgeCount: graphCtx?.edges.length ?? 0,
    metadata: { contentId: params.contentId, positionSeconds: params.positionSeconds },
  });

  return payload;
}

export function formatCompanionForPrompt(payload: PlaybackCompanionPayload): string {
  const parts = [`Playback position: ${Math.floor(payload.positionSeconds)}s`];
  if (payload.scene) {
    parts.push(
      `Current scene: ${payload.scene.summary ?? "—"}`,
      payload.scene.actors.length ? `On screen: ${payload.scene.actors.join(", ")}` : "",
      payload.scene.mood ? `Mood: ${payload.scene.mood}` : "",
    );
  }
  if (payload.graph) {
    parts.push(
      payload.graph.genres.length ? `Genres: ${payload.graph.genres.join(", ")}` : "",
      payload.graph.themes.length ? `Themes: ${payload.graph.themes.join(", ")}` : "",
    );
  }
  return parts.filter(Boolean).join("\n");
}

export { formatGraphContextForPrompt };
