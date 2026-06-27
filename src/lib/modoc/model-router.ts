import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import {
  normalizeOpenRouterModelId,
  OPENROUTER_DEFAULT_MODELS,
  resolveModelChain,
} from "./openrouter-models";
import { abModelOverride, resolveAbExperimentVariant } from "@/lib/ai-os/evaluation/ab-model";
import { resolveModocTaskKind, type ModocTaskKind } from "./task-kind";

export type { ModocTaskKind } from "./task-kind";
export { resolveModocTaskKind } from "./task-kind";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

function chainFor(kind: ModocTaskKind, userId?: string | null): string[] {
  const env = [
    kind === "creative" ? process.env.OPENROUTER_MODOC_CREATIVE_MODEL : undefined,
    kind === "extraction" ? process.env.OPENROUTER_MODOC_EXTRACTION_MODEL : undefined,
    kind === "logic" ? process.env.OPENROUTER_MODOC_LOGIC_MODEL : undefined,
    kind === "chat" ? process.env.OPENROUTER_MODOC_CHAT_MODEL : undefined,
    process.env.OPENROUTER_MODOC_MODEL,
  ];
  const fallbacks =
    kind === "default"
      ? OPENROUTER_DEFAULT_MODELS.default
      : OPENROUTER_DEFAULT_MODELS[kind];
  const base = resolveModelChain(env, fallbacks);
  const variant = resolveAbExperimentVariant(userId);
  const override = abModelOverride(kind, variant);
  if (override) {
    return [override, ...base.filter((m) => m !== override)];
  }
  return base;
}

export function modelsForTask(kind: ModocTaskKind, userId?: string | null): string[] {
  const list = chainFor(kind, userId);
  return list.length > 0 ? list : chainFor("default", userId);
}

/** Primary model id for a task kind (non-streaming calls e.g. breakdown extraction). */
export function primaryModocModel(kind: ModocTaskKind = "extraction"): string {
  return modelsForTask(kind)[0] ?? "openai/gpt-4o-mini";
}

export type StreamModocParams = {
  system: string;
  messages: ModelMessage[];
  taskKind: ModocTaskKind;
  userId?: string | null;
  maxOutputTokens?: number;
  temperature?: number;
  onFinish?: (result: { text: string; modelUsed: string; experimentVariant: string }) => void | Promise<void>;
};

/** Stream with OpenRouter model routing + fallback chain. */
export async function streamModocWithFallback(params: StreamModocParams) {
  const experimentVariant = resolveAbExperimentVariant(params.userId);
  const models = modelsForTask(params.taskKind, params.userId);
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
          await params.onFinish?.({ text, modelUsed: modelId, experimentVariant });
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

export { normalizeOpenRouterModelId };
