import "server-only";

/** Inferred production setting from screenplay text and scene headings. */
export type ProductionContextInference = {
  primaryCity: string | null;
  country: string;
  regionLabel: string;
  intSceneCount: number;
  extSceneCount: number;
  estimatedShootDays: number;
  settingHints: string[];
};

const SA_CITIES = [
  "johannesburg",
  "joburg",
  "cape town",
  "durban",
  "pretoria",
  "port elizabeth",
  "gqeberha",
  "bloemfontein",
  "soweto",
  "sandton",
  "stellenbosch",
];

const CITY_DISPLAY: Record<string, string> = {
  johannesburg: "Johannesburg",
  joburg: "Johannesburg",
  "cape town": "Cape Town",
  durban: "Durban",
  pretoria: "Pretoria",
  "port elizabeth": "Port Elizabeth",
  gqeberha: "Gqeberha",
  bloemfontein: "Bloemfontein",
  soweto: "Soweto",
  sandton: "Sandton",
  stellenbosch: "Stellenbosch",
};

function normalizeCity(raw: string): string {
  const key = raw.toLowerCase().trim();
  return CITY_DISPLAY[key] ?? raw.trim();
}

/** Infer city, country, and shoot-day estimate from script + scene headings. */
export function inferProductionContext(input: {
  scriptText?: string;
  sceneHeadings?: string[];
  sceneCount?: number;
}): ProductionContextInference {
  const blob = [
    input.scriptText ?? "",
    ...(input.sceneHeadings ?? []),
  ]
    .join("\n")
    .toLowerCase();

  let primaryCity: string | null = null;
  for (const city of SA_CITIES) {
    if (blob.includes(city)) {
      primaryCity = normalizeCity(city);
      break;
    }
  }

  const country = blob.includes("south africa") || blob.includes(" zar") || primaryCity ? "South Africa" : "South Africa";

  let intSceneCount = 0;
  let extSceneCount = 0;
  for (const line of input.sceneHeadings ?? []) {
    const t = line.trim().toUpperCase();
    if (t.startsWith("INT.")) intSceneCount++;
    else if (t.startsWith("EXT.")) extSceneCount++;
  }
  if (intSceneCount === 0 && extSceneCount === 0 && input.scriptText) {
    intSceneCount = (input.scriptText.match(/^INT\./gim) ?? []).length;
    extSceneCount = (input.scriptText.match(/^EXT\./gim) ?? []).length;
  }

  const totalScenes = input.sceneCount ?? intSceneCount + extSceneCount;
  const estimatedShootDays = Math.max(1, Math.ceil(totalScenes / 6));

  const settingHints: string[] = [];
  if (blob.includes("apartment") || blob.includes("flat")) settingHints.push("residential-apartment");
  if (blob.includes("house") || blob.includes("home")) settingHints.push("residential-house");
  if (blob.includes("office")) settingHints.push("commercial-office");
  if (blob.includes("warehouse")) settingHints.push("industrial-warehouse");
  if (blob.includes("school")) settingHints.push("institutional-school");
  if (blob.includes("restaurant") || blob.includes("cafe")) settingHints.push("hospitality");

  return {
    primaryCity,
    country,
    regionLabel: primaryCity ? `${primaryCity}, ${country}` : country,
    intSceneCount,
    extSceneCount,
    estimatedShootDays,
    settingHints,
  };
}

/** Map breakdown location name to marketplace listing type keywords. */
export function locationKeywordsForBreakdown(name: string, description?: string | null): string[] {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  const keys: string[] = [];
  if (/house|home|mansion|villa|cottage/.test(text)) keys.push("house", "home", "residential");
  if (/apartment|flat|condo|loft/.test(text)) keys.push("apartment", "residential");
  if (/office|corporate|boardroom/.test(text)) keys.push("office", "commercial");
  if (/warehouse|factory|industrial/.test(text)) keys.push("warehouse", "industrial");
  if (/street|road|alley|park|beach|forest/.test(text)) keys.push("outdoor", "street");
  if (/school|classroom|university/.test(text)) keys.push("school", "institutional");
  if (/restaurant|bar|cafe|kitchen/.test(text)) keys.push("restaurant", "hospitality");
  if (keys.length === 0) keys.push("house", "apartment", "location");
  return keys;
}
