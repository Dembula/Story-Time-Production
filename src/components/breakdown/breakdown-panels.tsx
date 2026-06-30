"use client";

import Link from "next/link";
import type { BreakdownIntelligencePayload, CatalogAsset } from "@/lib/breakdown/types";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function statusColor(status: string) {
  if (status === "ready") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (status === "partial") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-slate-800 text-slate-400 ring-slate-700";
}

export function BreakdownCommandCenter({
  intelligence,
  projectId,
  onRunAi,
  aiRunning,
}: {
  intelligence: BreakdownIntelligencePayload;
  projectId?: string;
  onRunAi?: () => void;
  aiRunning?: boolean;
}) {
  const { summary, readiness, insights, linkedTools } = intelligence;

  const exportHref = (format: string, report = "full") =>
    projectId
      ? `/api/creator/projects/${projectId}/breakdown/export?format=${format}&report=${report}`
      : null;

  return (
    <div className="space-y-6">
      {projectId ? (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-[10px] uppercase text-slate-500">Export reports</span>
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => {
            const href = exportHref(fmt);
            if (!href) return null;
            return (
              <a
                key={fmt}
                href={href}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
              >
                {fmt === "xlsx" ? "Excel" : fmt.toUpperCase()}
              </a>
            );
          })}
          <a
            href={exportHref("pdf", "scenes") ?? "#"}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-orange-500/40 hover:text-orange-200"
          >
            Scene sheets (PDF)
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Scenes" value={summary.sceneCount} />
        <StatCard label="Production assets" value={summary.assetCount} />
        <StatCard label="Departments" value={summary.departmentsTouched} />
        <StatCard label="Readiness" value={`${summary.overallReadiness}%`} />
        <StatCard label="Avg complexity" value={summary.averageComplexity} sub="0–100 score" />
        <StatCard label="High-risk scenes" value={summary.highRiskSceneCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Production readiness</h3>
            {projectId && onRunAi ? (
              <button
                type="button"
                onClick={onRunAi}
                disabled={aiRunning}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {aiRunning ? "Running AI…" : "Run AI breakdown"}
              </button>
            ) : null}
          </div>
          <div className="space-y-2">
            {readiness.map((m) => (
              <div key={m.id}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="text-slate-400">{m.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Production intelligence</h3>
          {insights.length === 0 ? (
            <p className="text-xs text-slate-500">
              Run AI breakdown or tag scenes to unlock scheduling, budget, and risk insights.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto text-xs">
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
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Connected production tools</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {linkedTools.map((tool) => (
            <Link
              key={tool.label}
              href={tool.href}
              className="group rounded-lg border border-slate-800 bg-slate-950/60 p-3 hover:border-orange-500/40 hover:bg-slate-900 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white group-hover:text-orange-200">{tool.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase ring-1 ${statusColor(tool.status)}`}>
                  {tool.status}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-600">
        Budget estimates use tagged elements · Last computed {new Date(intelligence.generatedAt).toLocaleString()}
        {summary.assetCount > 0 ? ` · Engine may estimate from ${summary.assetCount} assets` : ""}
      </p>
    </div>
  );
}

export function BreakdownSceneDashboard({
  intelligence,
  projectId,
  selectedSceneId,
  onSelectScene,
}: {
  intelligence: BreakdownIntelligencePayload;
  projectId?: string;
  selectedSceneId: string | null;
  onSelectScene: (id: string) => void;
}) {
  const active = intelligence.scenes.find((s) => s.sceneId === selectedSceneId) ?? intelligence.scenes[0];

  if (intelligence.scenes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        Sync scenes from your screenplay to open scene dashboards.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
      <div className="max-h-[560px] space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-2">
        {intelligence.scenes.map((s) => (
          <button
            key={s.sceneId}
            type="button"
            onClick={() => onSelectScene(s.sceneId)}
            className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
              active?.sceneId === s.sceneId
                ? "bg-orange-500/15 ring-1 ring-orange-500/30 text-white"
                : "text-slate-300 hover:bg-slate-800/60"
            }`}
          >
            <span className="font-semibold">Sc. {s.sceneNumber}</span>
            <span className="ml-2 text-[10px] text-slate-500">{s.completionPercent}% ready</span>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">{s.heading ?? "—"}</p>
          </button>
        ))}
      </div>

      {active ? (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-orange-300/80">Scene {active.sceneNumber}</p>
            <h3 className="text-lg font-semibold text-white">{active.heading ?? "Untitled scene"}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {[active.intExt, active.timeOfDay, active.storyDay != null ? `Story day ${active.storyDay}` : null]
                .filter(Boolean)
                .join(" · ") || "Set INT/EXT and time of day in the editor"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-xs">
            <StatCard label="Est. runtime" value={`${active.estimatedRuntimeMinutes}m`} />
            <StatCard label="Est. shoot" value={`${active.estimatedShootHours}h`} />
            <StatCard label="Crew size" value={active.estimatedCrewSize} />
            <StatCard label="Complexity" value={active.complexityScore} sub={active.difficultyRating} />
          </div>

          {active.summary ? (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Summary</p>
              <p className="text-sm text-slate-200">{active.summary}</p>
            </div>
          ) : null}

          {active.analysis?.purpose ? (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Scene purpose</p>
              <p className="text-sm text-slate-300">{active.analysis.purpose}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
              Production risk: {active.productionRisk}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
              Safety: {active.safetyRisk}
            </span>
            {active.weatherDependency ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">Weather dependent</span>
            ) : null}
            {active.analysis?.emotionalTone ? (
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{active.analysis.emotionalTone}</span>
            ) : null}
          </div>

          {projectId ? (
            <div className="flex flex-wrap gap-2">
              {active.storyboardHref ? (
                <Link
                  href={active.storyboardHref}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-cyan-300 hover:border-cyan-500/40"
                >
                  Storyboards
                  {active.visualAssetCount > 0 ? ` (${active.visualAssetCount})` : ""}
                </Link>
              ) : null}
              <Link
                href={`/creator/projects/${projectId}/pre-production/visual-planning?category=scene&scene=${active.sceneNumber}`}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-orange-300 hover:border-orange-500/40"
              >
                Shot list & frames
              </Link>
            </div>
          ) : null}

          {(active.analysis?.aiFlags?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">AI production notes</p>
              <ul className="list-disc pl-4 text-xs text-slate-400 space-y-1">
                {active.analysis!.aiFlags!.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-[10px] uppercase text-slate-500 mb-2">Tagged elements</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(active.counts)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <span key={k} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                    {k}: {n}
                  </span>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BreakdownCatalogPanel({
  catalog,
  onSelectAsset,
}: {
  catalog: CatalogAsset[];
  onSelectAsset?: (asset: CatalogAsset) => void;
}) {
  if (catalog.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        No production assets yet. Run AI breakdown or tag elements per scene.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Asset</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Scenes</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((a) => (
              <tr
                key={`${a.category}-${a.id}`}
                className="border-t border-slate-800 hover:bg-slate-900/80 cursor-pointer"
                onClick={() => onSelectAsset?.(a)}
              >
                <td className="px-3 py-2 text-slate-200">{a.label}</td>
                <td className="px-3 py-2 text-slate-400 capitalize">{a.category}</td>
                <td className="px-3 py-2 text-slate-400">{a.sceneNumbers.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BreakdownAssetSheet({
  asset,
  onClose,
  procurement,
}: {
  asset: CatalogAsset | null;
  onClose: () => void;
  procurement?: { poStatus?: string | null; poNumber?: string | null; rentalStatus?: string | null };
}) {
  if (!asset) return null;

  const rentalFromMeta =
    asset.meta?.locationListingId != null ? "Booked" : procurement?.rentalStatus ?? null;
  const poStatus = procurement?.poStatus ?? null;
  const poNumber = procurement?.poNumber ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase text-slate-500 capitalize">{asset.category}</p>
            <h3 className="text-lg font-semibold text-white">{asset.label}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            Close
          </button>
        </div>
        {asset.description ? <p className="mt-3 text-sm text-slate-300">{asset.description}</p> : null}
        {(poStatus || rentalFromMeta) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {poStatus ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] text-emerald-300">
                PO {poNumber ? `${poNumber} · ` : ""}{poStatus}
              </span>
            ) : null}
            {rentalFromMeta ? (
              <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] text-cyan-200">
                Rental: {rentalFromMeta}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 space-y-2 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">Scenes:</span> {asset.sceneNumbers.join(", ") || "Unassigned"}
          </p>
          <p>
            <span className="text-slate-500">Appearances:</span> {asset.sceneIds.length}
          </p>
          {asset.meta ? (
            <pre className="rounded-lg bg-slate-950 p-2 text-[10px] text-slate-500 overflow-x-auto">
              {JSON.stringify(asset.meta, null, 2)}
            </pre>
          ) : null}
        </div>
        <p className="mt-4 text-[10px] text-slate-600">
          Changes to this asset in the editor sync to budget, scheduling, casting, and call sheets.
        </p>
      </div>
    </div>
  );
}
