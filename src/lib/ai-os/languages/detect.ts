import type { SaLanguageCode } from "@/lib/sa-languages/constants";
import { SA_OFFICIAL_LANGUAGES } from "@/lib/sa-languages/constants";

/** Lightweight marker words for on-the-fly language detection (code-switching aware). */
const LANGUAGE_MARKERS: Record<SaLanguageCode, RegExp[]> = {
  en: [/\b(the|and|what|how|please|thanks|hello|movie|film)\b/i],
  zu: [
    /\b(yebo|cha|sawubona|unjani|ngiyabonga|siyabonga|umshini|indoda|abantu|kakhulu|nje|kodwa|futhi)\b/i,
    /\b(ngi-|uku-|isi-|kwa-)/i,
  ],
  xh: [
    /\b(molo|enkosi|ndiyabulela|umntu|indoda|ibhinqa|kakhulu|kunjalo|kwaye)\b/i,
    /\b(ndi-|uku-|isi-)/i,
  ],
  af: [
    /\b(ja|nee|hallo|dankie|asseblief|lekker|baie|goed|more|aand|film|fliek)\b/i,
    /\b(jy|ek|ons|hulle|wat|hoekom)\b/i,
  ],
  st: [
    /\b(lumela|ke a leboha|ntle|hantle|monna|mosadi|batho|joaloka|empa)\b/i,
    /\b(ke |ha |ho )/i,
  ],
  tn: [
    /\b(dumela|ke a leboga|sentle|monna|mosadi|batho|fa|gore)\b/i,
    /\b(ke |ga |go )/i,
  ],
  nso: [
    /\b(thobela|ke a leboga|gabotse|monna|mosadi|batho|bjalo|mme)\b/i,
    /\b(ke |ga |go )/i,
  ],
  ts: [
    /\b(avuxeni|ndzi khensa|kahle|vanhu|munhu|xana|kambe)\b/i,
  ],
  ss: [
    /\b(sawubona|ngiyabonga|kahle|bantfu|umuntfu|kodvwa|futsi)\b/i,
  ],
  ve: [
    /\b(ndaa|ndza khensa|vha|vhanwe|munna|musadzi|fhedzi|zwino)\b/i,
  ],
  nr: [
    /\b(sawubona|ngiyabonga|kahle|abantu|umuntu|kodwa|futhi|sithi)\b/i,
    /\b(ngi-|isi-)/i,
  ],
};

export type SaLanguageDetection = {
  primary: SaLanguageCode | null;
  /** All languages with non-zero score, highest first */
  ranked: Array<{ code: SaLanguageCode; label: string; score: number }>;
  /** User appears to mix English with an SA language */
  codeSwitching: boolean;
  /** Terms that may need glossary lookup (non-ASCII or long tokens) */
  lookupTerms: string[];
};

function extractLookupTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const raw of text.split(/[\s,.!?;:"'()[\]{}]+/)) {
    const t = raw.trim();
    if (t.length < 2 || t.length > 48) continue;
    if (/[^\x00-\x7F]/.test(t)) terms.add(t);
    if (/^[a-z]{3,}$/i.test(t) && !/^(the|and|for|you|what|how|can|please)$/i.test(t)) {
      terms.add(t);
    }
  }
  return [...terms].slice(0, 12);
}

/** Detect South African languages in user text — fast heuristic, no external API. */
export function detectSaLanguages(text: string): SaLanguageDetection {
  const trimmed = text.trim();
  if (!trimmed) {
    return { primary: null, ranked: [], codeSwitching: false, lookupTerms: [] };
  }

  const scores = new Map<SaLanguageCode, number>();
  for (const lang of SA_OFFICIAL_LANGUAGES) {
    let score = 0;
    for (const pattern of LANGUAGE_MARKERS[lang.code]) {
      const matches = trimmed.match(new RegExp(pattern.source, pattern.flags + "g"));
      if (matches) score += matches.length;
    }
    if (score > 0) scores.set(lang.code, score);
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, score]) => ({
      code,
      label: SA_OFFICIAL_LANGUAGES.find((l) => l.code === code)!.label,
      score,
    }));

  let primary = ranked[0]?.code ?? null;
  if (primary === "en" && ranked[1] && ranked[1].score >= ranked[0].score) {
    primary = ranked[1].code;
  }
  const hasEn = (scores.get("en") ?? 0) > 0;
  const hasOther = ranked.some((r) => r.code !== "en");
  const codeSwitching = hasEn && hasOther && ranked.length >= 2;

  return {
    primary,
    ranked,
    codeSwitching,
    lookupTerms: extractLookupTerms(trimmed),
  };
}

export function isSaMultilingualEnabled(): boolean {
  return process.env.AI_SA_LANGUAGES_ENABLED !== "false";
}
