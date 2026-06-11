import type { ModocActionType } from "./action-types";

export type ModocQuickPromptAction = {
  type: ModocActionType;
  payload: Record<string, string | undefined>;
};

/** Map creator quick prompts to concrete VA actions when a project is in context. */
export function resolveQuickPromptAction(
  prompt: string,
  projectId?: string | null,
): ModocQuickPromptAction | null {
  if (!projectId) return null;

  if (prompt === "Break down my latest script") {
    return { type: "breakdown_full", payload: { projectId } };
  }

  if (prompt === "What should I do next on this project?") {
    return null;
  }

  return null;
}
