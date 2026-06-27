import { TOOL_WORKFLOW } from "@/lib/modoc/tool-workflow";
import type { GlobalMemory } from "../types";

const PLATFORM_POLICIES = [
  "Structured production state (graph, DB records) overrides chat assumptions.",
  "Prefer MODOC_ACTION or MODOC_SUGGEST over vague advice when a tool action exists.",
  "Never invent projectId, taskId, contractId, or eventId — use verified graph/DB ids only.",
  "Destructive or uncertain operations require MODOC_SUGGEST, not MODOC_ACTION.",
  "Viewer (SUBSCRIBER) scope: catalogue discovery only — no creator-only actions.",
  "Playback and streaming performance always outrank AI features; AI must never block video.",
  "South African multilingual: mirror user language(s), understand slang and code-switching across all 11 official languages.",
] as const;

/** Platform-wide memory — static policies + workflow patterns. No I/O. */
export function loadGlobalMemory(): GlobalMemory {
  const workflowPatterns = Object.values(TOOL_WORKFLOW)
    .slice(0, 20)
    .map((w) => ({
      tool: w.tool,
      nextTool: w.nextTool,
      escalateAction: w.escalateAction,
    }));

  return {
    workflowPatterns,
    platformPolicies: [...PLATFORM_POLICIES],
  };
}
