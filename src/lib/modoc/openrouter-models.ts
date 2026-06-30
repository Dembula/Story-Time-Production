/**
 * OpenRouter model ID normalization.
 * Env vars must use slugs from https://openrouter.ai/models (e.g. google/gemini-2.5-flash).
 */

/** Retired or mistyped IDs → current OpenRouter slugs (June 2026). */
const MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-preview": "google/gemini-2.5-flash",
  "gemini-2.5-flash-preview-05-20": "google/gemini-2.5-flash",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt-4o": "openai/gpt-4o",
  "claude-3.5-sonnet": "anthropic/claude-sonnet-4.5",
  "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-4.5",
  "anthropic/claude-3.5-sonnet-20240620": "anthropic/claude-sonnet-4.5",
  "anthropic/claude-sonnet-4": "anthropic/claude-sonnet-4.5",
  "claude-sonnet-4": "anthropic/claude-sonnet-4.5",
  "claude-3.7-sonnet": "anthropic/claude-sonnet-4.5",
  "anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-4.5",
};

/**
 * Built-in fallbacks — widely available OpenRouter slugs.
 * Avoid retired claude-3.5-sonnet; prefer gemini + gpt-4o-mini for reliability.
 */
export const OPENROUTER_DEFAULT_MODELS = {
  creative: [
    "google/gemini-2.5-flash",
    "anthropic/claude-sonnet-4.5",
    "openai/gpt-4o-mini",
  ],
  extraction: [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "google/gemini-2.0-flash-001",
  ],
  logic: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.5"],
  chat: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-sonnet-4.5"],
  default: ["openai/gpt-4o-mini", "google/gemini-2.5-flash"],
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
