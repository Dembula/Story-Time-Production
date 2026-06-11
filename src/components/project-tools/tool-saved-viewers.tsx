"use client";

import { formatZar } from "@/lib/format-currency-zar";

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}

function ScrollPreview({ children, maxHeight = "min(60vh, 480px)" }: { children: React.ReactNode; maxHeight?: string }) {
  return (
    <div
      className="overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap"
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}

// --- Ideas ---

export type IdeaViewItem = {
  id: string;
  title: string;
  logline: string | null;
  notes: string | null;
  genres: string | null;
  updatedAt: string;
};

export function IdeasSavedViewer({
  ideas,
  selectedId,
  onSelect,
}: {
  ideas: IdeaViewItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (ideas.length === 0) return <EmptyState message="No saved ideas yet." />;
  const active = ideas.find((i) => i.id === selectedId) ?? ideas[0];
  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <button
              type="button"
              onClick={() => onSelect?.(idea.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                idea.id === active.id ? "bg-orange-500/10 ring-1 ring-orange-500/25 text-white" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="font-medium block truncate">{idea.title}</span>
              <span className="text-[10px] text-slate-500">{new Date(idea.updatedAt).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        {active.logline ? (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Logline</p>
            <p className="text-sm text-slate-200">{active.logline}</p>
          </div>
        ) : null}
        {active.genres ? (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Genres</p>
            <p className="text-sm text-slate-300">{active.genres}</p>
          </div>
        ) : null}
        {active.notes ? (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Notes</p>
            <ScrollPreview>{active.notes}</ScrollPreview>
          </div>
        ) : !active.logline ? (
          <EmptyState message="This idea has no content yet." />
        ) : null}
      </div>
    </div>
  );
}

// --- Scripts ---

export type ScriptViewItem = {
  id: string;
  title: string;
  type?: string;
  content: string;
  updatedAt?: string;
};

export function ScriptsSavedViewer({
  scripts,
  selectedId,
  onSelect,
}: {
  scripts: ScriptViewItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (scripts.length === 0) return <EmptyState message="No saved scripts in your library." />;
  const active = scripts.find((s) => s.id === selectedId) ?? scripts[0];
  const words = active.content.split(/\s+/).filter(Boolean).length;
  const scenes = active.content.split(/\n/).filter((l) => /^(INT\.|EXT\.)/.test(l.trim())).length;
  return (
    <div className="space-y-4">
      <ul className="space-y-1 max-h-40 overflow-y-auto">
        {scripts.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect?.(s.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                s.id === active.id ? "bg-orange-500/10 ring-1 ring-orange-500/25 text-white" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <span className="font-medium block truncate">{s.title}</span>
              {s.updatedAt ? (
                <span className="text-[10px] text-slate-500">{new Date(s.updatedAt).toLocaleString()}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
        <span>{words} words</span>
        <span>· {scenes} scenes</span>
        {active.type ? <span>· {active.type}</span> : null}
      </div>
      <ScrollPreview>{active.content || "Empty draft."}</ScrollPreview>
    </div>
  );
}

// --- Script reviews ---

export type InternalReviewItem = {
  id: string;
  scriptLabel: string;
  notes: string;
  createdAt: string;
};

export type ExecutiveReviewItem = {
  id: string;
  status: string;
  feeAmount: number;
  submittedAt: string;
  reviewedAt: string | null;
  feedbackNotes: string | null;
  feedbackUrl: string | null;
  scriptTitle?: string;
  versionLabel?: string | null;
};

export function ScriptReviewsViewer({
  scriptLabel,
  scriptContent,
  internalReviews,
  executiveReviews,
}: {
  scriptLabel?: string;
  scriptContent?: string;
  internalReviews: InternalReviewItem[];
  executiveReviews: ExecutiveReviewItem[];
}) {
  return (
    <div className="space-y-6">
      {scriptContent != null ? (
        <section>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Script draft</p>
          {scriptLabel ? <p className="text-xs text-slate-400 mb-2">{scriptLabel}</p> : null}
          <ScrollPreview>{scriptContent || "Empty draft."}</ScrollPreview>
        </section>
      ) : null}

      <section>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Internal reviews</p>
        {internalReviews.length === 0 ? (
          <p className="text-xs text-slate-500">No internal reviews recorded.</p>
        ) : (
          <ul className="space-y-2">
            {internalReviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-xs font-medium text-slate-200">{r.scriptLabel}</p>
                <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap line-clamp-6">{r.notes}</p>
                <p className="mt-2 text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Executive / admin reviews</p>
        {executiveReviews.length === 0 ? (
          <p className="text-xs text-slate-500">No executive submissions yet.</p>
        ) : (
          <ul className="space-y-2">
            {executiveReviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                <p className="text-xs font-medium text-slate-200">
                  {(r.scriptTitle ?? "Script") + (r.versionLabel ? ` · ${r.versionLabel}` : "")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatZar(r.feeAmount)} · {r.status.replace(/_/g, " ")}
                </p>
                {r.feedbackNotes ? (
                  <p className="mt-2 text-xs text-slate-300 whitespace-pre-wrap">{r.feedbackNotes}</p>
                ) : null}
                {r.feedbackUrl ? (
                  <a
                    href={r.feedbackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-orange-300 underline hover:text-orange-200"
                  >
                    Open feedback file
                  </a>
                ) : null}
                <p className="mt-2 text-[10px] text-slate-500">
                  Submitted {new Date(r.submittedAt).toLocaleString()}
                  {r.reviewedAt ? ` · Reviewed ${new Date(r.reviewedAt).toLocaleString()}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// --- Budget ---

export type BudgetLineView = {
  department: string;
  name: string;
  quantity: number | null;
  unitCost: number | null;
  total: number | null;
};

export function BudgetSavedViewer({
  template,
  totalPlanned,
  lines,
  byDepartment,
}: {
  template?: string;
  totalPlanned?: number;
  lines: BudgetLineView[];
  byDepartment?: Array<{ department: string; estimated: number }>;
}) {
  if (lines.length === 0 && !byDepartment?.length) {
    return <EmptyState message="No budget lines saved yet. Create a budget or generate from breakdown." />;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {template ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Template</p>
            <p className="text-sm font-medium text-white mt-0.5">{template.replace(/_/g, " ")}</p>
          </div>
        ) : null}
        {totalPlanned != null ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-[10px] uppercase text-slate-500">Planned total</p>
            <p className="text-sm font-medium text-emerald-200 mt-0.5">{formatZar(totalPlanned)}</p>
          </div>
        ) : null}
      </div>
      {byDepartment && byDepartment.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">By department</p>
          <div className="space-y-1">
            {byDepartment.map((d) => (
              <div key={d.department} className="flex justify-between text-xs py-1 border-b border-slate-800/60">
                <span className="text-slate-300">{d.department.replace(/_/g, " ")}</span>
                <span className="text-slate-200 tabular-nums">{formatZar(d.estimated)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {lines.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Line items ({lines.length})</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-500 text-left">
                  <th className="px-2 py-2 font-medium">Dept</th>
                  <th className="px-2 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.slice(0, 80).map((line, i) => (
                  <tr key={`${line.name}-${i}`} className="border-b border-slate-800/40">
                    <td className="px-2 py-1.5 text-slate-400">{line.department}</td>
                    <td className="px-2 py-1.5 text-slate-200 truncate max-w-[180px]">{line.name}</td>
                    <td className="px-2 py-1.5 text-right text-slate-200 tabular-nums">
                      {formatZar(line.total ?? (line.quantity ?? 1) * (line.unitCost ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length > 80 ? (
              <p className="px-2 py-2 text-[10px] text-slate-500">+ {lines.length - 80} more lines</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Schedule ---

export type ScheduleDayView = {
  id: string;
  date: string;
  unit?: string | null;
  callTime?: string | null;
  wrapTime?: string | null;
  locationSummary?: string | null;
  status?: string;
  scenes?: Array<{ scene?: { number: string; heading: string | null } | null }>;
};

export function ScheduleSavedViewer({ days }: { days: ScheduleDayView[] }) {
  if (days.length === 0) return <EmptyState message="No shoot days on the schedule yet." />;
  return (
    <ul className="space-y-3">
      {days.map((day) => (
        <li key={day.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">
              {new Date(day.date).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {day.status ? (
              <span className="text-[10px] uppercase tracking-wide text-slate-500">{day.status}</span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
            {day.callTime ? <span>Call {day.callTime}</span> : null}
            {day.wrapTime ? <span>Wrap {day.wrapTime}</span> : null}
            {day.unit ? <span>Unit {day.unit}</span> : null}
          </div>
          {day.locationSummary ? (
            <p className="mt-1 text-xs text-slate-300">{day.locationSummary}</p>
          ) : null}
          {day.scenes && day.scenes.length > 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">
              Scenes:{" "}
              {day.scenes
                .map((s) => {
                  const sc = s.scene;
                  return sc ? `${sc.number}${sc.heading ? ` ${sc.heading}` : ""}` : null;
                })
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// --- Breakdown ---

export type BreakdownSummary = {
  characters: number;
  props: number;
  locations: number;
  wardrobe: number;
  extras: number;
  vehicles: number;
  stunts: number;
  sfx: number;
  makeups: number;
  scenes: number;
};

export function BreakdownSavedViewer({
  summary,
  scenes,
}: {
  summary: BreakdownSummary;
  scenes: Array<{ number: string; heading: string | null; summary: string | null }>;
}) {
  const total =
    summary.characters +
    summary.props +
    summary.locations +
    summary.wardrobe +
    summary.extras +
    summary.vehicles +
    summary.stunts +
    summary.sfx +
    summary.makeups;
  if (total === 0 && summary.scenes === 0) {
    return <EmptyState message="No breakdown data saved yet." />;
  }
  const chips = [
    ["Characters", summary.characters],
    ["Props", summary.props],
    ["Locations", summary.locations],
    ["Wardrobe", summary.wardrobe],
    ["Extras", summary.extras],
    ["Vehicles", summary.vehicles],
    ["Stunts", summary.stunts],
    ["SFX", summary.sfx],
    ["Makeup", summary.makeups],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map(([label, count]) =>
          count > 0 ? (
            <span
              key={label}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200"
            >
              {label} <span className="text-orange-300 font-medium">{count}</span>
            </span>
          ) : null,
        )}
        {summary.scenes > 0 ? (
          <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200">
            Scenes <span className="text-orange-300 font-medium">{summary.scenes}</span>
          </span>
        ) : null}
      </div>
      {scenes.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Scene list</p>
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto">
            {scenes.map((s) => (
              <li key={s.number} className="rounded-lg border border-slate-800/60 px-3 py-2 text-xs">
                <span className="font-medium text-slate-200">Scene {s.number}</span>
                {s.heading ? <span className="text-slate-400 ml-1">{s.heading}</span> : null}
                {s.summary ? <p className="mt-1 text-slate-500 line-clamp-2">{s.summary}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// --- Call sheets ---

export type CallSheetViewItem = {
  id: string;
  title: string | null;
  version?: number;
  createdAt: string;
  shootDayDate?: string;
  notes?: string | null;
};

export function CallSheetsSavedViewer({
  sheets,
  onOpen,
}: {
  sheets: CallSheetViewItem[];
  onOpen?: (id: string) => void;
}) {
  if (sheets.length === 0) return <EmptyState message="No saved call sheet snapshots yet." />;
  return (
    <ul className="space-y-2">
      {sheets.map((s) => (
        <li key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {s.title ?? "Call sheet"}
                {s.version != null ? ` · v${s.version}` : ""}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {s.shootDayDate
                  ? new Date(s.shootDayDate).toLocaleDateString()
                  : new Date(s.createdAt).toLocaleString()}
              </p>
            </div>
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="shrink-0 text-xs text-orange-300 hover:text-orange-200"
              >
                Open
              </button>
            ) : null}
          </div>
          {s.notes ? <p className="mt-2 text-xs text-slate-400 line-clamp-3">{s.notes}</p> : null}
        </li>
      ))}
    </ul>
  );
}

// --- Table reads ---

export type TableReadSessionView = {
  id: string;
  name: string | null;
  scheduledAt: string | null;
  notesLog: string | null;
  participantCount: number;
};

export function TableReadsSavedViewer({ sessions }: { sessions: TableReadSessionView[] }) {
  if (sessions.length === 0) return <EmptyState message="No table read sessions saved yet." />;
  return (
    <ul className="space-y-3">
      {sessions.map((s) => (
        <li key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
          <p className="text-sm font-medium text-white">{s.name ?? "Table read session"}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "Not scheduled"}
            {s.participantCount > 0 ? ` · ${s.participantCount} participants` : ""}
          </p>
          {s.notesLog ? (
            <ScrollPreview maxHeight="200px">{s.notesLog.slice(0, 2000)}</ScrollPreview>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
