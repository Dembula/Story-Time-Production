import { SA_OFFICIAL_LANGUAGES } from "@/lib/sa-languages/constants";

export type SubtitleLanguageOption = {
  /** ISO 639-1 (or extended) code */
  code: string;
  /** Player / upload display name */
  label: string;
  /** BCP-47 tag stored on subtitle tracks */
  bcp47: string;
};

/** South Africa's official languages — listed first in subtitle pickers. */
export const SUBTITLE_SA_LANGUAGES: SubtitleLanguageOption[] = SA_OFFICIAL_LANGUAGES.map((lang) => ({
  code: lang.code,
  label: lang.label,
  bcp47: lang.bcp47,
}));

const SA_BCP47 = new Set(SUBTITLE_SA_LANGUAGES.map((lang) => lang.bcp47));

/**
 * Global subtitle languages (ISO 639-1 and common variants).
 * SA official languages are excluded here because they appear in their own group.
 */
const WORLD_SUBTITLE_LANGUAGES: SubtitleLanguageOption[] = [
  { code: "ab", label: "Abkhazian", bcp47: "ab" },
  { code: "aa", label: "Afar", bcp47: "aa" },
  { code: "af", label: "Afrikaans (International)", bcp47: "af" },
  { code: "sq", label: "Albanian", bcp47: "sq" },
  { code: "am", label: "Amharic", bcp47: "am" },
  { code: "ar", label: "Arabic", bcp47: "ar" },
  { code: "an", label: "Aragonese", bcp47: "an" },
  { code: "hy", label: "Armenian", bcp47: "hy" },
  { code: "as", label: "Assamese", bcp47: "as" },
  { code: "ay", label: "Aymara", bcp47: "ay" },
  { code: "az", label: "Azerbaijani", bcp47: "az" },
  { code: "bm", label: "Bambara", bcp47: "bm" },
  { code: "eu", label: "Basque", bcp47: "eu" },
  { code: "be", label: "Belarusian", bcp47: "be" },
  { code: "bn", label: "Bengali", bcp47: "bn" },
  { code: "bi", label: "Bislama", bcp47: "bi" },
  { code: "bs", label: "Bosnian", bcp47: "bs" },
  { code: "br", label: "Breton", bcp47: "br" },
  { code: "bg", label: "Bulgarian", bcp47: "bg" },
  { code: "my", label: "Burmese", bcp47: "my" },
  { code: "ca", label: "Catalan", bcp47: "ca" },
  { code: "ceb", label: "Cebuano", bcp47: "ceb" },
  { code: "ny", label: "Chichewa", bcp47: "ny" },
  { code: "zh", label: "Chinese (Simplified)", bcp47: "zh-Hans" },
  { code: "zh-hant", label: "Chinese (Traditional)", bcp47: "zh-Hant" },
  { code: "cv", label: "Chuvash", bcp47: "cv" },
  { code: "kw", label: "Cornish", bcp47: "kw" },
  { code: "co", label: "Corsican", bcp47: "co" },
  { code: "hr", label: "Croatian", bcp47: "hr" },
  { code: "cs", label: "Czech", bcp47: "cs" },
  { code: "da", label: "Danish", bcp47: "da" },
  { code: "dv", label: "Divehi", bcp47: "dv" },
  { code: "nl", label: "Dutch", bcp47: "nl" },
  { code: "dz", label: "Dzongkha", bcp47: "dz" },
  { code: "en", label: "English (International)", bcp47: "en" },
  { code: "en-gb", label: "English (UK)", bcp47: "en-GB" },
  { code: "en-us", label: "English (US)", bcp47: "en-US" },
  { code: "eo", label: "Esperanto", bcp47: "eo" },
  { code: "et", label: "Estonian", bcp47: "et" },
  { code: "ee", label: "Ewe", bcp47: "ee" },
  { code: "fo", label: "Faroese", bcp47: "fo" },
  { code: "fj", label: "Fijian", bcp47: "fj" },
  { code: "fil", label: "Filipino", bcp47: "fil" },
  { code: "fi", label: "Finnish", bcp47: "fi" },
  { code: "fr", label: "French", bcp47: "fr" },
  { code: "fr-ca", label: "French (Canada)", bcp47: "fr-CA" },
  { code: "fy", label: "Frisian", bcp47: "fy" },
  { code: "ff", label: "Fulah", bcp47: "ff" },
  { code: "gl", label: "Galician", bcp47: "gl" },
  { code: "lg", label: "Ganda", bcp47: "lg" },
  { code: "ka", label: "Georgian", bcp47: "ka" },
  { code: "de", label: "German", bcp47: "de" },
  { code: "el", label: "Greek", bcp47: "el" },
  { code: "gn", label: "Guarani", bcp47: "gn" },
  { code: "gu", label: "Gujarati", bcp47: "gu" },
  { code: "ht", label: "Haitian Creole", bcp47: "ht" },
  { code: "ha", label: "Hausa", bcp47: "ha" },
  { code: "he", label: "Hebrew", bcp47: "he" },
  { code: "hi", label: "Hindi", bcp47: "hi" },
  { code: "hu", label: "Hungarian", bcp47: "hu" },
  { code: "is", label: "Icelandic", bcp47: "is" },
  { code: "ig", label: "Igbo", bcp47: "ig" },
  { code: "id", label: "Indonesian", bcp47: "id" },
  { code: "ga", label: "Irish", bcp47: "ga" },
  { code: "it", label: "Italian", bcp47: "it" },
  { code: "ja", label: "Japanese", bcp47: "ja" },
  { code: "jv", label: "Javanese", bcp47: "jv" },
  { code: "kn", label: "Kannada", bcp47: "kn" },
  { code: "kk", label: "Kazakh", bcp47: "kk" },
  { code: "km", label: "Khmer", bcp47: "km" },
  { code: "rw", label: "Kinyarwanda", bcp47: "rw" },
  { code: "ko", label: "Korean", bcp47: "ko" },
  { code: "ku", label: "Kurdish", bcp47: "ku" },
  { code: "ky", label: "Kyrgyz", bcp47: "ky" },
  { code: "lo", label: "Lao", bcp47: "lo" },
  { code: "la", label: "Latin", bcp47: "la" },
  { code: "lv", label: "Latvian", bcp47: "lv" },
  { code: "ln", label: "Lingala", bcp47: "ln" },
  { code: "lt", label: "Lithuanian", bcp47: "lt" },
  { code: "lb", label: "Luxembourgish", bcp47: "lb" },
  { code: "mk", label: "Macedonian", bcp47: "mk" },
  { code: "mg", label: "Malagasy", bcp47: "mg" },
  { code: "ms", label: "Malay", bcp47: "ms" },
  { code: "ml", label: "Malayalam", bcp47: "ml" },
  { code: "mt", label: "Maltese", bcp47: "mt" },
  { code: "mi", label: "Maori", bcp47: "mi" },
  { code: "mr", label: "Marathi", bcp47: "mr" },
  { code: "mn", label: "Mongolian", bcp47: "mn" },
  { code: "ne", label: "Nepali", bcp47: "ne" },
  { code: "no", label: "Norwegian", bcp47: "no" },
  { code: "nb", label: "Norwegian Bokmål", bcp47: "nb" },
  { code: "nn", label: "Norwegian Nynorsk", bcp47: "nn" },
  { code: "oc", label: "Occitan", bcp47: "oc" },
  { code: "or", label: "Odia", bcp47: "or" },
  { code: "om", label: "Oromo", bcp47: "om" },
  { code: "ps", label: "Pashto", bcp47: "ps" },
  { code: "fa", label: "Persian", bcp47: "fa" },
  { code: "pl", label: "Polish", bcp47: "pl" },
  { code: "pt", label: "Portuguese", bcp47: "pt" },
  { code: "pt-br", label: "Portuguese (Brazil)", bcp47: "pt-BR" },
  { code: "pa", label: "Punjabi", bcp47: "pa" },
  { code: "qu", label: "Quechua", bcp47: "qu" },
  { code: "ro", label: "Romanian", bcp47: "ro" },
  { code: "rm", label: "Romansh", bcp47: "rm" },
  { code: "ru", label: "Russian", bcp47: "ru" },
  { code: "sm", label: "Samoan", bcp47: "sm" },
  { code: "sg", label: "Sango", bcp47: "sg" },
  { code: "sa", label: "Sanskrit", bcp47: "sa" },
  { code: "gd", label: "Scottish Gaelic", bcp47: "gd" },
  { code: "sr", label: "Serbian", bcp47: "sr" },
  { code: "sn", label: "Shona", bcp47: "sn" },
  { code: "sd", label: "Sindhi", bcp47: "sd" },
  { code: "si", label: "Sinhala", bcp47: "si" },
  { code: "sk", label: "Slovak", bcp47: "sk" },
  { code: "sl", label: "Slovenian", bcp47: "sl" },
  { code: "so", label: "Somali", bcp47: "so" },
  { code: "es", label: "Spanish", bcp47: "es" },
  { code: "es-419", label: "Spanish (Latin America)", bcp47: "es-419" },
  { code: "su", label: "Sundanese", bcp47: "su" },
  { code: "sw", label: "Swahili", bcp47: "sw" },
  { code: "sv", label: "Swedish", bcp47: "sv" },
  { code: "tl", label: "Tagalog", bcp47: "tl" },
  { code: "tg", label: "Tajik", bcp47: "tg" },
  { code: "ta", label: "Tamil", bcp47: "ta" },
  { code: "tt", label: "Tatar", bcp47: "tt" },
  { code: "te", label: "Telugu", bcp47: "te" },
  { code: "th", label: "Thai", bcp47: "th" },
  { code: "bo", label: "Tibetan", bcp47: "bo" },
  { code: "ti", label: "Tigrinya", bcp47: "ti" },
  { code: "to", label: "Tongan", bcp47: "to" },
  { code: "tr", label: "Turkish", bcp47: "tr" },
  { code: "tk", label: "Turkmen", bcp47: "tk" },
  { code: "uk", label: "Ukrainian", bcp47: "uk" },
  { code: "ur", label: "Urdu", bcp47: "ur" },
  { code: "ug", label: "Uyghur", bcp47: "ug" },
  { code: "uz", label: "Uzbek", bcp47: "uz" },
  { code: "vi", label: "Vietnamese", bcp47: "vi" },
  { code: "cy", label: "Welsh", bcp47: "cy" },
  { code: "wo", label: "Wolof", bcp47: "wo" },
  { code: "xh-intl", label: "Xhosa (International)", bcp47: "xh" },
  { code: "yi", label: "Yiddish", bcp47: "yi" },
  { code: "yo", label: "Yoruba", bcp47: "yo" },
  { code: "zu-intl", label: "Zulu (International)", bcp47: "zu" },
];

export const SUBTITLE_WORLD_LANGUAGES: SubtitleLanguageOption[] = WORLD_SUBTITLE_LANGUAGES.filter(
  (lang) => !SA_BCP47.has(lang.bcp47),
).sort((a, b) => a.label.localeCompare(b.label));

/** Full picker list: SA official languages first, then all other languages A–Z. */
export const SUBTITLE_LANGUAGES: SubtitleLanguageOption[] = [
  ...SUBTITLE_SA_LANGUAGES,
  ...SUBTITLE_WORLD_LANGUAGES,
];

const BY_BCP47 = new Map(SUBTITLE_LANGUAGES.map((lang) => [lang.bcp47.toLowerCase(), lang]));

export function findSubtitleLanguage(bcp47: string | null | undefined): SubtitleLanguageOption | null {
  if (!bcp47?.trim()) return null;
  return BY_BCP47.get(bcp47.trim().toLowerCase()) ?? null;
}

export function subtitleLanguageLabel(bcp47: string | null | undefined): string {
  if (!bcp47?.trim()) return "Unknown";
  return findSubtitleLanguage(bcp47)?.label ?? bcp47;
}

/** Pick the next language not already used in subtitle rows. */
export function nextSubtitleLanguage(usedBcp47: string[]): SubtitleLanguageOption {
  const used = new Set(usedBcp47.map((value) => value.toLowerCase()));
  return (
    SUBTITLE_LANGUAGES.find((lang) => !used.has(lang.bcp47.toLowerCase())) ??
    SUBTITLE_LANGUAGES[0]!
  );
}
