import type { ModocActionType } from "./action-types";
import { buildActivityNudge, type ModocActivityNudge } from "./build-activity-nudge";
import { inferToolActivityFromVaAction, type ModocToolActivityDetail } from "./infer-tool-activity";

export const MODOC_TOOL_ACTIVITY_EVENT = "modoc:tool-activity";
export const MODOC_ATTENTION_PULSE_EVENT = "modoc:attention-pulse";

/** Dispatch after a creator saves in a tool (via projectToolFetch) or VA completes an action. */
export function notifyModocToolActivity(detail: ModocToolActivityDetail): ModocActivityNudge | null {
  if (typeof window === "undefined") return null;
  // Creator saves trigger attention pulses; VA-executed actions do not re-nudge the FAB.
  if (detail.source === "va_action") return null;
  const nudge = buildActivityNudge(detail);
  if (!nudge) return null;
  window.dispatchEvent(
    new CustomEvent(MODOC_TOOL_ACTIVITY_EVENT, {
      detail: nudge,
    }),
  );
  return nudge;
}

/** Notify proactive awareness after a VA action mutates creator data. */
export function notifyModocVaActionActivity(
  action: ModocActionType,
  projectId: string | undefined,
  resultMessage?: string,
): void {
  const detail = inferToolActivityFromVaAction(action, projectId, resultMessage);
  if (detail) notifyModocToolActivity(detail);
}
