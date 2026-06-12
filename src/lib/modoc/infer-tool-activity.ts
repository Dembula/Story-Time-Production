import type { ModocActionType } from "./action-types";
import { toolForVaAction } from "./tool-workflow";

export type ModocToolActivityDetail = {
  source: "creator_save" | "va_action";
  tool: string;
  projectId?: string;
  operation: "create" | "update" | "delete" | "bulk" | "action";
  summary: string;
  /** Human-readable fields the creator just added/changed. */
  details?: Record<string, string | number | boolean | null>;
  vaAction?: ModocActionType;
  pathname?: string;
  at: string;
};

const API_SEGMENT_TO_TOOL: Record<string, string> = {
  ideas: "idea-development",
  script: "script-writing",
  "script-review": "script-review",
  breakdown: "script-breakdown",
  budget: "budget-builder",
  schedule: "production-scheduling",
  casting: "casting-portal",
  crew: "crew-marketplace",
  locations: "location-marketplace",
  "equipment-plan": "equipment-planning",
  equipment: "equipment-planning",
  contracts: "legal-contracts",
  funding: "funding-hub",
  "table-reads": "table-reads",
  tasks: "production-workspace",
  risk: "risk-insurance",
  "visual-assets": "visual-planning",
  expenses: "expense-tracker",
  incidents: "incident-reporting",
  continuity: "continuity-manager",
  dailies: "dailies-review",
  "shoot-progress": "shoot-progress",
  reviews: "editing-studio",
  footage: "footage-ingestion",
  music: "music-scoring",
  distribution: "distribution",
  scenes: "script-breakdown",
  "call-sheets": "call-sheet-generator",
};

function nestedString(obj: Record<string, unknown>, key: string, nestedKey: string): string | undefined {
  const nested = obj[key];
  if (nested && typeof nested === "object" && nestedKey in (nested as Record<string, unknown>)) {
    const v = (nested as Record<string, unknown>)[nestedKey];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> | null {
  if (!body) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function countBreakdownItems(body: Record<string, unknown>): number {
  const keys = [
    "characters",
    "props",
    "locations",
    "wardrobe",
    "extras",
    "vehicles",
    "stunts",
    "sfx",
    "makeups",
  ];
  let n = 0;
  for (const k of keys) {
    const arr = body[k];
    if (Array.isArray(arr)) n += arr.length;
  }
  return n;
}

function summarizeMutation(
  tool: string,
  method: string,
  body: Record<string, unknown> | null,
  response: Record<string, unknown>,
): { operation: ModocToolActivityDetail["operation"]; summary: string; details: Record<string, string | number | boolean | null> } {
  const op = method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";

  if (tool === "idea-development") {
    const title = String(
      body?.title ?? nestedString(response, "idea", "title") ?? response.title ?? "idea",
    ).slice(0, 80);
    return {
      operation: op,
      summary: `${op === "create" ? "Created" : "Updated"} idea "${title}"`,
      details: {
        title,
        ...(body?.logline ? { logline: String(body.logline).slice(0, 120) } : {}),
      },
    };
  }

  if (tool === "script-writing") {
    const title = String(
      body?.title ?? nestedString(response, "script", "title") ?? "screenplay",
    ).slice(0, 80);
    const scriptContent = nestedString(response, "script", "content");
    const contentLen =
      typeof body?.content === "string"
        ? body.content.length
        : scriptContent
          ? scriptContent.length
          : null;
    return {
      operation: op,
      summary: `Saved screenplay "${title}"`,
      details: {
        title,
        ...(contentLen != null ? { contentLength: contentLen } : {}),
      },
    };
  }

  if (tool === "script-breakdown") {
    const bulk = body ? countBreakdownItems(body) : 0;
    if (bulk > 0) {
      return {
        operation: "bulk",
        summary: `Added ${bulk} breakdown item${bulk === 1 ? "" : "s"}`,
        details: { itemsAdded: bulk },
      };
    }
    const sceneCount = Array.isArray(response.scenes) ? response.scenes.length : null;
    if (sceneCount != null) {
      return {
        operation: "update",
        summary: `Synced ${sceneCount} scene${sceneCount === 1 ? "" : "s"} from script`,
        details: { scenes: sceneCount },
      };
    }
    return { operation: op, summary: "Updated script breakdown", details: {} };
  }

  if (tool === "budget-builder") {
    const lines = Array.isArray(body?.lines) ? body.lines.length : null;
    return {
      operation: op,
      summary: lines ? `Updated budget (${lines} line${lines === 1 ? "" : "s"})` : "Updated project budget",
      details: lines != null ? { lines } : {},
    };
  }

  if (tool === "production-scheduling") {
    const title = String(body?.title ?? body?.date ?? "shoot day").slice(0, 60);
    return {
      operation: op,
      summary: `${op === "create" ? "Added" : "Updated"} schedule: ${title}`,
      details: { label: title },
    };
  }

  if (tool === "casting-portal") {
    const role = String(body?.role ?? body?.name ?? "casting role").slice(0, 80);
    return {
      operation: op,
      summary: `${op === "create" ? "Added" : "Updated"} casting role "${role}"`,
      details: { role },
    };
  }

  if (tool === "crew-marketplace") {
    const role = String(body?.role ?? body?.title ?? "crew need").slice(0, 80);
    return {
      operation: op,
      summary: `${op === "create" ? "Added" : "Updated"} crew need "${role}"`,
      details: { role },
    };
  }

  if (tool === "legal-contracts") {
    const subject = String(
      body?.subject ?? nestedString(response, "contract", "subject") ?? "contract",
    ).slice(0, 80);
    return {
      operation: op,
      summary: `${op === "create" ? "Created" : "Updated"} contract "${subject}"`,
      details: { subject },
    };
  }

  if (tool === "production-workspace" || tool === "on-set-tasks") {
    const title = String(body?.title ?? "task").slice(0, 80);
    return {
      operation: op,
      summary: `${op === "create" ? "Created" : "Updated"} task "${title}"`,
      details: { title },
    };
  }

  if (tool === "editing-studio") {
    if (body?.body) {
      return {
        operation: "create",
        summary: "Added editing review note",
        details: { notePreview: String(body.body).slice(0, 100) },
      };
    }
    return {
      operation: op,
      summary: `${op === "create" ? "Started" : "Updated"} post-production review`,
      details: {},
    };
  }

  if (tool === "expense-tracker") {
    const desc = String(body?.description ?? "expense").slice(0, 80);
    const amount = body?.amount != null ? Number(body.amount) : null;
    return {
      operation: op,
      summary: `Logged expense "${desc}"`,
      details: {
        description: desc,
        ...(amount != null && Number.isFinite(amount) ? { amount } : {}),
      },
    };
  }

  const genericTitle = String(
    body?.title ?? body?.name ?? body?.description ?? body?.label ?? "",
  ).slice(0, 80);
  if (genericTitle) {
    return {
      operation: op,
      summary: `Saved changes in ${tool.replace(/-/g, " ")}: ${genericTitle}`,
      details: { label: genericTitle },
    };
  }

  return {
    operation: op,
    summary: `Saved changes in ${tool.replace(/-/g, " ")}`,
    details: {},
  };
}

function parseProjectApiUrl(url: string): { projectId?: string; segment?: string } {
  const m = url.match(/\/api\/creator\/projects\/([^/?]+)\/([^/?]+)/);
  if (!m) return {};
  return { projectId: m[1], segment: m[2] };
}

/** Infer a tool activity snapshot from a successful creator API mutation. */
export function inferToolActivityFromMutation(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  response: Record<string, unknown>,
): ModocToolActivityDetail | null {
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) return null;

  const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  if (!url.includes("/api/creator/")) return null;

  let tool: string | undefined;
  let projectId: string | undefined;

  const { projectId: pid, segment } = parseProjectApiUrl(url);
  if (pid && segment) {
    projectId = pid;
    tool = API_SEGMENT_TO_TOOL[segment];
    if (segment === "tasks" && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.includes("/production/on-set-tasks")) tool = "on-set-tasks";
    }
  }

  if (!tool && url.includes("/api/creator/scripts")) {
    tool = "script-writing";
    const qs = url.includes("?") ? new URLSearchParams(url.split("?")[1]) : null;
    projectId = qs?.get("projectId") ?? undefined;
  }

  if (!tool) return null;

  const body = parseBody(init?.body ?? null);
  const { operation, summary, details } = summarizeMutation(tool, method, body, response);

  return {
    source: "creator_save",
    tool,
    projectId,
    operation,
    summary,
    details,
    at: new Date().toISOString(),
  };
}

/** Build activity detail when the VA executes an action on behalf of the creator. */
export function inferToolActivityFromVaAction(
  action: ModocActionType,
  projectId: string | undefined,
  resultMessage?: string,
): ModocToolActivityDetail | null {
  const tool = toolForVaAction(action);
  if (!tool) return null;
  return {
    source: "va_action",
    tool,
    projectId,
    operation: "action",
    summary: resultMessage ?? `Completed ${action.replace(/_/g, " ")}`,
    details: { vaAction: action },
    vaAction: action,
    at: new Date().toISOString(),
  };
}
