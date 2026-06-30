import type { BreakdownCategoryKey } from "@/lib/breakdown/types";
import { CATEGORY_TO_DEPARTMENT, departmentForCategory } from "@/lib/breakdown/departments";

export type ScreenplayLineRange = {
  lineIndex: number;
  text: string;
  sceneNumber: string | null;
  sceneId: string | null;
  categories: BreakdownCategoryKey[];
};

export type SceneLineSpan = {
  sceneNumber: string;
  sceneId: string | null;
  startLine: number;
  endLine: number;
  heading: string;
};

/** Map slugline order to project scene ids by scene number string. */
export function buildSceneNumberToIdMap(
  scenes: Array<{ id: string; number: string }>,
): Map<string, string> {
  return new Map(scenes.map((s) => [s.number.trim(), s.id]));
}

export function parseScreenplayLineSpans(content: string): Omit<SceneLineSpan, "sceneId">[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const spans: Omit<SceneLineSpan, "sceneId">[] = [];
  let current: Omit<SceneLineSpan, "sceneId"> | null = null;
  let sceneNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E)/i.test(trimmed)) {
      if (current) {
        current.endLine = i - 1;
        spans.push(current);
      }
      sceneNum += 1;
      current = {
        sceneNumber: String(sceneNum),
        startLine: i,
        endLine: lines.length - 1,
        heading: trimmed,
      };
    }
  }
  if (current) spans.push(current);
  return spans;
}

export function buildSceneCategoryMap(
  items: Array<{ sceneId: string | null; category: BreakdownCategoryKey }>,
): Map<string, Set<BreakdownCategoryKey>> {
  const map = new Map<string, Set<BreakdownCategoryKey>>();
  for (const item of items) {
    if (!item.sceneId) continue;
    if (!map.has(item.sceneId)) map.set(item.sceneId, new Set());
    map.get(item.sceneId)!.add(item.category);
  }
  return map;
}

export function buildHighlightedScreenplayLines(input: {
  content: string;
  scenes: Array<{ id: string; number: string }>;
  categoryBySceneId: Map<string, Set<BreakdownCategoryKey>>;
  highlightCategory: BreakdownCategoryKey | null;
  focusSceneId: string | null;
}): ScreenplayLineRange[] {
  const numberToId = buildSceneNumberToIdMap(input.scenes);
  const spans = parseScreenplayLineSpans(input.content).map((span) => ({
    ...span,
    sceneId: numberToId.get(span.sceneNumber) ?? null,
  }));

  const lines = input.content.replace(/\r\n/g, "\n").split("\n");
  const lineScene = new Array<string | null>(lines.length).fill(null);
  const lineSceneNumber = new Array<string | null>(lines.length).fill(null);

  for (const span of spans) {
    for (let i = span.startLine; i <= span.endLine && i < lines.length; i++) {
      lineScene[i] = span.sceneId;
      lineSceneNumber[i] = span.sceneNumber;
    }
  }

  return lines.map((text, lineIndex) => {
    const sceneId = lineScene[lineIndex];
    const cats = sceneId ? [...(input.categoryBySceneId.get(sceneId) ?? [])] : [];
    const visible =
      !input.highlightCategory ||
      (sceneId != null && cats.includes(input.highlightCategory)) ||
      (input.focusSceneId && sceneId === input.focusSceneId);

    return {
      lineIndex,
      text,
      sceneNumber: lineSceneNumber[lineIndex],
      sceneId,
      categories: visible ? cats : [],
    };
  });
}

export type LineHighlightStyle = {
  borderLeft?: string;
  backgroundColor?: string;
  paddingLeft?: number;
};

export function getLineHighlightStyle(
  categories: BreakdownCategoryKey[],
  highlightCategory: BreakdownCategoryKey | null,
): LineHighlightStyle | undefined {
  if (categories.length === 0) return undefined;
  const cat = highlightCategory ?? categories[0];
  if (!cat) return undefined;
  const dept = departmentForCategory(cat);
  return {
    borderLeft: `3px solid ${dept.color}`,
    backgroundColor: `${dept.color}18`,
    paddingLeft: 6,
  };
}

export function categoryLabelsForLine(categories: BreakdownCategoryKey[]): string {
  return categories.map((c) => CATEGORY_TO_DEPARTMENT[c]).join(", ");
}
