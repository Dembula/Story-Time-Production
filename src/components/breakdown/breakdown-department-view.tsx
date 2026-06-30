"use client";

import { BREAKDOWN_DEPARTMENTS, CATEGORY_LABELS } from "@/lib/breakdown/departments";
import type { BreakdownCategoryKey, BreakdownDepartmentId } from "@/lib/breakdown/types";

export function BreakdownDepartmentView({
  departmentCounts,
  activeDepartment,
  onSelectDepartment,
  highlightCategory,
  onHighlightCategory,
  onViewScreenplay,
}: {
  departmentCounts: Record<BreakdownDepartmentId, number>;
  activeDepartment: BreakdownDepartmentId | null;
  onSelectDepartment: (id: BreakdownDepartmentId | null) => void;
  highlightCategory: BreakdownCategoryKey | null;
  onHighlightCategory: (cat: BreakdownCategoryKey | null) => void;
  onViewScreenplay?: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Colour-coded departments — click to filter the production catalog and editor focus. Mapped to Story Time&apos;s
        nine breakdown categories plus extended production departments.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectDepartment(null);
            onHighlightCategory(null);
          }}
          className={`rounded-full px-3 py-1.5 text-[11px] border ${
            !activeDepartment && !highlightCategory
              ? "border-white/30 bg-white/10 text-white"
              : "border-slate-700 text-slate-400 hover:bg-slate-800"
          }`}
        >
          All departments
        </button>
        {BREAKDOWN_DEPARTMENTS.map((d) => {
          const count = departmentCounts[d.id] ?? 0;
          const active = activeDepartment === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                onSelectDepartment(active ? null : d.id);
                const cat = d.categories[0] ?? null;
                onHighlightCategory(active ? null : cat);
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] border transition ${
                active ? "ring-2 ring-white/20 text-white" : "border-transparent hover:opacity-90"
              }`}
              style={{
                backgroundColor: active ? d.color : `${d.color}33`,
                color: active ? d.textColor : d.textColor,
              }}
            >
              {d.label}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] uppercase text-slate-500">Category highlight (screenplay tags)</p>
          {onViewScreenplay && highlightCategory ? (
            <button
              type="button"
              onClick={onViewScreenplay}
              className="text-[10px] font-medium text-orange-300 hover:text-orange-200"
            >
              View in screenplay →
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as BreakdownCategoryKey[]).map((cat) => {
            const dept = BREAKDOWN_DEPARTMENTS.find((d) => d.categories.includes(cat));
            const active = highlightCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onHighlightCategory(active ? null : cat)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium border ${
                  active ? "text-white" : "text-slate-400 border-slate-700 hover:border-slate-600"
                }`}
                style={
                  active && dept
                    ? { backgroundColor: dept.color, borderColor: dept.color }
                    : undefined
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
