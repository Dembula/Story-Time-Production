import "server-only";

import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";
import { VIEWER_VA_ROLE } from "@/lib/modoc/viewer-va";
import { indexProjectScript } from "./index-project-script";
import { formatRagPromptBlock } from "./format-prompt";
import { retrieveKnowledge } from "./retrieve";
import { buildContentGraphContext, formatGraphContextForPrompt } from "../knowledge-graph/query";
import type { KnowledgeSourceType } from "./types";

export type BuildRagPromptBlockParams = {
  query: string;
  sessionRole: string;
  scope?: string;
  projectId?: string | null;
  contentId?: string | null;
  userId?: string;
  profileAge?: number | null;
  limit?: number;
};

function resolveSourceTypes(sessionRole: string, scope?: string): KnowledgeSourceType[] {
  const isCreator = sessionRole === CREATOR_VA_ROLE || scope === "creator";
  const isViewer =
    sessionRole === VIEWER_VA_ROLE || scope === "browse";

  if (isCreator) {
    return ["platform_policy", "project_script", "catalogue", "sa_language_glossary"];
  }
  if (isViewer) {
    return ["catalogue", "scene", "platform_policy", "sa_language_glossary"];
  }
  return ["platform_policy", "sa_language_glossary"];
}

function isRagEnabled(): boolean {
  return process.env.AI_RAG_ENABLED !== "false";
}

/** Retrieve knowledge and format for MODOC system prompt. Returns empty string when no hits. */
export async function buildRagPromptBlock(params: BuildRagPromptBlockParams): Promise<string> {
  if (!isRagEnabled()) return "";

  const query = params.query.trim();
  if (query.length < 3 || !params.userId) return "";

  const sourceTypes = resolveSourceTypes(params.sessionRole, params.scope);

  if (sourceTypes.includes("project_script") && params.projectId) {
    await indexProjectScript(params.projectId, params.userId).catch(() => {
      /* index-on-demand best effort */
    });
  }

  const result = await retrieveKnowledge({
    query,
    sourceTypes,
    limit: params.limit ?? 8,
    minScore: 0.12,
    projectId: params.projectId,
    contentId: params.contentId,
    userId: params.userId,
    profileAge: params.profileAge,
  });

  let block = formatRagPromptBlock(result);

  if (params.contentId) {
    const graphCtx = await buildContentGraphContext(params.contentId).catch(() => null);
    if (graphCtx) {
      block += `\n\n## Knowledge graph context\n${formatGraphContextForPrompt(graphCtx)}`;
    }
  }

  return block;
}
