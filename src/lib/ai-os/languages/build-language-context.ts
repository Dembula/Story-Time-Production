import "server-only";

import { retrieveKnowledge } from "@/lib/ai-os/rag/retrieve";
import { formatRagPromptBlock } from "@/lib/ai-os/rag/format-prompt";
import type { SaLanguageCode } from "@/lib/sa-languages/constants";
import { saLanguageLabel } from "@/lib/sa-languages/constants";
import { detectSaLanguages, isSaMultilingualEnabled } from "./detect";
import { MODOC_SA_MULTILINGUAL_POLICY } from "./system-prompt";

export type BuildSaLanguagePromptBlockParams = {
  query: string;
  userId?: string | null;
  /** Preferred language from profile/vault if known */
  preferredLanguage?: SaLanguageCode | null;
};

/** Retrieve SA language glossary + detection context for MODOC system prompt. */
export async function buildSaLanguagePromptBlock(
  params: BuildSaLanguagePromptBlockParams,
): Promise<string> {
  if (!isSaMultilingualEnabled()) return "";

  const query = params.query.trim();
  if (query.length < 2) {
    return params.preferredLanguage
      ? `\n\n${MODOC_SA_MULTILINGUAL_POLICY}\n\n## User language preference\nPreferred: ${saLanguageLabel(params.preferredLanguage)}`
      : `\n\n${MODOC_SA_MULTILINGUAL_POLICY}`;
  }

  const detection = detectSaLanguages(query);
  const searchQuery = [
    query,
    ...detection.lookupTerms,
    ...detection.ranked.slice(0, 2).map((r) => r.label),
  ]
    .join(" ")
    .slice(0, 600);

  let glossaryBlock = "";
  if (params.userId && searchQuery.length >= 2) {
    const result = await retrieveKnowledge({
      query: searchQuery,
      sourceTypes: ["sa_language_glossary"],
      limit: 6,
      minScore: 0.08,
      userId: params.userId,
    });
    glossaryBlock = formatRagPromptBlock(result);
  }

  const detectedLine =
    detection.ranked.length > 0
      ? detection.ranked.map((r) => `${r.label} (score ${r.score})`).join(", ")
      : params.preferredLanguage
        ? saLanguageLabel(params.preferredLanguage)
        : "English (default)";

  const parts = [
    MODOC_SA_MULTILINGUAL_POLICY,
    `\n## Detected language context\nPrimary: ${detectedLine}`,
    detection.codeSwitching
      ? "Code-switching detected — mirror the user's mix naturally (e.g. English + isiZulu)."
      : null,
    detection.lookupTerms.length
      ? `Terms to interpret: ${detection.lookupTerms.join(", ")}`
      : null,
    glossaryBlock ? `\n${glossaryBlock}` : null,
    !glossaryBlock && detection.lookupTerms.length
      ? "\n(No glossary hit yet — infer carefully, note uncertainty, and teach the user; learning will index new terms after this turn.)"
      : null,
  ].filter(Boolean);

  return `\n\n${parts.join("\n")}`;
}
