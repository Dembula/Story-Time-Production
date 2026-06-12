import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

export type ModocTaskKind =
  | "creative"
  | "extraction"
  | "logic"
  | "chat"
  | "default";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const MODEL_ENV: Record<ModocTaskKind, string[]> = {
  creative: [
    process.env.OPENROUTER_MODOC_CREATIVE_MODEL,
    process.env.OPENROUTER_MODOC_MODEL,
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
  ].filter(Boolean) as string[],
  extraction: [
    process.env.OPENROUTER_MODOC_EXTRACTION_MODEL,
    process.env.OPENROUTER_MODOC_MODEL,
    "google/gemini-2.5-flash-preview-05-20",
    "openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o",
  ].filter(Boolean) as string[],
  logic: [
    process.env.OPENROUTER_MODOC_LOGIC_MODEL,
    process.env.OPENROUTER_MODOC_MODEL,
    "openai/gpt-4o",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o-mini",
  ].filter(Boolean) as string[],
  chat: [
    process.env.OPENROUTER_MODOC_CHAT_MODEL,
    process.env.OPENROUTER_MODOC_MODEL,
    "google/gemini-2.5-flash-preview-05-20",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-sonnet",
  ].filter(Boolean) as string[],
  default: [
    process.env.OPENROUTER_MODOC_MODEL ?? "openai/gpt-4o-mini",
    "google/gemini-2.5-flash-preview-05-20",
  ],
};

const EXTRACTION_TASKS = new Set([
  "script_breakdown",
  "breakdown",
  "script_review",
  "legal_contracts",
  "production_readiness",
  "creator_analytics",
]);

const CREATIVE_TASKS = new Set([
  "script",
  "idea_notes",
  "logline",
  "visual_planning",
  "funding_hub",
  "table_reads",
]);

const LOGIC_TASKS = new Set([
  "budget",
  "schedule",
  "production_scheduling",
  "risk_insurance",
  "production_expense_tracker",
  "call_sheet_generator",
]);

export function resolveModocTaskKind(params: {
  task?: string;
  tool?: string;
  lastUserText?: string;
}): ModocTaskKind {
  const task = params.task ?? "";
  const tool = params.tool ?? "";

  if (EXTRACTION_TASKS.has(task) || tool.includes("breakdown") || tool.includes("legal")) {
    return "extraction";
  }
  if (CREATIVE_TASKS.has(task) || tool.includes("script") || tool.includes("idea")) {
    return "creative";
  }
  if (LOGIC_TASKS.has(task) || tool.includes("budget") || tool.includes("schedule")) {
    return "logic";
  }

  const t = (params.lastUserText ?? "").toLowerCase();
  if (/\b(breakdown|extract|parse|analyze contract)\b/.test(t)) return "extraction";
  if (/\b(budget|schedule|calculate|assign scenes)\b/.test(t)) return "logic";
  if (/\b(write|dialogue|logline|rewrite|story)\b/.test(t)) return "creative";

  return "chat";
}

export function modelsForTask(kind: ModocTaskKind): string[] {
  const list = MODEL_ENV[kind].length ? MODEL_ENV[kind] : MODEL_ENV.default;
  return [...new Set(list)];
}

/** Primary model id for a task kind (non-streaming calls e.g. breakdown extraction). */
export function primaryModocModel(kind: ModocTaskKind = "extraction"): string {
  return modelsForTask(kind)[0] ?? "openai/gpt-4o-mini";
}

export type StreamModocParams = {
  system: string;
  messages: ModelMessage[];
  taskKind: ModocTaskKind;
  maxOutputTokens?: number;
  temperature?: number;
  onFinish?: (result: { text: string; modelUsed: string }) => void | Promise<void>;
};

/** Stream with OpenRouter model routing + fallback chain. */
export async function streamModocWithFallback(params: StreamModocParams) {
  const models = modelsForTask(params.taskKind);
  const temperatures: Record<ModocTaskKind, number> = {
    creative: 0.85,
    extraction: 0.2,
    logic: 0.15,
    chat: 0.65,
    default: 0.7,
  };

  let lastError: unknown;
  for (const modelId of models) {
    try {
      const result = streamText({
        model: openRouter.chat(modelId),
        system: params.system,
        messages: params.messages,
        maxOutputTokens: params.maxOutputTokens ?? 4096,
        temperature: params.temperature ?? temperatures[params.taskKind],
        onFinish: async ({ text }) => {
          await params.onFinish?.({ text, modelUsed: modelId });
        },
      });
      return { result, modelUsed: modelId };
    } catch (e) {
      lastError = e;
      if (process.env.NODE_ENV === "development") {
        console.warn(`MODOC model ${modelId} failed, trying fallback…`, e);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All MODOC models failed");
}
