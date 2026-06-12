/**
 * OpenRouter model ID normalization.
 * Env vars must use slugs from https://openrouter.ai/models (e.g. google/gemini-2.5-flash).
 */

/** Deprecated or mistyped IDs → current OpenRouter slugs */
const MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-preview": "google/gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  "claude-3.5-sonnet": "anthropic/claude-3.5-sonnet",
};

/** Built-in fallbacks — verified OpenRouter slugs only */
export const OPENROUTER_DEFAULT_MODELS = {
  creative: [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
  ],
  extraction: [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
  ],
  logic: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "openai/gpt-4o-mini"],
  chat: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-3.5-sonnet"],
  default: ["openai/gpt-4o-mini"],
} as const;

export function normalizeOpenRouterModelId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  if (MODEL_ALIASES[trimmed]) return MODEL_ALIASES[trimmed];
  if (trimmed.includes("/")) return trimmed;
  if (trimmed.startsWith("gpt-")) return `openai/${trimmed}`;
  if (trimmed.startsWith("claude-")) return `anthropic/${trimmed}`;
  if (trimmed.startsWith("gemini-")) return `google/${trimmed}`;
  return trimmed;
}

export function resolveModelChain(
  envModels: Array<string | undefined>,
  fallbacks: readonly string[],
): string[] {
  const chain = [...envModels, ...fallbacks]
    .filter((m): m is string => Boolean(m?.trim()))
    .map(normalizeOpenRouterModelId);
  return [...new Set(chain)];
}
