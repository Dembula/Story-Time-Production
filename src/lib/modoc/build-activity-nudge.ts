import type { ModocToolActivityDetail } from "./infer-tool-activity";
import { projectToolPath, workflowForTool, type ToolWorkflowStep } from "./tool-workflow";

export type ModocActivityNudge = {
  activity: ModocToolActivityDetail;
  toolLabel: string;
  workflow: ToolWorkflowStep;
  /** True when save looks partial / worth offering help. */
  likelyIncomplete: boolean;
  incompleteReason?: string;
  /** Proactive assistant message shown when creator opens VA after the pulse. */
  greeting: string;
  /** Injected into chat API pageContext for full awareness. */
  contextBlock: string;
  nextToolHref?: string;
};

function assessCompleteness(
  activity: ModocToolActivityDetail,
  workflow: ToolWorkflowStep,
): { likelyIncomplete: boolean; reason?: string } {
  const d = activity.details ?? {};

  if (activity.tool === "idea-development") {
    const title = String(d.title ?? "");
    if (!title.trim() || title === "idea") {
      return { likelyIncomplete: true, reason: "the idea may still need a title or logline" };
    }
    if (!d.logline) {
      return { likelyIncomplete: true, reason: "a logline would strengthen the concept" };
    }
  }

  if (activity.tool === "script-writing") {
    const len = Number(d.contentLength ?? 0);
    if (len > 0 && len < 400) {
      return { likelyIncomplete: true, reason: "the screenplay looks like a short draft" };
    }
  }

  if (activity.tool === "script-breakdown") {
    const items = Number(d.itemsAdded ?? 0);
    if (items > 0 && items < 3) {
      return { likelyIncomplete: true, reason: "only a few breakdown elements were added" };
    }
    if (activity.operation === "update" && !items) {
      return { likelyIncomplete: true, reason: "the breakdown may still need characters, props, or locations" };
    }
  }

  if (activity.tool === "budget-builder") {
    const lines = Number(d.lines ?? 0);
    if (lines === 0 && activity.operation !== "delete") {
      return { likelyIncomplete: true, reason: "the budget may still need line items" };
    }
  }

  if (activity.tool === "legal-contracts" && activity.operation === "create") {
    return { likelyIncomplete: true, reason: "new contracts usually need review before sending" };
  }

  if (activity.tool === "production-workspace" || activity.tool === "on-set-tasks") {
    const title = String(d.title ?? "");
    if (title && !d.dueDate) {
      return { likelyIncomplete: true, reason: "tasks without due dates won't appear on the calendar" };
    }
  }

  if (activity.source === "va_action" && workflow.escalateAction) {
    return { likelyIncomplete: false };
  }

  if (workflow.nextTool && activity.operation === "create") {
    return { likelyIncomplete: true, reason: `you may want to continue in ${workflow.nextLabel ?? "the next tool"}` };
  }

  return { likelyIncomplete: false };
}

export function buildActivityNudge(activity: ModocToolActivityDetail): ModocActivityNudge | null {
  const workflow = workflowForTool(activity.tool);
  if (!workflow) return null;

  const { likelyIncomplete, reason } = assessCompleteness(activity, workflow);

  const nextToolHref =
    activity.projectId && workflow.nextTool
      ? projectToolPath(activity.projectId, workflow.phase, workflow.nextTool)
      : undefined;

  const assistList = workflow.assistActions.slice(0, 3).map((a) => a.replace(/_/g, " ")).join(", ");

  let greeting: string;
  if (likelyIncomplete && reason) {
    greeting = `I noticed you just ${activity.summary.toLowerCase()} in ${workflow.label}. It looks like ${reason} — want help finishing this step? I can ${assistList || "assist directly"}.`;
  } else if (workflow.nextLabel && workflow.escalatePrompt) {
    greeting = `Nice — you ${activity.summary.toLowerCase()} in ${workflow.label}. Ready to ${workflow.escalatePrompt}? I can also help with ${assistList || "next steps"} here.`;
  } else {
    greeting = `I saw you ${activity.summary.toLowerCase()} in ${workflow.label}. Need help refining it, or should we move on?`;
  }

  const detailLines = Object.entries(activity.details ?? {})
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 200)}`)
    .join("\n");

  const contextBlock = `## Recent creator tool activity (proactive awareness)
The creator just worked in **${workflow.label}** (${activity.tool})${activity.projectId ? ` on project ${activity.projectId}` : ""}.
- What happened: ${activity.summary}
- Operation: ${activity.operation}
- Source: ${activity.source === "va_action" ? "VA executed an action" : "creator saved in the tool UI"}
${detailLines ? `- Details:\n${detailLines}` : ""}
- Task likely incomplete: ${likelyIncomplete ? "yes" : "no"}${reason ? ` (${reason})` : ""}
${workflow.nextLabel ? `- Suggested next tool: ${workflow.nextLabel} (${workflow.nextTool})` : ""}
${workflow.escalateAction ? `- Suggested escalate action: ${workflow.escalateAction}` : ""}
${assistList ? `- Actions you can run here: ${workflow.assistActions.join(", ")}` : ""}

**Your job when the creator opens the VA after this nudge:**
1. Acknowledge what they just did specifically (use the summary above).
2. If likely incomplete, offer concrete help to finish ${workflow.label} (run an assist action if they agree).
3. If they seem done, offer to escalate to ${workflow.nextLabel ?? "the next pipeline step"}.
4. Never claim you don't have access — you can run the actions listed above.
5. If they ignore this and ask something else, follow their lead.`;

  return {
    activity,
    toolLabel: workflow.label,
    workflow,
    likelyIncomplete,
    incompleteReason: reason,
    greeting,
    contextBlock,
    nextToolHref,
  };
}
