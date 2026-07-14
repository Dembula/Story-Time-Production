import {
  CAMERA_SHOTS,
  CHARACTER_EXTENSIONS,
  SCENE_HEADING_PREFIXES,
  TIME_OF_DAY,
  TRANSITIONS,
  isSceneHeadingPrefixQuery,
} from "./elements";
import type { ScreenplayElementType } from "./types";
import { detectLineElement, leadingSpaces, padColumn } from "./screenplay-keyboard";
import { SCREENPLAY_COL } from "./elements";

export type ScreenplaySuggestion = {
  label: string;
  insert: string;
  element?: ScreenplayElementType;
};

export { isSceneHeadingPrefixQuery };

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Collect character names already used in the script (for autocomplete). */
export function collectCharacterNames(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    if (detectLineElement(line) !== "character") continue;
    const name = line
      .trim()
      .replace(/\s*\((V\.O\.|O\.S\.|CONT'D|OFF|PRE-LAP)\)\s*$/i, "")
      .trim();
    if (name.length >= 2) names.push(name.toUpperCase());
  }
  return uniquePreserveOrder(names);
}

/** Collect location fragments from scene headings. */
export function collectLocations(content: string): string[] {
  const locations: string[] = [];
  for (const line of content.split("\n")) {
    if (detectLineElement(line) !== "scene_heading") continue;
    const m = line.trim().match(/^(?:INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)\s*(.+?)\s*-\s*/i);
    if (m?.[1]) locations.push(m[1].trim().toUpperCase());
  }
  return uniquePreserveOrder(locations);
}

function startsWithQuery(candidate: string, query: string): boolean {
  if (!query) return true;
  return candidate.toLowerCase().startsWith(query.toLowerCase());
}

function includesQuery(candidate: string, query: string): boolean {
  if (!query) return true;
  return candidate.toLowerCase().includes(query.toLowerCase());
}

/**
 * Suggestions for the current line based on element type and typed prefix.
 */
export function getScreenplaySuggestions(options: {
  content: string;
  line: string;
  element: ScreenplayElementType;
  limit?: number;
}): ScreenplaySuggestion[] {
  const { content, line, element, limit = 8 } = options;
  const trimmed = line.trim();
  const query = trimmed.replace(/^\(+|\)+$/g, "").trim();
  const out: ScreenplaySuggestion[] = [];

  const wantsSceneHeading = element === "scene_heading" || (!trimmed && element === "action");

  if (wantsSceneHeading) {
    const prefixQuery = trimmed.replace(/\s+.*$/, "");
    // Only offer INT./EXT. while the line is empty or still looks like a prefix — never trap prose.
    if (!trimmed || isSceneHeadingPrefixQuery(prefixQuery)) {
      for (const prefix of SCENE_HEADING_PREFIXES) {
        if (
          !prefixQuery ||
          startsWithQuery(prefix, prefixQuery) ||
          startsWithQuery(prefix.replace(/\./g, ""), prefixQuery)
        ) {
          out.push({ label: prefix, insert: `${prefix} `, element: "scene_heading" });
        }
      }
    }
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i.test(trimmed)) {
      const afterPrefix = trimmed.replace(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)\s*/i, "");
      const locPart = afterPrefix.split(/\s*-\s*/)[0] ?? "";
      for (const loc of collectLocations(content)) {
        if (includesQuery(loc, locPart)) {
          const prefix = trimmed.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i)?.[0]?.toUpperCase() ?? "INT.";
          out.push({
            label: `${prefix} ${loc} - DAY`,
            insert: `${prefix} ${loc} - DAY`,
            element: "scene_heading",
          });
        }
      }
      if (afterPrefix.includes("-") || afterPrefix.endsWith(" ")) {
        const todQuery = (afterPrefix.split(/\s*-\s*/)[1] ?? "").trim();
        for (const tod of TIME_OF_DAY) {
          if (startsWithQuery(tod, todQuery)) {
            const prefix = trimmed.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i)?.[0]?.toUpperCase() ?? "INT.";
            const loc = (afterPrefix.split(/\s*-\s*/)[0] ?? "LOCATION").trim().toUpperCase() || "LOCATION";
            out.push({
              label: tod,
              insert: `${prefix} ${loc} - ${tod}`,
              element: "scene_heading",
            });
          }
        }
      }
    }
  }

  if (element === "character" || (element === "action" && !trimmed && leadingSpaces(line) === 0)) {
    for (const name of collectCharacterNames(content)) {
      if (startsWithQuery(name, query)) {
        out.push({
          label: name,
          insert: padColumn(name, SCREENPLAY_COL.character),
          element: "character",
        });
      }
    }
    if (trimmed && !trimmed.includes("(")) {
      for (const ext of CHARACTER_EXTENSIONS) {
        out.push({
          label: `${trimmed.toUpperCase()} ${ext}`,
          insert: padColumn(`${trimmed.toUpperCase()} ${ext}`, SCREENPLAY_COL.character),
          element: "character",
        });
      }
    }
  }

  if (element === "transition" || /^(cut|fade|dissolve|smash|match|wipe|jump|iris|cross)/i.test(trimmed)) {
    for (const t of TRANSITIONS) {
      if (includesQuery(t, query) || startsWithQuery(t, query)) {
        out.push({ label: t, insert: t, element: "transition" });
      }
    }
  }

  if (element === "shot" || (element === "action" && CAMERA_SHOTS.some((s) => startsWithQuery(s, query) && query.length >= 2))) {
    for (const shot of CAMERA_SHOTS) {
      if (startsWithQuery(shot, query) || includesQuery(shot, query)) {
        out.push({ label: shot, insert: shot, element: "shot" });
      }
    }
  }

  if (element === "parenthetical" || trimmed.startsWith("(")) {
    const parenSuggestions = ["whispering", "angry", "smiling", "beat", "to herself", "to himself", "O.S.", "V.O."];
    for (const p of parenSuggestions) {
      if (startsWithQuery(p, query)) {
        out.push({
          label: `(${p})`,
          insert: padColumn(`(${p})`, SCREENPLAY_COL.parenthetical),
          element: "parenthetical",
        });
      }
    }
  }

  if (element === "centered") {
    for (const label of ["THE END", "THREE YEARS LATER", "INTERMISSION", "MONTAGE", "SERIES OF SHOTS"]) {
      if (startsWithQuery(label, query) || includesQuery(label, query)) {
        out.push({ label, insert: label, element: "centered" });
      }
    }
  }

  return out.slice(0, limit);
}
