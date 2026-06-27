/** South Africa's 11 official languages + common platform labels (matches creator upload). */
export type SaLanguageCode =
  | "en"
  | "zu"
  | "xh"
  | "af"
  | "st"
  | "tn"
  | "nso"
  | "ts"
  | "ss"
  | "ve"
  | "nr";

export type SaLanguageDefinition = {
  code: SaLanguageCode;
  /** Display name used in Story Time UI */
  label: string;
  /** BCP-47-ish tag for subtitles / metadata */
  bcp47: string;
  /** Alternative names users might say */
  aliases: string[];
};

export const SA_OFFICIAL_LANGUAGES: SaLanguageDefinition[] = [
  { code: "en", label: "English", bcp47: "en-ZA", aliases: ["english", "eng"] },
  { code: "zu", label: "isiZulu", bcp47: "zu-ZA", aliases: ["zulu", "isizulu"] },
  { code: "xh", label: "isiXhosa", bcp47: "xh-ZA", aliases: ["xhosa", "isixhosa"] },
  { code: "af", label: "Afrikaans", bcp47: "af-ZA", aliases: ["afrikaans"] },
  { code: "st", label: "Sesotho", bcp47: "st-ZA", aliases: ["sesotho", "southern sotho", "sotho"] },
  { code: "tn", label: "Setswana", bcp47: "tn-ZA", aliases: ["setswana", "tswana"] },
  { code: "nso", label: "Sepedi", bcp47: "nso-ZA", aliases: ["sepedi", "pedi", "northern sotho"] },
  { code: "ts", label: "Xitsonga", bcp47: "ts-ZA", aliases: ["xitsonga", "tsonga"] },
  { code: "ss", label: "siSwati", bcp47: "ss-ZA", aliases: ["siswati", "swati", "swazi"] },
  { code: "ve", label: "Tshivenda", bcp47: "ve-ZA", aliases: ["tshivenda", "venda"] },
  { code: "nr", label: "isiNdebele", bcp47: "nr-ZA", aliases: ["ndebele", "isindebele", "southern ndebele"] },
];

/** Labels for dropdowns — same order as creator upload. */
export const SA_LANGUAGE_LABELS = SA_OFFICIAL_LANGUAGES.map((l) => l.label);

export function resolveSaLanguageCode(input: string | null | undefined): SaLanguageCode | null {
  if (!input?.trim()) return null;
  const q = input.trim().toLowerCase();
  for (const lang of SA_OFFICIAL_LANGUAGES) {
    if (lang.code === q || lang.label.toLowerCase() === q || lang.bcp47.toLowerCase() === q) {
      return lang.code;
    }
    if (lang.aliases.some((a) => a === q || q.includes(a))) return lang.code;
  }
  return null;
}

export function saLanguageLabel(code: SaLanguageCode): string {
  return SA_OFFICIAL_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
