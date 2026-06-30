/** User-facing MODOC chat error text (hides raw OpenRouter provider errors). */
export function formatModocChatError(message: string | undefined): string {
  const m = (message ?? "").trim();
  if (!m) return "Something went wrong. Try again.";

  if (m.includes("503") || m.toLowerCase().includes("configured")) {
    return "AI assistant is not configured. Set OPENROUTER_API_KEY in your environment.";
  }
  if (
    m.toLowerCase().includes("no endpoints found") ||
    m.toLowerCase().includes("model not found") ||
    m.toLowerCase().includes("all modoc models failed")
  ) {
    return "The AI model was temporarily unavailable. Please send your message again — a fallback model will be used.";
  }
  if (m.toLowerCase().includes("rate limit") || m.toLowerCase().includes("429")) {
    return "AI is busy right now. Please wait a moment and try again.";
  }

  return m;
}
