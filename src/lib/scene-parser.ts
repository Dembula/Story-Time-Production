/**
 * Parse screenplay text for scene headings (INT./EXT.).
 * Returns ordered list with synthetic scene numbers when not explicitly numbered in sluglines.
 */
export function parseScenesFromScreenplay(content: string): { number: string; heading: string }[] {
  const lines = content.split(/\r?\n/);
  const scenes: { number: string; heading: string }[] = [];
  let sceneNumber = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E)/i.test(trimmed)) {
      scenes.push({
        number: `${sceneNumber}`,
        heading: trimmed,
      });
      sceneNumber += 1;
    }
  }
  return scenes;
}
