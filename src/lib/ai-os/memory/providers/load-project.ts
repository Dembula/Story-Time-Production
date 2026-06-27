import type { ProductionGraph } from "@/lib/modoc/production-graph";
import type { ProjectMemory } from "../types";

export function loadProjectMemory(params: {
  projectId?: string | null;
  graph?: ProductionGraph | null;
}): ProjectMemory {
  return {
    projectId: params.projectId ?? undefined,
    graph: params.graph ?? null,
  };
}
