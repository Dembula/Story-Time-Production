import "server-only";

import { formatProductionGraphForPrompt } from "@/lib/modoc/production-graph";
import { formatStoryTimeMemoryPrompt } from "./format-prompt";
import { loadConversationMemory } from "./providers/load-conversation";
import { loadGlobalMemory } from "./providers/load-global";
import { loadProjectMemory } from "./providers/load-project";
import { loadStudioMemory } from "./providers/load-studio";
import { loadUserMemory } from "./providers/load-user";
import type { AssembleStoryTimeMemoryParams, AssembledStoryTimeMemory, MemoryScope } from "./types";

/**
 * Unified memory assembly for the Story Time AI OS.
 * Loads five scopes in parallel and returns a structured prompt block for MODOC.
 */
export async function assembleStoryTimeMemory(
  params: AssembleStoryTimeMemoryParams,
): Promise<AssembledStoryTimeMemory> {
  const includeStudio = params.includeStudio !== false;
  const loadedScopes: MemoryScope[] = ["conversation", "user", "project", "global"];
  if (includeStudio) loadedScopes.push("studio");

  const [conversation, user, studio] = await Promise.all([
    loadConversationMemory({
      userId: params.userId,
      conversationId: params.conversationId,
      pageContext: params.pageContext,
      recentUserMessages: params.recentUserMessages,
    }),
    loadUserMemory({
      userId: params.userId,
      projectId: params.projectId,
    }),
    includeStudio
      ? loadStudioMemory({
          userId: params.userId,
          focusProjectId: params.projectId,
        })
      : Promise.resolve({ projectCount: 0, projects: [] }),
  ]);

  const project = loadProjectMemory({
    projectId: params.projectId,
    graph: params.graph ?? null,
  });

  const global = loadGlobalMemory();

  const layers = {
    conversation,
    user,
    project,
    studio,
    global,
  };

  const missingContextFlags = [
    ...(project.graph?.missingContextFlags ?? []),
    ...(user.lastSessionIntel?.missing_context_flags ?? []),
    ...(!params.projectId ? ["no_focus_project"] : []),
  ];

  const projectGraphPrompt = project.graph
    ? formatProductionGraphForPrompt(project.graph)
    : undefined;

  const promptBlock = formatStoryTimeMemoryPrompt(layers, missingContextFlags, projectGraphPrompt);

  return {
    layers,
    promptBlock,
    missingContextFlags,
    loadedScopes,
  };
}
