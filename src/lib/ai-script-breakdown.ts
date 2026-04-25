/**
 * Prompt + JSON extraction for full-script breakdown automation (server-side AI).
 */

export const AI_SCRIPT_BREAKDOWN_SYSTEM = `You are an expert script supervisor and line producer. You read feature-style screenplays and output structured production breakdown data as JSON only.

Rules:
- Output a single JSON object. No markdown fences, no commentary before or after.
- Use scene numbers as strings matching slugline order (first INT./EXT. line is "1", second is "2", etc.).
- intExt must be one of: INT, EXT, INT_EXT, UNKNOWN
- timeOfDay must be one of: DAY, NIGHT, DAWN, DUSK, CONTINUOUS, LATER, SAME, UNKNOWN
- storyDay is an integer: narrative day in story order (increment when the script clearly moves to a new calendar/story day).
- summary: 2–5 sentences of actionable scene description (what happens, who is present, key beats). Not slugline copy.
- For every breakdown item, include sceneNumbers listing every scene where that element appears (dedupe names across scenes into one row per unique entity when the same name recurs).
- Be conservative: if unsure, omit an item rather than inventing.`;

export function buildAiScriptBreakdownUserPrompt(scriptTitle: string, screenplay: string): string {
  return `Script title: ${scriptTitle}

Read the entire screenplay and fill this JSON shape (all keys optional except follow structure):

{
  "scenes": [
    {
      "sceneNumber": "1",
      "summary": "string",
      "storyDay": 1,
      "intExt": "INT",
      "timeOfDay": "DAY"
    }
  ],
  "characters": [ { "name": "string", "sceneNumbers": ["1","2"] } ],
  "props": [ { "name": "string", "description": "string", "special": false, "sceneNumbers": ["1"] } ],
  "locations": [ { "name": "string", "description": "string", "sceneNumbers": ["1"] } ],
  "wardrobe": [ { "description": "string", "character": "string or null", "sceneNumbers": ["1"] } ],
  "extras": [ { "description": "string", "quantity": 1, "sceneNumbers": ["1"] } ],
  "vehicles": [ { "description": "string", "stuntRelated": false, "sceneNumbers": ["1"] } ],
  "stunts": [ { "description": "string", "safetyNotes": "string or null", "sceneNumbers": ["1"] } ],
  "sfx": [ { "description": "string", "practical": false, "sceneNumbers": ["1"] } ],
  "makeups": [ { "notes": "string", "character": "string or null", "sceneNumbers": ["1"] } ]
}

Screenplay:
---
${screenplay}
---
`;
}

export type AiParsedBreakdown = {
  scenes?: Array<{
    sceneNumber: string;
    summary?: string | null;
    storyDay?: number | null;
    intExt?: string | null;
    timeOfDay?: string | null;
  }>;
  characters?: Array<{ name: string; sceneNumbers?: string[] }>;
  props?: Array<{
    name: string;
    description?: string | null;
    special?: boolean;
    sceneNumbers?: string[];
  }>;
  locations?: Array<{
    name: string;
    description?: string | null;
    sceneNumbers?: string[];
  }>;
  wardrobe?: Array<{
    description: string;
    character?: string | null;
    sceneNumbers?: string[];
  }>;
  extras?: Array<{
    description: string;
    quantity?: number;
    sceneNumbers?: string[];
  }>;
  vehicles?: Array<{
    description: string;
    stuntRelated?: boolean;
    sceneNumbers?: string[];
  }>;
  stunts?: Array<{
    description: string;
    safetyNotes?: string | null;
    sceneNumbers?: string[];
  }>;
  sfx?: Array<{
    description: string;
    practical?: boolean;
    sceneNumbers?: string[];
  }>;
  makeups?: Array<{
    notes: string;
    character?: string | null;
    sceneNumbers?: string[];
  }>;
};

export function extractJsonObjectFromAiText(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function coerceAiBreakdown(raw: unknown): AiParsedBreakdown {
  if (!raw || typeof raw !== "object") return {};
  return raw as AiParsedBreakdown;
}

function normSceneNums(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function normalizeAiBreakdown(parsed: AiParsedBreakdown): AiParsedBreakdown {
  const scenes = (parsed.scenes ?? [])
    .map((s) => ({
      sceneNumber: String(s.sceneNumber ?? "").trim(),
      summary: s.summary ?? null,
      storyDay: s.storyDay == null || Number.isNaN(Number(s.storyDay)) ? null : Number(s.storyDay),
      intExt: s.intExt ? String(s.intExt).toUpperCase() : null,
      timeOfDay: s.timeOfDay ? String(s.timeOfDay).toUpperCase() : null,
    }))
    .filter((s) => s.sceneNumber);

  return {
    scenes,
    characters: (parsed.characters ?? [])
      .map((c) => ({ name: String(c.name ?? "").trim(), sceneNumbers: normSceneNums(c.sceneNumbers) }))
      .filter((c) => c.name),
    props: (parsed.props ?? [])
      .map((p) => ({
        name: String(p.name ?? "").trim(),
        description: p.description ?? "",
        special: !!p.special,
        sceneNumbers: normSceneNums(p.sceneNumbers),
      }))
      .filter((p) => p.name),
    locations: (parsed.locations ?? [])
      .map((l) => ({
        name: String(l.name ?? "").trim(),
        description: l.description ?? "",
        sceneNumbers: normSceneNums(l.sceneNumbers),
      }))
      .filter((l) => l.name),
    wardrobe: (parsed.wardrobe ?? [])
      .map((w) => ({
        description: String(w.description ?? "").trim(),
        character: w.character ?? null,
        sceneNumbers: normSceneNums(w.sceneNumbers),
      }))
      .filter((w) => w.description),
    extras: (parsed.extras ?? [])
      .map((e) => ({
        description: String(e.description ?? "").trim(),
        quantity: Number.isFinite(e.quantity) ? Math.max(1, Math.floor(Number(e.quantity))) : 1,
        sceneNumbers: normSceneNums(e.sceneNumbers),
      }))
      .filter((e) => e.description),
    vehicles: (parsed.vehicles ?? [])
      .map((v) => ({
        description: String(v.description ?? "").trim(),
        stuntRelated: !!v.stuntRelated,
        sceneNumbers: normSceneNums(v.sceneNumbers),
      }))
      .filter((v) => v.description),
    stunts: (parsed.stunts ?? [])
      .map((s) => ({
        description: String(s.description ?? "").trim(),
        safetyNotes: s.safetyNotes ?? null,
        sceneNumbers: normSceneNums(s.sceneNumbers),
      }))
      .filter((s) => s.description),
    sfx: (parsed.sfx ?? [])
      .map((fx) => ({
        description: String(fx.description ?? "").trim(),
        practical: !!fx.practical,
        sceneNumbers: normSceneNums(fx.sceneNumbers),
      }))
      .filter((fx) => fx.description),
    makeups: (parsed.makeups ?? [])
      .map((m) => ({
        notes: String(m.notes ?? "").trim(),
        character: m.character ?? null,
        sceneNumbers: normSceneNums(m.sceneNumbers),
      }))
      .filter((m) => m.notes),
  };
}
