import crypto from "crypto";

export const IP_MARKETPLACE_LIMIT_MAX = 200;
export const IP_MARKETPLACE_PRICE_MIN = 100;
export const IP_MARKETPLACE_PRICE_MAX = 10_000_000;

export type MonetizationModel = "SALE_FULL_RIGHTS" | "LICENSE" | "CO_PRODUCE";

export function normalizeText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, maxLen);
}

export function normalizePrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  if (rounded < IP_MARKETPLACE_PRICE_MIN || rounded > IP_MARKETPLACE_PRICE_MAX) return null;
  return rounded;
}

export function normalizeCurrency(value: unknown): string {
  if (typeof value !== "string") return "ZAR";
  const v = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(v) ? v : "ZAR";
}

export function normalizeModel(value: unknown): MonetizationModel {
  if (value === "LICENSE") return "LICENSE";
  if (value === "CO_PRODUCE") return "CO_PRODUCE";
  return "SALE_FULL_RIGHTS";
}

export function parseLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(parsed, IP_MARKETPLACE_LIMIT_MAX);
}

export function computeScriptMetrics(content: string) {
  const normalized = content || "";
  const words = normalized
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const wordCount = words.length;
  // Typical rough screenplay/token ratio without external tokenizer dependency.
  const tokenEstimate = Math.ceil(normalized.length / 4);
  const contentHash = crypto.createHash("sha256").update(normalized).digest("hex");
  return { wordCount, tokenEstimate, contentHash };
}

export function validateListingInputs(payload: {
  title?: unknown;
  logline?: unknown;
  synopsis?: unknown;
  genre?: unknown;
  language?: unknown;
  themes?: unknown;
  listingPrice?: unknown;
  listingCurrency?: unknown;
  monetizationModel?: unknown;
}) {
  const title = normalizeText(payload.title, 180);
  const logline = normalizeText(payload.logline, 320);
  const synopsis = normalizeText(payload.synopsis, 4000);
  const genre = normalizeText(payload.genre, 120);
  const language = normalizeText(payload.language, 80);
  const themes = normalizeText(payload.themes, 350);
  const listingPrice = normalizePrice(payload.listingPrice);
  const listingCurrency = normalizeCurrency(payload.listingCurrency);
  const monetizationModel = normalizeModel(payload.monetizationModel);

  if (!listingPrice) return { error: "listingPrice must be between 100 and 10000000" as const };

  return {
    value: {
      title,
      logline,
      synopsis,
      genre,
      language,
      themes,
      listingPrice,
      listingCurrency,
      monetizationModel,
    },
  };
}
