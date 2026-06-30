"use client";

import { useMemo } from "react";
import {
  buildHighlightedScreenplayLines,
  buildSceneCategoryMap,
  getLineHighlightStyle,
  categoryLabelsForLine,
} from "@/lib/breakdown/script-highlight";
import { BREAKDOWN_DEPARTMENTS } from "@/lib/breakdown/departments";
import type { BreakdownCategoryKey, BreakdownPayload } from "@/lib/breakdown/types";

export function BreakdownScreenplayViewer({
  content,
  scenes,
  draft,
  highlightCategory,
  focusSceneId,
}: {
  content: string;
  scenes: Array<{ id: string; number: string }>;
  draft: BreakdownPayload;
  highlightCategory: BreakdownCategoryKey | null;
  focusSceneId: string | null;
}) {
  const categoryBySceneId = useMemo(() => {
    const items: Array<{ sceneId: string | null; category: BreakdownCategoryKey }> = [
      ...(draft.characters ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "characters" as const })),
      ...(draft.props ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "props" as const })),
      ...(draft.locations ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "locations" as const })),
      ...(draft.wardrobe ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "wardrobe" as const })),
      ...(draft.extras ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "extras" as const })),
      ...(draft.vehicles ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "vehicles" as const })),
      ...(draft.stunts ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "stunts" as const })),
      ...(draft.sfx ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "sfx" as const })),
      ...(draft.makeups ?? []).map((r) => ({ sceneId: r.sceneId ?? null, category: "makeups" as const })),
    ];
    return buildSceneCategoryMap(items);
  }, [draft]);

  const lines = useMemo(
    () =>
      buildHighlightedScreenplayLines({
        content,
        scenes,
        categoryBySceneId,
        highlightCategory,
        focusSceneId,
      }),
    [content, scenes, categoryBySceneId, highlightCategory, focusSceneId],
  );

  if (!content.trim()) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        No screenplay content yet. Write or sync your script in Script Writing to enable department highlighting.
      </p>
    );
  }

  const activeDept = highlightCategory
    ? BREAKDOWN_DEPARTMENTS.find((d) => d.categories.includes(highlightCategory))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {activeDept ? (
          <span
            className="rounded-full px-2.5 py-1 font-medium"
            style={{ backgroundColor: `${activeDept.color}33`, color: activeDept.textColor }}
          >
            Highlighting: {activeDept.label}
          </span>
        ) : (
          <span>All department tags visible on scenes with breakdown elements</span>
        )}
        {focusSceneId ? (
          <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-200">Focused scene</span>
        ) : null}
      </div>

      <div className="max-h-[640px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-[11px] leading-relaxed">
        {lines.map((line) => {
          const style = getLineHighlightStyle(line.categories, highlightCategory);
          const isSlug = /^(INT\.|EXT\.|INT\.\/EXT\.|EXT\.\/INT\.|I\/E)/i.test(line.text.trim());
          return (
            <div
              key={line.lineIndex}
              className={`flex gap-3 py-0.5 ${isSlug ? "font-semibold text-orange-200/90" : "text-slate-300"}`}
              style={style}
              title={line.categories.length > 0 ? categoryLabelsForLine(line.categories) : undefined}
            >
              <span className="w-8 shrink-0 select-none text-right text-slate-600">{line.lineIndex + 1}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
              {line.sceneNumber && line.categories.length > 0 ? (
                <span className="hidden shrink-0 text-[9px] text-slate-500 sm:inline">Sc.{line.sceneNumber}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
