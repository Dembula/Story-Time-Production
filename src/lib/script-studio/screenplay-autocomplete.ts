import {
  CAMERA_SHOTS,
  CHARACTER_EXTENSIONS,
  SCENE_HEADING_PREFIXES,
  TIME_OF_DAY,
  TRANSITIONS,
  isSceneHeadingPrefixQuery,
} from "./elements";
import type { ScreenplayElementType } from "./types";
import { detectLineElement, padColumn } from "./screenplay-keyboard";
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
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const el = detectLineElement(line, {
      prev: i > 0 ? lines[i - 1] : undefined,
      next: i < lines.length - 1 ? lines[i + 1] : undefined,
    });
    if (el !== "character") continue;
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

const SCENE_HEADING_LINE = /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i;
const TRANSITION_PREFIX = /^(CUT|FADE|DISSOLVE|SMASH|MATCH|WIPE|JUMP|IRIS|CROSS)/i;
const SHOT_TYPED =
  /^(CLOSE|EXTREME|WIDE|MEDIUM|INSERT|POV|OVERHEAD|TRACKING|AERIAL|HANDHELD|STEADICAM|CRANE|DRONE|OVER)/i;

/**
 * Suggestions for the current line based on element type and typed prefix.
 * Context-aware: only offer lists that match where the writer currently is.
 */
export function getScreenplaySuggestions(options: {
  content: string;
  line: string;
  element: ScreenplayElementType;
  limit?: number;
  prevLine?: string;
}): ScreenplaySuggestion[] {
  const { content, line, element, limit = 8 } = options;
  const trimmed = line.trim();
  const query = trimmed.replace(/^\(+|\)+$/g, "").trim();
  const out: ScreenplaySuggestion[] = [];
  const prefixQuery = trimmed.replace(/\s+.*$/, "");
  const rawEndsWithSpace = /\s$/.test(line);

  // Empty action = natural place to start a new slugline (Final Draft–style).
  // Active scene_heading only while the token still looks like INT/EXT…
  const wantsSceneHeading =
    (element === "action" && !trimmed) ||
    (element === "scene_heading" &&
      (!trimmed || isSceneHeadingPrefixQuery(prefixQuery) || SCENE_HEADING_LINE.test(trimmed)));

  if (wantsSceneHeading) {
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
    if (SCENE_HEADING_LINE.test(trimmed)) {
      const afterPrefix = trimmed.replace(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)\s*/i, "");
      const locPart = afterPrefix.split(/\s*-\s*/)[0] ?? "";
      for (const loc of collectLocations(content)) {
        if (locPart && includesQuery(loc, locPart)) {
          const prefix =
            trimmed.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i)?.[0]?.toUpperCase() ?? "INT.";
          out.push({
            label: `${prefix} ${loc} - DAY`,
            insert: `${prefix} ${loc} - DAY`,
            element: "scene_heading",
          });
        }
      }
      if (afterPrefix.includes("-") || (rawEndsWithSpace && locPart.length >= 2)) {
        const todQuery = (afterPrefix.split(/\s*-\s*/)[1] ?? "").trim();
        for (const tod of TIME_OF_DAY) {
          if (!todQuery || startsWithQuery(tod, todQuery)) {
            const prefix =
              trimmed.match(/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)/i)?.[0]?.toUpperCase() ?? "INT.";
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

  if (element === "character") {
    const known = collectCharacterNames(content);
    for (const name of known) {
      if (!query || startsWithQuery(name, query)) {
        out.push({
          label: name,
          insert: padColumn(name, SCREENPLAY_COL.character),
          element: "character",
        });
      }
    }
    // Extensions only once the name looks finished (space after name, or typed "(").
    if (trimmed && !trimmed.includes("(") && (rawEndsWithSpace || known.some((n) => n === query.toUpperCase()))) {
      const base = trimmed.toUpperCase();
      for (const ext of CHARACTER_EXTENSIONS) {
        out.push({
          label: `${base} ${ext}`,
          insert: padColumn(`${base} ${ext}`, SCREENPLAY_COL.character),
          element: "character",
        });
      }
    } else if (trimmed.includes("(")) {
      const namePart = trimmed.replace(/\s*\(.*$/, "").trim().toUpperCase() || query.toUpperCase();
      const extQuery = (trimmed.split("(")[1] ?? "").replace(/\).*$/, "");
      for (const ext of CHARACTER_EXTENSIONS) {
        const bare = ext.replace(/[()]/g, "");
        if (!extQuery || startsWithQuery(bare, extQuery) || startsWithQuery(ext, `(${extQuery}`)) {
          out.push({
            label: `${namePart} ${ext}`,
            insert: padColumn(`${namePart} ${ext}`, SCREENPLAY_COL.character),
            element: "character",
          });
        }
      }
    }
  }

  // Transitions: require typed prefix so empty transition lines don't dump the full menu.
  if (element === "transition" && trimmed && TRANSITION_PREFIX.test(trimmed)) {
    for (const t of TRANSITIONS) {
      if (includesQuery(t, query) || startsWithQuery(t, query)) {
        out.push({ label: t, insert: t, element: "transition" });
      }
    }
  }

  const shotQueryActive =
    element === "shot" || (element === "action" && trimmed.length >= 3 && SHOT_TYPED.test(trimmed));
  if (shotQueryActive) {
    for (const shot of CAMERA_SHOTS) {
      if (startsWithQuery(shot, query) || (query.length >= 3 && includesQuery(shot, query))) {
        out.push({ label: shot, insert: shot, element: "shot" });
      }
    }
  }

  // Parentheticals: require at least one letter so Enter on empty () advances to dialogue.
  if ((element === "parenthetical" || trimmed.startsWith("(")) && query.length >= 1) {
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

  if (element === "centered" && query.length >= 1) {
    for (const label of ["THE END", "THREE YEARS LATER", "INTERMISSION", "MONTAGE", "SERIES OF SHOTS"]) {
      if (startsWithQuery(label, query) || includesQuery(label, query)) {
        out.push({ label, insert: label, element: "centered" });
      }
    }
  }

  return out.slice(0, limit);
}

/** True when Enter/Tab should accept a suggestion instead of advancing the screenplay. */
export function shouldAcceptSuggestionOnCommit(options: {
  line: string;
  element: ScreenplayElementType;
  suggestionCount: number;
  navigated: boolean;
  activeInsert?: string;
}): boolean {
  const { line, suggestionCount, navigated, activeInsert } = options;
  if (suggestionCount <= 0) return false;
  if (navigated) return true;
  const trimmed = line.trim();
  const query = trimmed.replace(/^\(+|\)+$/g, "").trim();
  // Empty menus (INT/EXT on blank action, empty ()) must never steal Enter.
  if (!query) return false;
  // Already-complete slugline — Enter should move to Action, not re-apply DAY.
  if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|EST\.|I\/E\.)\s+.+\s+-\s+\S+/i.test(trimmed)) {
    return false;
  }
  // Accepting would not change the line — let Enter/Tab advance structure instead.
  if (activeInsert && activeInsert.trim() === trimmed) return false;
  return true;
}
