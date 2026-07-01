"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DailiesClipRecord,
  DailiesDepartmentId,
  DailiesIntelligencePayload,
  DailiesNoteRecord,
  DailiesTakeFlag,
  DailiesTakeStatus,
} from "@/lib/dailies/types";
import {
  DAILIES_DEPARTMENTS,
  TAKE_FLAG_LABELS,
  TAKE_STATUS_LABELS,
} from "@/lib/dailies/departments";
import { buildDailyReport } from "@/lib/dailies/ai-footage-analysis";
import type { DailiesHealthPayload } from "@/lib/dailies/dailies-health";
import { DailiesMediaViewer } from "@/components/dailies/dailies-media-viewer";
import type { DailiesPlaybackHandle } from "@/components/dailies/dailies-video-player";
import {
  DAILIES_UPLOAD_ACCEPT,
  dailiesMediaTypeLabel,
  inferDailiesMediaTypeFromFile,
  isDailiesStillMedia,
  resolveDailiesMediaType,
} from "@/lib/dailies/media";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {sub ? <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function statusColor(status: string) {
  if (status === "ready") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (status === "partial") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-slate-800 text-slate-400 ring-slate-700";
}

export function DailiesCommandCenter({
  intelligence,
  projectId,
}: {
  intelligence: DailiesIntelligencePayload;
  projectId?: string;
}) {
  const { summary, activeShootDay, insights, linkedTools } = intelligence;
  const exportHref = (format: string, report = "summary") =>
    projectId ? `/api/creator/projects/${projectId}/dailies/export?format=${format}&report=${report}` : null;

  return (
    <div className="space-y-6">
      {projectId ? (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[10px] uppercase text-slate-500">Export</span>
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
            <a
              key={fmt}
              href={exportHref(fmt) ?? "#"}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-orange-500/40"
            >
              {fmt === "xlsx" ? "Excel" : fmt.toUpperCase()}
            </a>
          ))}
        </div>
      ) : null}

      {activeShootDay ? (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-[10px] uppercase text-orange-300/80">Today&apos;s shooting day</p>
          <p className="text-lg font-semibold text-white">
            {new Date(activeShootDay.date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
            {activeShootDay.unit ? ` · Unit ${activeShootDay.unit}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {activeShootDay.clipCount} clips · {activeShootDay.reviewCompletionPercent}% reviewed ·{" "}
            {activeShootDay.openNotes} open notes
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Total clips" value={summary.totalClips} />
        <StatCard label="Takes" value={summary.totalTakes} />
        <StatCard label="Scenes covered" value={summary.completedScenes} />
        <StatCard label="Pending reviews" value={summary.pendingReviews} />
        <StatCard label="Circle takes" value={summary.circleTakes} />
        <StatCard label="Approved" value={summary.approvedTakes} />
        <StatCard label="Rejected" value={summary.rejectedTakes} />
        <StatCard label="Processing" value={summary.footageProcessing} />
        <StatCard label="Proxy ready" value={summary.proxyReady} />
        <StatCard label="Open notes" value={summary.openNotes} />
        <StatCard label="Critical issues" value={summary.criticalIssues} />
        <StatCard label="Review done" value={`${summary.reviewCompletionPercent}%`} />
        <StatCard label="Coverage" value={`${summary.coveragePercent}%`} />
        <StatCard label="AI quality" value={summary.aiQualityScore} sub="0–100" />
        <StatCard label="Shoot health" value={summary.productionHealthScore} sub="0–100" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Production intelligence</h3>
          {insights.length === 0 ? (
            <p className="text-xs text-slate-500">Upload dailies to unlock AI production insights.</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
              {insights.map((ins) => (
                <li
                  key={ins.id}
                  className={`rounded-lg border px-3 py-2 ${
                    ins.severity === "warning"
                      ? "border-amber-500/30 bg-amber-500/5"
                      : ins.severity === "opportunity"
                        ? "border-cyan-500/30 bg-cyan-500/5"
                        : "border-slate-700 bg-slate-950/50"
                  }`}
                >
                  <p className="font-medium text-slate-100">{ins.title}</p>
                  <p className="mt-0.5 text-slate-400">{ins.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Connected production tools</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {linkedTools.map((tool) => (
              <Link
                key={tool.label}
                href={tool.href}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 hover:border-orange-500/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-white">{tool.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase ring-1 ${statusColor(tool.status)}`}>
                    {tool.status}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{tool.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DailiesClipBrowser({
  intelligence,
  selectedClipId,
  onSelectClip,
  groupBy,
  onGroupByChange,
  filterShootDayId,
  onFilterShootDayId,
}: {
  intelligence: DailiesIntelligencePayload;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  groupBy: "day" | "scene" | "camera";
  onGroupByChange: (g: "day" | "scene" | "camera") => void;
  filterShootDayId: string | null;
  onFilterShootDayId: (id: string | null) => void;
}) {
  const filtered = useMemo(() => {
    let clips = intelligence.clips;
    if (filterShootDayId) clips = clips.filter((c) => c.shootDayId === filterShootDayId);
    return clips;
  }, [intelligence.clips, filterShootDayId]);

  const groups = useMemo(() => {
    const map = new Map<string, DailiesClipRecord[]>();
    for (const c of filtered) {
      let key = "Unassigned";
      if (groupBy === "day") key = c.shootDayDate ? new Date(c.shootDayDate).toLocaleDateString() : "No shoot day";
      else if (groupBy === "scene") key = c.sceneNumber ? `Scene ${c.sceneNumber}` : "No scene";
      else key = c.camera ?? "Unknown camera";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()];
  }, [filtered, groupBy]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["day", "scene", "camera"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGroupByChange(g)}
            className={`rounded-full px-3 py-1 text-[11px] capitalize ${
              groupBy === g ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            By {g}
          </button>
        ))}
        <select
          value={filterShootDayId ?? ""}
          onChange={(e) => onFilterShootDayId(e.target.value || null)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">All shoot days</option>
          {intelligence.shootDays.map((d) => (
            <option key={d.shootDayId} value={d.shootDayId}>
              {new Date(d.date).toLocaleDateString()} ({d.clipCount} clips)
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
          No dailies uploaded yet. Use Upload to add camera clips or stills.
        </p>
      ) : (
        <div className="max-h-[560px] space-y-4 overflow-y-auto">
          {groups.map(([label, clips]) => (
            <div key={label}>
              <p className="mb-1 text-[10px] uppercase text-slate-500">{label}</p>
              <div className="space-y-1">
                {clips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectClip(c.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      selectedClipId === c.id
                        ? "border-orange-500/50 bg-orange-500/10 text-white"
                        : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className="font-medium">{c.title ?? "Untitled"}</span>
                    <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">
                      {dailiesMediaTypeLabel(c.mediaType)}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-500">
                      {c.shotNumber ? `${c.shotNumber} · ` : ""}
                      Take {c.takeNumber ?? "—"} · {TAKE_STATUS_LABELS[c.takeStatus] ?? c.takeStatus}
                    </span>
                    {c.openNoteCount > 0 ? (
                      <span className="ml-2 text-[10px] text-amber-300">{c.openNoteCount} notes</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TAKE_STATUSES: DailiesTakeStatus[] = [
  "pending",
  "approved",
  "circle",
  "rejected",
  "reshoot",
  "safety",
  "alt",
];

const TAKE_FLAGS: DailiesTakeFlag[] = [
  "circle_take",
  "directors_pick",
  "producers_pick",
  "editors_favourite",
  "vfx_pick",
  "best_performance",
  "reshoot_required",
];

export function DailiesReviewWorkspace({
  clip,
  projectId,
  notes,
  notesLoading,
  onAddNote,
  onUpdateTake,
  scriptExcerpt,
  storyboardHref,
}: {
  clip: DailiesClipRecord | null;
  projectId?: string;
  notes: DailiesNoteRecord[];
  notesLoading?: boolean;
  onAddNote: (payload: {
    body: string;
    timestampMs?: number;
    department?: string;
    priority?: string;
    category?: string;
  }) => void;
  onUpdateTake: (payload: { takeStatus?: DailiesTakeStatus; takeFlags?: DailiesTakeFlag[] }) => void;
  scriptExcerpt?: string | null;
  storyboardHref?: string | null;
}) {
  const playerRef = useRef<DailiesPlaybackHandle>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [noteBody, setNoteBody] = useState("");
  const [department, setDepartment] = useState("director");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");

  if (!clip) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-16 text-center text-sm text-slate-500">
        Select a clip from the browser to open the cinema review workspace.
      </p>
    );
  }

  const isStill = isDailiesStillMedia(resolveDailiesMediaType(clip));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <DailiesMediaViewer
          ref={playerRef}
          clip={clip}
          onTimeUpdate={setCurrentMs}
          className="w-full"
        />

        <div className="flex flex-wrap gap-1.5">
          {TAKE_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdateTake({ takeStatus: s })}
              className={`rounded-full px-2.5 py-1 text-[10px] ${
                clip.takeStatus === s ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400"
              }`}
            >
              {TAKE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TAKE_FLAGS.map((f) => {
            const active = clip.takeFlags.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  const next = active ? clip.takeFlags.filter((x) => x !== f) : [...clip.takeFlags, f];
                  onUpdateTake({ takeFlags: next });
                }}
                className={`rounded-md px-2 py-0.5 text-[10px] border ${
                  active ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200" : "border-slate-700 text-slate-500"
                }`}
              >
                {TAKE_FLAG_LABELS[f]}
              </button>
            );
          })}
        </div>

        {(clip.aiAnalysis?.length ?? 0) > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[10px] uppercase text-slate-500 mb-2">AI footage analysis</p>
            <ul className="space-y-1.5 text-xs">
              {clip.aiAnalysis!.map((a) => (
                <li key={a.id} className="text-slate-300">
                  <span className="text-orange-300">{a.title}</span> — {a.body}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-2">
          <p className="text-[10px] uppercase text-slate-500">Production metadata</p>
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <MetaRow label="Scene" value={clip.sceneNumber ?? "—"} />
            <MetaRow label="Shot" value={clip.shotNumber ?? "—"} />
            <MetaRow label="Take" value={clip.takeNumber != null ? String(clip.takeNumber) : "—"} />
            <MetaRow label="Camera" value={clip.camera ?? "—"} />
            <MetaRow label="Lens" value={clip.lens ?? "—"} />
            <MetaRow label="Media" value={dailiesMediaTypeLabel(clip.mediaType)} />
            <MetaRow label="Duration" value={clip.durationMs ? `${(clip.durationMs / 1000).toFixed(1)}s` : isStill ? "Still" : "—"} />
            <MetaRow label="Stream" value={isStill ? "Ready (image)" : clip.streamStatus} />
            <MetaRow label="Editor bin" value={clip.editorBin ?? "—"} />
          </div>
          {projectId && clip.sceneNumber ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href={`/creator/projects/${projectId}/pre-production/script-breakdown?tab=scenes`}
                className="text-[10px] text-cyan-400 hover:underline"
              >
                Script breakdown →
              </Link>
              {storyboardHref ? (
                <Link href={storyboardHref} className="text-[10px] text-orange-300 hover:underline">
                  Storyboard →
                </Link>
              ) : null}
              <Link
                href={`/creator/projects/${projectId}/production/continuity-manager`}
                className="text-[10px] text-slate-400 hover:underline"
              >
                Continuity →
              </Link>
            </div>
          ) : null}
        </div>

        {scriptExcerpt ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[10px] uppercase text-slate-500 mb-1">Script reference</p>
            <p className="text-xs text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">{scriptExcerpt}</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2">
          <p className="text-[10px] uppercase text-slate-500">
            {isStill ? "Review notes" : `Timecoded notes · ${formatMs(currentMs)}`}
          </p>
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={3}
            placeholder={
              isStill
                ? "Continuity issue on wardrobe… Composition feels tight…"
                : "Performance peaks here… Boom visible… Use Take 4…"
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
            >
              {DAILIES_DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
            >
              {["low", "normal", "high", "critical"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
            >
              {["performance", "audio", "continuity", "vfx", "technical", "editorial", "lighting", "general"].map(
                (c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              disabled={!noteBody.trim()}
              onClick={() => {
                onAddNote({
                  body: noteBody.trim(),
                  timestampMs: isStill ? undefined : currentMs,
                  department,
                  priority,
                  category,
                });
                setNoteBody("");
              }}
              className="rounded-lg bg-orange-500 px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
            >
              {isStill ? "Add note" : "Add at playhead"}
            </button>
          </div>

          {notesLoading ? (
            <p className="text-xs text-slate-500">Loading notes…</p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-slate-500">
              {isStill ? "No notes yet — add feedback on this still." : "No notes yet — click the timeline or add at current timecode."}
            </p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11px]">
                  <span className="font-mono text-orange-300/80">
                    {n.timestampMs != null ? formatMs(n.timestampMs) : "—"}
                  </span>
                  <span className="ml-2 text-slate-500">{n.department ?? "—"}</span>
                  <p className="text-slate-200 mt-0.5">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}</span>
      <p className="text-slate-200">{value}</p>
    </div>
  );
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const f = Math.floor((ms % 1000) / (1000 / 24));
  const sec = s % 60;
  const min = Math.floor(s / 60) % 60;
  return `${min}:${String(sec).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

export function DailiesCompareView({
  clips,
  leftId,
  rightId,
  onLeftId,
  onRightId,
}: {
  clips: DailiesClipRecord[];
  leftId: string | null;
  rightId: string | null;
  onLeftId: (id: string) => void;
  onRightId: (id: string) => void;
}) {
  const left = clips.find((c) => c.id === leftId) ?? null;
  const right = clips.find((c) => c.id === rightId) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Side-by-side take comparison with synchronized review.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <CompareColumn label="A" clips={clips} selectedId={leftId} onSelect={onLeftId} clip={left} />
        <CompareColumn label="B" clips={clips} selectedId={rightId} onSelect={onRightId} clip={right} />
      </div>
    </div>
  );
}

function CompareColumn({
  label,
  clips,
  selectedId,
  onSelect,
  clip,
}: {
  label: string;
  clips: DailiesClipRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  clip: DailiesClipRecord | null;
}) {
  return (
    <div className="space-y-2">
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
      >
        <option value="">Select clip {label}</option>
        {clips.map((c) => (
          <option key={c.id} value={c.id}>
            Sc.{c.sceneNumber ?? "—"} {c.title ?? c.id.slice(0, 8)} Take {c.takeNumber ?? "—"}
          </option>
        ))}
      </select>
      <DailiesMediaViewer clip={clip} className="w-full" />
      {clip ? (
        <p className="text-[10px] text-slate-500">
          {TAKE_STATUS_LABELS[clip.takeStatus]} · {clip.camera ?? "—"}
        </p>
      ) : null}
    </div>
  );
}

export function DailiesDepartmentsPanel({
  activeDepartment,
  onSelectDepartment,
}: {
  activeDepartment: DailiesDepartmentId | null;
  onSelectDepartment: (id: DailiesDepartmentId | null) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        Each department sees a focused review lens — filter notes and priorities by role.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectDepartment(null)}
          className={`rounded-full px-3 py-1.5 text-[11px] ${!activeDepartment ? "bg-white/10 text-white" : "bg-slate-800 text-slate-400"}`}
        >
          All departments
        </button>
        {DAILIES_DEPARTMENTS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onSelectDepartment(activeDepartment === d.id ? null : d.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] transition ${
              activeDepartment === d.id ? "ring-2 ring-white/20" : ""
            }`}
            style={{ backgroundColor: `${d.color}33`, color: d.textColor }}
          >
            {d.label}
          </button>
        ))}
      </div>
      {activeDepartment ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm font-medium text-white">
            {DAILIES_DEPARTMENTS.find((d) => d.id === activeDepartment)?.label} focus
          </p>
          <ul className="mt-2 list-disc pl-4 text-xs text-slate-400">
            {DAILIES_DEPARTMENTS.find((d) => d.id === activeDepartment)?.focus.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-2">Production security</p>
        <ul className="space-y-1">
          <li>• Viewer watermarks on shared review links</li>
          <li>• Streaming-only mode (no download)</li>
          <li>• Role-based permissions & audit trail</li>
          <li>• Session expiration for external reviewers</li>
        </ul>
      </div>
    </div>
  );
}

export function DailiesDailyReportPanel({
  intelligence,
  shootDayId,
  onShootDayId,
}: {
  intelligence: DailiesIntelligencePayload;
  shootDayId: string | null;
  onShootDayId: (id: string) => void;
}) {
  const day = intelligence.shootDays.find((d) => d.shootDayId === shootDayId) ?? intelligence.activeShootDay;
  const dayClips = intelligence.clips.filter((c) => c.shootDayId === (shootDayId ?? day?.shootDayId));
  const report = day
    ? buildDailyReport({
        shootDayDate: day.date,
        clips: dayClips,
        notes: [],
        insights: dayClips.flatMap((c) => c.aiAnalysis ?? []),
      })
    : null;

  return (
    <div className="space-y-4">
      <select
        value={shootDayId ?? day?.shootDayId ?? ""}
        onChange={(e) => onShootDayId(e.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
      >
        {intelligence.shootDays.map((d) => (
          <option key={d.shootDayId} value={d.shootDayId}>
            {new Date(d.date).toLocaleDateString()} — {d.clipCount} clips
          </option>
        ))}
      </select>

      {!report ? (
        <p className="text-sm text-slate-500">Select a shoot day with uploaded dailies.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReportBlock title="Completed scenes" items={report.completedScenes.map((s) => `Scene ${s}`)} />
          <ReportBlock title="Production risks" items={report.productionRisks} />
          <ReportBlock title="Technical issues" items={report.technicalIssues} />
          <ReportBlock title="Performance highlights" items={report.performanceHighlights} />
          <ReportBlock title="Continuity alerts" items={report.continuityAlerts} />
          <ReportBlock title="Tomorrow prep" items={report.tomorrowPrep} />
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:col-span-2">
            <p className="text-[10px] uppercase text-slate-500">Day totals</p>
            <p className="mt-2 text-sm text-slate-200">
              Approved {report.approvedTakes} · Circle {report.circleTakes} · Reshoots {report.reshootsNeeded}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-[10px] uppercase text-slate-500 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-600">—</p>
      ) : (
        <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
          {items.map((item, i) => (
            <li key={`${title}-${i}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DailiesUploadPanel({
  projectId,
  scenes,
  shootDays,
  onUploaded,
  uploading,
  setUploading,
}: {
  projectId: string;
  scenes: Array<{ id: string; number: string; heading: string | null }>;
  shootDays: Array<{ id: string; date: string; unit: string | null }>;
  onUploaded: () => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const [sceneId, setSceneId] = useState("");
  const [shootDayId, setShootDayId] = useState("");
  const [title, setTitle] = useState("");
  const [shotNumber, setShotNumber] = useState("");
  const [takeNumber, setTakeNumber] = useState("");
  const [camera, setCamera] = useState("A");
  const [error, setError] = useState("");

  const { data: healthData } = useQuery({
    queryKey: ["project-dailies-health", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/creator/projects/${projectId}/dailies/health`);
      const json = (await res.json().catch(() => ({}))) as DailiesHealthPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not check dailies upload readiness");
      return json;
    },
  });

  async function uploadOneFile(file: File) {
    const mediaType = inferDailiesMediaTypeFromFile(file);
    const isImage = mediaType === "still";

    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const allowedStill = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp", "tif", "tiff", "dng"];
      const allowedVideo = ["mp4", "mov", "webm", "mkv", "m4v", "avi", "mpeg", "mpg", "3gp"];
      if (!ext || (!allowedStill.includes(ext) && !allowedVideo.includes(ext))) {
        throw new Error("Please choose a video clip or image still (JPEG, PNG, HEIC, etc.).");
      }
    }

    const { uploadContentMediaViaApi } = await import("@/lib/upload-content-media-client");
    const videoUrl = await uploadContentMediaViaApi(file);
    const res = await fetch(`/api/creator/projects/${projectId}/dailies/clips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl,
        mediaType,
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        sceneId: sceneId || null,
        shootDayId: shootDayId || null,
        shotNumber: shotNumber || null,
        takeNumber: takeNumber ? Number.parseInt(takeNumber, 10) : null,
        camera: camera || null,
        durationMs: isImage ? null : null,
        fileSizeBytes: file.size,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j as { error?: string }).error || "Upload failed");
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.length === 0) return;

    setError("");
    setUploading(true);
    try {
      for (const file of files) {
        await uploadOneFile(file);
      }
      setTitle("");
      setTakeNumber("");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      {healthData && !healthData.ok ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-medium">Upload may fail until storage is configured</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-100/90">
            {healthData.issues.slice(0, 4).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-slate-400">
        Upload camera clips <strong className="font-medium text-slate-300">or stills</strong> (JPEG, PNG, HEIC, RAW exports, etc.).
        Link to shoot days and scenes; video proxies process in the background — photos are ready immediately.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-[11px] text-slate-400">
          Shoot day
          <select
            value={shootDayId}
            onChange={(e) => setShootDayId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          >
            <option value="">Select day</option>
            {shootDays.map((d) => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString()} {d.unit ? `· ${d.unit}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          Scene
          <select
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          >
            <option value="">Select scene</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                Sc. {s.number} {s.heading ? `— ${s.heading.slice(0, 40)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            placeholder="Scene 12 — CU Sarah"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          Shot / Take / Camera
          <div className="mt-1 flex gap-2">
            <input
              value={shotNumber}
              onChange={(e) => setShotNumber(e.target.value)}
              placeholder="Shot"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            />
            <input
              value={takeNumber}
              onChange={(e) => setTakeNumber(e.target.value)}
              placeholder="Take"
              className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            />
            <input
              value={camera}
              onChange={(e) => setCamera(e.target.value)}
              placeholder="Cam"
              className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            />
          </div>
        </label>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white hover:bg-orange-600">
        {uploading ? "Uploading…" : "Choose clips or stills"}
        <input
          type="file"
          accept={DAILIES_UPLOAD_ACCEPT}
          multiple
          className="hidden"
          disabled={uploading}
          onChange={onFiles}
        />
      </label>
      <p className="text-[10px] text-slate-500">You can select multiple files at once. Mix of video and photos is supported.</p>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
