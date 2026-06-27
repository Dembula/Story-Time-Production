import type { StoryTimeMemoryLayers } from "./types";

/** Format five memory layers into a MODOC system-prompt block. Pure — no I/O. */
export function formatStoryTimeMemoryPrompt(
  layers: StoryTimeMemoryLayers,
  missingContextFlags: string[],
  projectGraphPrompt?: string,
): string {
  const parts: string[] = [
    "## Story Time AI memory (structured — not raw chat history)",
    "",
    "Reason from these layers in order: conversation → user → project → studio → global.",
    "",
    "### 1. Conversation memory (current thread + session)",
    "```json",
    JSON.stringify(
      {
        conversationId: layers.conversation.conversationId,
        sessionTool: layers.conversation.sessionTool,
        sessionTask: layers.conversation.sessionTask,
        recentUserIntents: layers.conversation.recentUserIntents,
        recentTurns: layers.conversation.recentTurns.slice(-8),
        at: layers.conversation.at,
      },
      null,
      2,
    ),
    "```",
    "",
    "### 2. User memory (behavioral + learned preferences)",
    "```json",
    JSON.stringify(layers.user, null, 2),
    "```",
    "",
  ];

  if (projectGraphPrompt) {
    parts.push(projectGraphPrompt, "");
  } else if (layers.project.graph) {
    parts.push(
      "### 3. Project memory",
      "Project graph loaded — see production graph section injected by orchestrator.",
      "",
    );
  } else {
    parts.push(
      "### 3. Project memory",
      layers.project.projectId
        ? "Project graph unavailable for this request."
        : "No focus project. Request projectId from page context before executing project actions.",
      "",
    );
  }

  parts.push(
    "### 4. Studio memory (creator portfolio)",
    "```json",
    JSON.stringify(layers.studio, null, 2),
    "```",
    "",
    "### 5. Global memory (platform workflows + policies)",
    "```json",
    JSON.stringify(layers.global, null, 2),
    "```",
  );

  if (missingContextFlags.length > 0) {
    parts.push(
      "",
      "### Missing context flags",
      missingContextFlags.map((f) => `- ${f}`).join("\n"),
    );
  }

  return parts.join("\n");
}
