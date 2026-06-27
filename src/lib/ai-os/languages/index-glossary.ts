import { upsertKnowledgeChunk } from "@/lib/ai-os/rag/index-chunk";
import type { SaLanguageCode } from "@/lib/sa-languages/constants";
import { saLanguageLabel } from "@/lib/sa-languages/constants";
import {
  glossaryChunkKey,
  SA_GLOSSARY_SEED,
  type SaGlossarySeedEntry,
} from "./glossary-seed";

function formatGlossaryChunkText(entry: SaGlossarySeedEntry): string {
  const parts = [
    `Language: ${saLanguageLabel(entry.language)} (${entry.language})`,
    `Term: ${entry.term}`,
    `Meaning: ${entry.meaning}`,
    `Register: ${entry.register}${entry.slang ? " (slang)" : ""}`,
  ];
  if (entry.examples) parts.push(`Example: ${entry.examples}`);
  if (entry.related?.length) parts.push(`Related: ${entry.related.join(", ")}`);
  return parts.join("\n");
}

/** Index platform seed glossary into RAG (idempotent upsert). */
export async function indexSaGlossarySeed(): Promise<{ indexed: number }> {
  let indexed = 0;
  for (const entry of SA_GLOSSARY_SEED) {
    await upsertKnowledgeChunk({
      chunkKey: glossaryChunkKey(entry.language, entry.term),
      sourceType: "sa_language_glossary",
      sourceId: entry.language,
      title: `${entry.term} (${saLanguageLabel(entry.language)})`,
      chunkText: formatGlossaryChunkText(entry),
      metadata: {
        language: entry.language,
        term: entry.term,
        register: entry.register,
        slang: entry.slang,
        origin: "seed",
      },
    });
    indexed++;
  }
  return { indexed };
}

/** Persist a term learned from conversation into the shared glossary. */
export async function indexLearnedSaLanguageTerm(params: {
  language: SaLanguageCode;
  term: string;
  meaning: string;
  register?: string;
  slang?: boolean;
  userId?: string;
  origin?: "conversation" | "admin";
}): Promise<void> {
  const term = params.term.trim();
  const meaning = params.meaning.trim();
  if (!term || !meaning || term.length > 80 || meaning.length > 2000) return;

  const entry: SaGlossarySeedEntry = {
    language: params.language,
    term,
    meaning,
    register: params.register ?? "learned",
    slang: params.slang ?? false,
  };

  await upsertKnowledgeChunk({
    chunkKey: glossaryChunkKey(params.language, term),
    sourceType: "sa_language_glossary",
    sourceId: params.language,
    userId: params.userId ?? null,
    title: `${term} (${saLanguageLabel(params.language)})`,
    chunkText: formatGlossaryChunkText(entry),
    metadata: {
      language: params.language,
      term,
      register: entry.register,
      slang: entry.slang,
      origin: params.origin ?? "conversation",
      learnedAt: new Date().toISOString(),
    },
  });
}
