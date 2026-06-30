import type { ParsedCharacter, ParsedScene, ScreenplayStats } from "./types";

const SCENE_HEADING =
  /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E\.|EST\.)/i;

const CHARACTER_LINE = /^[A-Z][A-Z0-9 .'\-()]{1,38}$/;

export function parseScenes(content: string): ParsedScene[] {
  const lines = content.split(/\r?\n/);
  const scenes: ParsedScene[] = [];
  let n = 1;
  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (SCENE_HEADING.test(trimmed)) {
      scenes.push({
        id: `scene-${n}`,
        number: n,
        heading: trimmed,
        lineIndex,
      });
      n += 1;
    }
  });
  return scenes;
}

export function parseCharacters(content: string, scenes: ParsedScene[]): ParsedCharacter[] {
  const lines = content.split(/\r?\n/);
  const map = new Map<string, ParsedCharacter>();
  let currentScene = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? "";
    if (SCENE_HEADING.test(trimmed)) currentScene += 1;

    const name = trimmed.replace(/\s*\((V\.O\.|O\.S\.|CONT'D)\)\s*$/i, "").trim();
    if (!name || !CHARACTER_LINE.test(name)) continue;
    if (SCENE_HEADING.test(name)) continue;
    if (/^(FADE|CUT|DISSOLVE|MONTAGE|INTERCUT)/i.test(name)) continue;

    const next = lines[i + 1]?.trim() ?? "";
    const isCharacterCue =
      next.length > 0 &&
      !SCENE_HEADING.test(next) &&
      (!CHARACTER_LINE.test(next) || next.startsWith("("));

    if (!isCharacterCue && !next.match(/^[A-Za-z]/)) continue;

    const existing = map.get(name) ?? {
      name,
      dialogueLines: 0,
      firstScene: currentScene || 1,
      lastScene: currentScene || 1,
    };
    existing.dialogueLines += 1;
    existing.lastScene = currentScene || existing.lastScene;
    map.set(name, existing);
  }

  return [...map.values()].sort((a, b) => b.dialogueLines - a.dialogueLines);
}

/** ~55 lines per screenplay page (industry rule of thumb). */
export function computeStats(content: string): ScreenplayStats {
  const words = content
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
  const lines = content.split(/\r?\n/).length;
  const scenes = parseScenes(content);
  const characters = parseCharacters(content, scenes).length;
  const pages = Math.max(1, Math.round(lines / 55));
  const estimatedRuntimeMinutes = Math.max(1, Math.round(pages));
  const readingMinutes = Math.max(1, Math.round(words / 200));

  return {
    words,
    scenes: scenes.length,
    pages,
    characters,
    estimatedRuntimeMinutes,
    readingMinutes,
  };
}

export function jumpToLine(content: string, lineIndex: number): number {
  const lines = content.split(/\r?\n/);
  let pos = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    pos += (lines[i]?.length ?? 0) + 1;
  }
  return pos;
}
