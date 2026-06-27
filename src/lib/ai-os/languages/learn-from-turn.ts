import type { SaLanguageCode } from "@/lib/sa-languages/constants";
import { detectSaLanguages, isSaMultilingualEnabled } from "./detect";
import { indexLearnedSaLanguageTerm } from "./index-glossary";

const DEFINITION_PATTERNS = [
  /["'""]([^"'""]{2,40})["'""]\s*(?:means|is|refers to|translate[sd]? to)\s+([^.!?\n]{5,200})/gi,
  /\b(?:word|term|phrase)\s+["'""]?([^"'""\s,]{2,40})["'""]?\s*(?:means|is)\s+([^.!?\n]{5,200})/gi,
];

/** Extract glossary candidates from an assistant explanation turn. */
export function extractLearnedTermsFromAssistant(
  assistantMessage: string,
  primaryLanguage: SaLanguageCode | null,
): Array<{ term: string; meaning: string; language: SaLanguageCode }> {
  if (!primaryLanguage || !assistantMessage.trim()) return [];

  const results: Array<{ term: string; meaning: string; language: SaLanguageCode }> = [];
  for (const pattern of DEFINITION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(assistantMessage)) !== null) {
      const term = match[1]?.trim();
      const meaning = match[2]?.trim();
      if (term && meaning && !/^(the|a|an|it|this)$/i.test(term)) {
        const key = term.toLowerCase();
        if (!results.some((r) => r.term.toLowerCase() === key)) {
          results.push({ term, meaning, language: primaryLanguage });
        }
      }
    }
  }
  return results.slice(0, 5);
}

/** After a chat turn, index new language knowledge for future RAG retrieval. */
export async function learnSaLanguageFromTurn(params: {
  userId: string;
  userMessage: string;
  assistantMessage?: string;
}): Promise<void> {
  if (!isSaMultilingualEnabled()) return;

  const detection = detectSaLanguages(params.userMessage);
  const lang = detection.primary;
  if (!lang || lang === "en") {
    if (!params.assistantMessage) return;
  }

  const primary = lang && lang !== "en" ? lang : detectSaLanguages(params.assistantMessage ?? "").primary;
  if (!primary) return;

  const learned = extractLearnedTermsFromAssistant(params.assistantMessage ?? "", primary);
  for (const row of learned) {
    await indexLearnedSaLanguageTerm({
      language: row.language,
      term: row.term,
      meaning: row.meaning,
      userId: params.userId,
      origin: "conversation",
      slang: /slang|informal|tsotsi|township/i.test(row.meaning),
    }).catch(() => {});
  }

  for (const term of detection.lookupTerms.slice(0, 3)) {
    if (learned.some((l) => l.term.toLowerCase() === term.toLowerCase())) continue;
    if (term.length < 3) continue;
    // Unknown terms stay in detection context; next turn may retrieve after user clarifies.
  }
}
