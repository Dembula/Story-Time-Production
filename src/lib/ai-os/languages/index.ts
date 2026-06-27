export { SA_OFFICIAL_LANGUAGES, SA_LANGUAGE_LABELS, resolveSaLanguageCode, saLanguageLabel } from "@/lib/sa-languages/constants";
export type { SaLanguageCode, SaLanguageDefinition } from "@/lib/sa-languages/constants";

export { detectSaLanguages, isSaMultilingualEnabled } from "./detect";
export type { SaLanguageDetection } from "./detect";

export { SA_GLOSSARY_SEED, glossaryChunkKey } from "./glossary-seed";
export { indexSaGlossarySeed, indexLearnedSaLanguageTerm } from "./index-glossary";
export { learnSaLanguageFromTurn, extractLearnedTermsFromAssistant } from "./learn-from-turn";
export { buildSaLanguagePromptBlock } from "./build-language-context";
export { MODOC_SA_MULTILINGUAL_POLICY, MODOC_SA_MULTILINGUAL_COMPACT } from "./system-prompt";
