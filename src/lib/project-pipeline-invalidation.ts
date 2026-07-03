import type { QueryClient } from "@tanstack/react-query";

/**
 * Production pipeline stages and the React Query keys of every downstream
 * consumer. Mutating a stage must refresh everything that reads from it,
 * otherwise tools show stale data until a manual page reload.
 */
export type PipelineStage =
  | "script"
  | "scenes"
  | "breakdown"
  | "casting"
  | "crew"
  | "locations"
  | "budget"
  | "schedule"
  | "scheduleDownstream"
  | "callSheets"
  | "shootProgress"
  | "contracts";

const STAGE_KEYS: Record<PipelineStage, string[]> = {
  script: ["project-script", "creator-scripts", "project-scenes"],
  scenes: ["project-scenes", "project-breakdown", "project-schedule", "project-budget"],
  breakdown: [
    "project-breakdown",
    "project-breakdown-intelligence",
    "project-scenes",
    "project-casting",
    "project-schedule",
    "project-budget",
  ],
  casting: ["project-casting", "project-schedule", "project-budget", "project-call-sheets"],
  crew: ["project-crew", "project-schedule", "project-budget", "project-call-sheets"],
  locations: ["project-breakdown", "project-schedule", "project-call-sheets", "project-budget"],
  budget: ["project-budget"],
  schedule: [
    "project-schedule",
    "project-shoot-progress",
    "project-call-sheets",
    "call-sheet-preview",
    "project-budget",
    "production-control-center",
    "command-center-calendar",
  ],
  /**
   * Downstream consumers only — for mutations that already applied the fresh
   * schedule payload via setQueryData (re-invalidating project-schedule would
   * race the optimistic apply with a refetch).
   */
  scheduleDownstream: [
    "project-shoot-progress",
    "project-call-sheets",
    "call-sheet-preview",
    "project-budget",
    "production-control-center",
    "command-center-calendar",
  ],
  callSheets: ["project-call-sheets", "call-sheet-preview"],
  shootProgress: ["project-shoot-progress", "production-control-center", "project-dailies"],
  contracts: ["project-contracts", "project-call-sheets"],
};

/** Invalidate every query affected by the given pipeline stages for one project. */
export function invalidateProjectPipeline(
  queryClient: QueryClient,
  projectId: string | undefined,
  stages: PipelineStage[],
): void {
  if (!projectId) return;
  const keys = new Set<string>();
  for (const stage of stages) {
    for (const key of STAGE_KEYS[stage]) keys.add(key);
  }
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: [key, projectId] });
  }
}
