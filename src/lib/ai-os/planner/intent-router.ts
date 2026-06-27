import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";
import { resolveModocTaskKind, type ModocTaskKind } from "@/lib/modoc/task-kind";
import { VIEWER_VA_ROLE } from "@/lib/modoc/viewer-va";
import { resolveSpecialistFromTask } from "../agents/specialists";
import type { AiAgentId, OrchestrationPlan } from "../types";

export type IntentRouterInput = {
  sessionRole: string;
  scope?: string;
  path: string;
  pageContext?: Record<string, string | number | boolean | null>;
  lastUserText?: string;
};

const TASK_TO_FUTURE_AGENT: Partial<Record<string, AiAgentId>> = {
  script: "agent.script",
  script_review: "agent.script",
  script_breakdown: "agent.script",
  budget: "agent.finance",
  schedule: "agent.production",
  production_scheduling: "agent.production",
  call_sheet_generator: "agent.production",
  on_set_tasks: "agent.production",
  shoot_progress: "agent.production",
  continuity_manager: "agent.production",
  dailies_review: "agent.production",
  production_expense_tracker: "agent.finance",
  funding_hub: "agent.finance",
  visual_planning: "agent.marketing",
  distribution: "agent.marketing",
  production_wrap: "agent.marketing",
  legal_contracts: "agent.legal",
  risk_insurance: "agent.legal",
  creator_analytics: "agent.analytics",
};

/**
 * Plans which agent(s) should handle a MODOC chat request.
 * Milestone 1: routes to modoc.legacy (same behavior as V1) while recording future agent intent.
 */
export function planModocOrchestration(input: IntentRouterInput): OrchestrationPlan {
  const task = (input.pageContext?.task as string | undefined) ?? undefined;
  const tool = (input.pageContext?.tool as string | undefined) ?? undefined;
  const taskKind: ModocTaskKind = resolveModocTaskKind({
    task,
    tool,
    lastUserText: input.lastUserText,
  });

  const isCreator =
    input.sessionRole === CREATOR_VA_ROLE ||
    input.scope === "creator";
  const isViewer =
    input.sessionRole === VIEWER_VA_ROLE ||
    input.scope === "browse" ||
    input.path.startsWith("/browse");

  let primaryAgentId: AiAgentId = "modoc.legacy";
  let routingReason = "Default legacy MODOC composite (V1 behavior preserved)";

  const specialist = resolveSpecialistFromTask(task, input.scope);
  if (specialist) {
    primaryAgentId = specialist;
    routingReason = `Specialist agent ${specialist} for task=${task ?? "browse"}`;
    if (isCreator && primaryAgentId === "agent.discovery") {
      primaryAgentId = "modoc.creator";
    }
  } else if (isCreator && !isViewer) {
    primaryAgentId = "modoc.creator";
    routingReason = "Creator scope — routed through modoc.creator (executes legacy pipeline until agents split)";
  } else if (isViewer) {
    primaryAgentId = specialist ?? "modoc.viewer";
    routingReason = specialist
      ? `Specialist ${specialist} for viewer scope`
      : "Viewer/browse scope — routed through modoc.viewer";
  }

  const futureAgent = task ? TASK_TO_FUTURE_AGENT[task] : undefined;
  const supportingAgentIds: AiAgentId[] =
    futureAgent && futureAgent !== primaryAgentId ? [futureAgent] : [];

  if (futureAgent && !specialist) {
    routingReason += `; future specialist hint: ${futureAgent}`;
  }

  return {
    primaryAgentId,
    supportingAgentIds,
    taskKind,
    routingReason,
  };
}
