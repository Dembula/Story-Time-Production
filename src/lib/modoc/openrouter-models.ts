/**
 * OpenRouter model ID normalization.
 * Env vars must use slugs from https://openrouter.ai/models (e.g. openai/gpt-6-astra).
 */

/** Retired or short aliases → current OpenRouter slugs. */
const MODEL_ALIASES: Record<string, string> = {
  // Astra (GPT-6)
  astra: "openai/gpt-6-astra",
  "astra-6": "openai/gpt-6-astra",
  "gpt-6-astra": "openai/gpt-6-astra",
  "openai/astra": "openai/gpt-6-astra",
  "astra-pro": "openai/gpt-6-astra-pro",
  "gpt-6-astra-pro": "openai/gpt-6-astra-pro",
  // Gemini
  "google/gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-preview": "google/gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  // OpenAI shorthand
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  // Anthropic — map older Sonnet IDs forward; Opus flagship is 5.5
  "claude-3.5-sonnet": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-3.5-sonnet-20240620": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-sonnet-4": "anthropic/claude-sonnet-5.5",
  "claude-sonnet-4": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-sonnet-4.5": "anthropic/claude-sonnet-5.5",
  "claude-sonnet-4.5": "anthropic/claude-sonnet-5.5",
  "claude-3.7-sonnet": "anthropic/claude-sonnet-5.5",
  "anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-5.5",
  "claude-sonnet-5.5": "anthropic/claude-sonnet-5.5",
  "claude-opus-5.5": "anthropic/claude-opus-5.5",
  "claude-opus-5": "anthropic/claude-opus-5.5",
  "anthropic/claude-opus-5": "anthropic/claude-opus-5.5",
  "claude-opus-4.6": "anthropic/claude-opus-5.5",
  "anthropic/claude-opus-4.6": "anthropic/claude-opus-5.5",
};

/**
 * Strong default chains (OpenRouter).
 * Probe + fallback keeps MODOC up if a flagship model is temporarily unavailable.
 *
 * - creative / chat: Astra primary, Opus / Sonnet depth
 * - extraction: Astra + fast multimodal fallbacks
 * - logic / power: Astra Pro + Opus for hard reasoning
 */
export const OPENROUTER_DEFAULT_MODELS = {
  creative: [
    "openai/gpt-6-astra",
    "anthropic/claude-opus-5.5",
    "anthropic/claude-sonnet-5.5",
  ],
  extraction: [
    "openai/gpt-6-astra",
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
  ],
  logic: [
    "openai/gpt-6-astra-pro",
    "anthropic/claude-opus-5.5",
    "openai/gpt-6-astra",
  ],
  chat: [
    "openai/gpt-6-astra",
    "anthropic/claude-sonnet-5.5",
    "google/gemini-2.5-flash",
  ],
  /** Reserved for heavyweight tools (long-horizon planning, deep analysis). */
  power: [
    "openai/gpt-6-astra-pro",
    "anthropic/claude-opus-5.5",
    "openai/gpt-6-astra",
  ],
  default: [
    "openai/gpt-6-astra",
    "anthropic/claude-sonnet-5.5",
    "openai/gpt-4o-mini",
  ],
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

/** Lightweight OpenRouter probe — skips dead model IDs before streaming. */
export async function probeOpenRouterModel(modelId: string): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return false;

  const normalized = normalizeOpenRouterModelId(modelId);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://story-time.online",
        "X-Title": "Story Time MODOC",
      },
      body: JSON.stringify({
        model: normalized,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (process.env.NODE_ENV === "development") {
        console.warn(`OpenRouter probe failed for ${normalized}:`, res.status, body.slice(0, 200));
      }
      return false;
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`OpenRouter probe error for ${normalized}:`, e);
    }
    return false;
  }
}

/** Pick first model in chain that responds on OpenRouter (falls back through chain). */
export async function resolveWorkingModel(chain: string[]): Promise<string | null> {
  const unique = [...new Set(chain.map(normalizeOpenRouterModelId))];
  for (const modelId of unique) {
    if (await probeOpenRouterModel(modelId)) return modelId;
  }
  return unique[0] ?? null;
}
