"use client";

import { BREAKDOWN_DEPARTMENTS } from "@/lib/breakdown/departments";
import type { ScriptRevisionImpact } from "@/lib/breakdown/script-revision-impact";

function diffKindClass(kind: string) {
  if (kind === "added") return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
  if (kind === "removed") return "border-red-500/30 bg-red-500/5 text-red-300 line-through";
  if (kind === "changed") return "border-amber-500/30 bg-amber-500/5 text-amber-100";
  return "border-slate-700 bg-slate-950/50 text-slate-400";
}

export function BreakdownRevisionPanel({
  impact,
  loading,
}: {
  impact: ScriptRevisionImpact | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
        Loading revision impact…
      </div>
    );
  }

  if (!impact) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        Save at least two script versions in Script Writing to compare revisions and notify departments.
      </p>
    );
  }

  const { summary } = impact;
  const hasChanges = summary.added > 0 || summary.removed > 0 || summary.changed > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase text-slate-500">Lines added</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{summary.added}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase text-slate-500">Lines removed</p>
          <p className="mt-1 text-2xl font-semibold text-red-300">{summary.removed}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase text-slate-500">Lines changed</p>
          <p className="mt-1 text-2xl font-semibold text-amber-200">{summary.changed}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-[10px] uppercase text-slate-500">Departments</p>
          <p className="mt-1 text-2xl font-semibold text-white">{impact.affectedDepartments.length}</p>
        </div>
      </div>

      {!hasChanges ? (
        <p className="text-xs text-slate-500">Latest two script versions are identical — no department alerts needed.</p>
      ) : null}

      {impact.scenesAdded.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase text-slate-500 mb-2">Scenes added</p>
          <ul className="space-y-1 text-xs text-slate-300">
            {impact.scenesAdded.slice(0, 12).map((h) => (
              <li key={h} className="truncate font-mono">
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {impact.scenesRemoved.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase text-slate-500 mb-2">Scenes removed</p>
          <ul className="space-y-1 text-xs text-slate-300">
            {impact.scenesRemoved.slice(0, 12).map((h) => (
              <li key={h} className="truncate font-mono text-red-300/80">
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {impact.departmentNotes.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <p className="text-[10px] uppercase text-slate-500">Department notifications</p>
          {impact.departmentNotes.map((note) => {
            const dept = BREAKDOWN_DEPARTMENTS.find((d) => d.id === note.departmentId);
            return (
              <div
                key={note.departmentId}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs"
                style={dept ? { borderLeftColor: dept.color, borderLeftWidth: 3 } : undefined}
              >
                <p className="font-medium text-slate-200">{dept?.label ?? note.departmentId}</p>
                <p className="mt-0.5 text-slate-400">{note.message}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {impact.diffPreview.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-[10px] uppercase text-slate-500 mb-2">Diff preview</p>
          <div className="max-h-80 space-y-1 overflow-y-auto font-mono text-[10px]">
            {impact.diffPreview.map((row, i) => (
              <div key={`${row.lineNumber}-${i}`} className={`rounded border px-2 py-1 ${diffKindClass(row.kind)}`}>
                <span className="text-slate-500">L{row.lineNumber}</span>{" "}
                {row.kind === "changed" ? (
                  <>
                    <span className="opacity-70">{row.textA}</span>
                    <span className="mx-1 text-slate-500">→</span>
                    <span>{row.textB}</span>
                  </>
                ) : (
                  <span>{row.textB ?? row.textA}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
