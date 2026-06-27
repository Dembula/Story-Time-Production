import type { SaLanguageCode } from "@/lib/sa-languages/constants";

export type SaGlossarySeedEntry = {
  language: SaLanguageCode;
  term: string;
  meaning: string;
  /** standard | informal | slang | tsotsitaal | township */
  register: string;
  slang: boolean;
  examples?: string;
  related?: string[];
};

/** Starter glossary — indexed into RAG; expanded continuously via conversation learning. */
export const SA_GLOSSARY_SEED: SaGlossarySeedEntry[] = [
  // isiZulu
  { language: "zu", term: "yebo", meaning: "Yes (affirmative).", register: "standard", slang: false },
  { language: "zu", term: "cha", meaning: "No.", register: "standard", slang: false },
  { language: "zu", term: "sawubona", meaning: "Hello (to one person).", register: "standard", slang: false },
  { language: "zu", term: "sanibonani", meaning: "Hello (to many).", register: "standard", slang: false },
  { language: "zu", term: "ngiyabonga", meaning: "Thank you (I thank you).", register: "standard", slang: false },
  { language: "zu", term: "umshini wami", meaning: "My machine / my gun — famous phrase; in film/music culture often symbolic of power or struggle.", register: "slang", slang: true, examples: "Used in SA popular culture; context matters." },
  { language: "zu", term: "tsotsi", meaning: "Gangster, hoodlum, or streetwise person — widely used SA slang across languages.", register: "slang", slang: true },
  { language: "zu", term: "skhotane", meaning: "Subculture/showmanship slang around fashion and status — township youth culture.", register: "slang", slang: true },
  { language: "zu", term: "abantu", meaning: "People.", register: "standard", slang: false },
  { language: "zu", term: "indoda", meaning: "Man / adult male.", register: "standard", slang: false },
  // isiXhosa
  { language: "xh", term: "molo", meaning: "Hello (to one person).", register: "standard", slang: false },
  { language: "xh", term: "molweni", meaning: "Hello (to many).", register: "standard", slang: false },
  { language: "xh", term: "enkosi", meaning: "Thank you.", register: "standard", slang: false },
  { language: "xh", term: "ubuntu", meaning: "Shared humanity / interconnectedness — core philosophical concept in SA storytelling.", register: "standard", slang: false },
  { language: "xh", term: "umntu", meaning: "Person.", register: "standard", slang: false },
  { language: "xh", term: "ibhinqa", meaning: "Young woman / girl (colloquial).", register: "informal", slang: false },
  // Afrikaans
  { language: "af", term: "lekker", meaning: "Nice, good, tasty, cool — extremely common across SA English too.", register: "informal", slang: false },
  { language: "af", term: "howzit", meaning: "Casual greeting (how is it?) — widely used in SA English.", register: "slang", slang: true },
  { language: "af", term: "braai", meaning: "Barbecue — cultural staple; also used in English.", register: "standard", slang: false },
  { language: "af", term: "eish", meaning: "Exclamation of surprise/frustration — used across SA languages.", register: "slang", slang: true },
  { language: "af", term: "ja", meaning: "Yes.", register: "standard", slang: false },
  { language: "af", term: "dankie", meaning: "Thank you.", register: "standard", slang: false },
  // Sesotho
  { language: "st", term: "lumela", meaning: "Hello.", register: "standard", slang: false },
  { language: "st", term: "ke a leboha", meaning: "Thank you.", register: "standard", slang: false },
  { language: "st", term: "joaloka", meaning: "Like / as.", register: "standard", slang: false },
  // Setswana
  { language: "tn", term: "dumela", meaning: "Hello.", register: "standard", slang: false },
  { language: "tn", term: "ke a leboga", meaning: "Thank you.", register: "standard", slang: false },
  // Sepedi
  { language: "nso", term: "thobela", meaning: "Hello.", register: "standard", slang: false },
  { language: "nso", term: "ke a leboga", meaning: "Thank you.", register: "standard", slang: false },
  // Xitsonga
  { language: "ts", term: "avuxeni", meaning: "Good morning / hello.", register: "standard", slang: false },
  { language: "ts", term: "ndzi khensa", meaning: "Thank you.", register: "standard", slang: false },
  // siSwati
  { language: "ss", term: "sawubona", meaning: "Hello.", register: "standard", slang: false },
  { language: "ss", term: "ngiyabonga", meaning: "Thank you.", register: "standard", slang: false },
  // Tshivenda
  { language: "ve", term: "ndaa", meaning: "Hello.", register: "standard", slang: false },
  { language: "ve", term: "ndza khensa", meaning: "Thank you.", register: "standard", slang: false },
  // isiNdebele
  { language: "nr", term: "sawubona", meaning: "Hello.", register: "standard", slang: false },
  { language: "nr", term: "ngiyabonga", meaning: "Thank you.", register: "standard", slang: false },
  // Pan-SA English slang (catalogue discovery)
  { language: "en", term: "now now", meaning: "Soon / in a little while — SA English time expression.", register: "slang", slang: true },
  { language: "en", term: "just now", meaning: "Recently or soon depending on context — SA English ambiguity.", register: "slang", slang: true },
  { language: "en", term: "sharp sharp", meaning: "OK, agreed, cool — casual affirmation.", register: "slang", slang: true },
  { language: "en", term: "shame", meaning: "Expression of sympathy or endearment — not always negative.", register: "slang", slang: true },
  { language: "en", term: "is it", meaning: "Really? / Is that so? — SA English tag question.", register: "slang", slang: true },
  { language: "en", term: "taxi rank", meaning: "Minibus taxi hub — key SA urban setting in film.", register: "standard", slang: false },
  { language: "en", term: "township", meaning: "Historically segregated urban residential area — central to SA cinema.", register: "standard", slang: false },
];

export function glossaryChunkKey(language: SaLanguageCode, term: string): string {
  return `sa-lang:${language}:${term.toLowerCase().replace(/\s+/g, "-")}`;
}
