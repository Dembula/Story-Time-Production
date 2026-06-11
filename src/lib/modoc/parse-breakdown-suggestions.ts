/** Parse VA breakdown chat lines (CHARACTER:, PROP:, etc.) into PATCH body shape. */

export type BreakdownSuggestionCategory =
  | "characters"
  | "props"
  | "locations"
  | "wardrobe"
  | "extras"
  | "vehicles"
  | "stunts"
  | "sfx"
  | "makeups";

export type ParsedBreakdownSuggestion = {
  category: BreakdownSuggestionCategory;
  label: string;
  raw: string;
};

const LINE_PREFIXES: { prefix: RegExp; category: BreakdownSuggestionCategory }[] = [
  { prefix: /^CHARACTER\s*:/i, category: "characters" },
  { prefix: /^PROP\s*:/i, category: "props" },
  { prefix: /^LOCATION\s*:/i, category: "locations" },
  { prefix: /^WARDROBE\s*:/i, category: "wardrobe" },
  { prefix: /^EXTRAS?\s*:/i, category: "extras" },
  { prefix: /^VEHICLE\s*:/i, category: "vehicles" },
  { prefix: /^STUNT\s*:/i, category: "stunts" },
  { prefix: /^SFX\s*:/i, category: "sfx" },
  { prefix: /^MAKEUP\s*:/i, category: "makeups" },
];

function splitFields(rest: string): string[] {
  return rest.split("|").map((s) => s.trim()).filter(Boolean);
}

function yesNo(value: string | undefined): boolean {
  if (!value) return false;
  return /^(yes|y|true|1)$/i.test(value.trim());
}

function parseQuantity(value: string | undefined): number {
  if (!value) return 1;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Extract structured breakdown rows from assistant message text. */
export function parseBreakdownSuggestions(text: string): ParsedBreakdownSuggestion[] {
  if (!text.trim()) return [];
  const out: ParsedBreakdownSuggestion[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const { prefix, category } of LINE_PREFIXES) {
      if (!prefix.test(trimmed)) continue;
      const rest = trimmed.replace(prefix, "").trim();
      if (!rest) break;
      out.push({ category, label: rest.split("|")[0]?.trim() || rest, raw: rest });
      break;
    }
  }

  return out;
}

export type BreakdownPatchBody = {
  characters?: { name: string; importance?: string | null; description?: string | null; sceneId?: string | null }[];
  props?: { name: string; description?: string | null; sceneId?: string | null }[];
  locations?: { name: string; description?: string | null; sceneId?: string | null }[];
  wardrobe?: { description: string; character?: string | null; sceneId?: string | null }[];
  extras?: { description: string; quantity?: number; sceneId?: string | null }[];
  vehicles?: { description: string; stuntRelated?: boolean; sceneId?: string | null }[];
  stunts?: { description: string; safetyNotes?: string | null; sceneId?: string | null }[];
  sfx?: { description: string; practical?: boolean; sceneId?: string | null }[];
  makeups?: { notes: string; character?: string | null; sceneId?: string | null }[];
};

/** Convert parsed suggestions into bulk PATCH body for /breakdown. */
export function breakdownSuggestionsToPatchBody(
  suggestions: ParsedBreakdownSuggestion[],
  sceneId?: string | null,
): BreakdownPatchBody {
  const body: BreakdownPatchBody = {};
  const sid = sceneId ?? null;

  for (const item of suggestions) {
    const fields = splitFields(item.raw);
    switch (item.category) {
      case "characters": {
        body.characters = body.characters ?? [];
        body.characters.push({
          name: fields[0] ?? item.label,
          importance: fields[1] ?? null,
          description: fields[2] ?? fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
      case "props": {
        body.props = body.props ?? [];
        body.props.push({
          name: fields[0] ?? item.label,
          description: fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
      case "locations": {
        body.locations = body.locations ?? [];
        body.locations.push({
          name: fields[0] ?? item.label,
          description: fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
      case "wardrobe": {
        body.wardrobe = body.wardrobe ?? [];
        body.wardrobe.push({
          description: fields[0] ?? item.label,
          character: fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
      case "extras": {
        body.extras = body.extras ?? [];
        body.extras.push({
          description: fields[0] ?? item.label,
          quantity: parseQuantity(fields[1]),
          sceneId: sid,
        });
        break;
      }
      case "vehicles": {
        body.vehicles = body.vehicles ?? [];
        body.vehicles.push({
          description: fields[0] ?? item.label,
          stuntRelated: yesNo(fields[1]),
          sceneId: sid,
        });
        break;
      }
      case "stunts": {
        body.stunts = body.stunts ?? [];
        body.stunts.push({
          description: fields[0] ?? item.label,
          safetyNotes: fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
      case "sfx": {
        body.sfx = body.sfx ?? [];
        body.sfx.push({
          description: fields[0] ?? item.label,
          practical: yesNo(fields[1]),
          sceneId: sid,
        });
        break;
      }
      case "makeups": {
        body.makeups = body.makeups ?? [];
        body.makeups.push({
          notes: fields[0] ?? item.label,
          character: fields[1] ?? null,
          sceneId: sid,
        });
        break;
      }
    }
  }

  return body;
}

export function countBreakdownPatchItems(body: BreakdownPatchBody): number {
  return (
    (body.characters?.length ?? 0) +
    (body.props?.length ?? 0) +
    (body.locations?.length ?? 0) +
    (body.wardrobe?.length ?? 0) +
    (body.extras?.length ?? 0) +
    (body.vehicles?.length ?? 0) +
    (body.stunts?.length ?? 0) +
    (body.sfx?.length ?? 0) +
    (body.makeups?.length ?? 0)
  );
}
