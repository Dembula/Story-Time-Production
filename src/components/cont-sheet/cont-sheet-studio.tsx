"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { ContSheetStopwatch } from "@/components/cont-sheet/cont-sheet-stopwatch";
import { projectToolQueryFn } from "@/lib/project-tool-fetch";
import {
  formatDurationMss,
  normalizePrintStatus,
  parseDurationToSec,
  type ContSheetCrew,
  type ContSheetDayClock,
  type ContSheetTotals,
} from "@/lib/cont-sheet/types";
import { buildContSheetBodyHtml, CONT_SHEET_PRINT_CSS } from "@/lib/cont-sheet/html";
import { downloadPdfFromHtmlDocument, printHtmlDocument } from "@/lib/pdf/print-html-document";

type TakeRow = {
  id?: string;
  clientKey: string;
  slate: string;
  takeNumber: number | null;
  pickup: number | null;
  printStatus: string;
  durationSec: number | null;
  description: string;
  notes: string;
  camera: string;
  sortOrder: number;
};

type SceneRow = {
  id?: string;
  clientKey: string;
  projectSceneId: string | null;
  episode: string;
  sceneCode: string;
  dayNight: string;
  intExt: string;
  location: string;
  weather: string;
  turnoverTime: string;
  estimatedTiming: string;
  actualTiming: string;
  completionStatus: string;
  sortOrder: number;
  takes: TakeRow[];
};

type DayState = {
  id?: string;
  shootDayId: string;
  showTitle: string;
  productionCompany: string;
  callSheetNumber: string;
  reportDate: string;
  cameraUnit: string;
  crew: ContSheetCrew;
  dayClock: ContSheetDayClock;
  scenesSummary: {
    scheduled: string[];
    completed: string[];
    dropped: string[];
    added: string[];
    partlyShot: string[];
  };
  totals: ContSheetTotals;
  notes: string;
  scenes: SceneRow[];
};

function uid() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyTake(sortOrder = 0): TakeRow {
  return {
    clientKey: uid(),
    slate: "",
    takeNumber: null,
    pickup: 1,
    printStatus: "",
    durationSec: null,
    description: "",
    notes: "",
    camera: "A",
    sortOrder,
  };
}

function emptyScene(sortOrder = 0): SceneRow {
  return {
    clientKey: uid(),
    projectSceneId: null,
    episode: "",
    sceneCode: "",
    dayNight: "",
    intExt: "",
    location: "",
    weather: "",
    turnoverTime: "",
    estimatedTiming: "",
    actualTiming: "",
    completionStatus: "scheduled",
    sortOrder,
    takes: [emptyTake(0)],
  };
}

function mapApiDay(day: Record<string, unknown>): DayState {
  const scenes = Array.isArray(day.scenes) ? day.scenes : [];
  return {
    id: typeof day.id === "string" ? day.id : undefined,
    shootDayId: String(day.shootDayId ?? ""),
    showTitle: String(day.showTitle ?? ""),
    productionCompany: String(day.productionCompany ?? ""),
    callSheetNumber: String(day.callSheetNumber ?? ""),
    reportDate: String(day.reportDate ?? ""),
    cameraUnit: String(day.cameraUnit ?? "A"),
    crew: (day.crew as ContSheetCrew) ?? {},
    dayClock: (day.dayClock as ContSheetDayClock) ?? {},
    scenesSummary: {
      scheduled: Array.isArray((day.scenesSummary as { scheduled?: string[] })?.scheduled)
        ? ((day.scenesSummary as { scheduled: string[] }).scheduled ?? [])
        : [],
      completed: Array.isArray((day.scenesSummary as { completed?: string[] })?.completed)
        ? ((day.scenesSummary as { completed: string[] }).completed ?? [])
        : [],
      dropped: Array.isArray((day.scenesSummary as { dropped?: string[] })?.dropped)
        ? ((day.scenesSummary as { dropped: string[] }).dropped ?? [])
        : [],
      added: Array.isArray((day.scenesSummary as { added?: string[] })?.added)
        ? ((day.scenesSummary as { added: string[] }).added ?? [])
        : [],
      partlyShot: Array.isArray((day.scenesSummary as { partlyShot?: string[] })?.partlyShot)
        ? ((day.scenesSummary as { partlyShot: string[] }).partlyShot ?? [])
        : [],
    },
    totals: (day.totals as ContSheetTotals) ?? {},
    notes: String(day.notes ?? ""),
    scenes: scenes.map((s: Record<string, unknown>, idx: number) => ({
      id: typeof s.id === "string" ? s.id : undefined,
      clientKey: typeof s.id === "string" ? s.id : uid(),
      projectSceneId: (s.projectSceneId as string | null) ?? null,
      episode: String(s.episode ?? ""),
      sceneCode: String(s.sceneCode ?? ""),
      dayNight: String(s.dayNight ?? ""),
      intExt: String(s.intExt ?? ""),
      location: String(s.location ?? ""),
      weather: String(s.weather ?? ""),
      turnoverTime: String(s.turnoverTime ?? ""),
      estimatedTiming: String(s.estimatedTiming ?? ""),
      actualTiming: String(s.actualTiming ?? ""),
      completionStatus: String(s.completionStatus ?? "scheduled"),
      sortOrder: typeof s.sortOrder === "number" ? s.sortOrder : idx,
      takes: (Array.isArray(s.takes) ? s.takes : []).map((t: Record<string, unknown>, tIdx: number) => ({
        id: typeof t.id === "string" ? t.id : undefined,
        clientKey: typeof t.id === "string" ? t.id : uid(),
        slate: String(t.slate ?? ""),
        takeNumber: typeof t.takeNumber === "number" ? t.takeNumber : null,
        pickup: typeof t.pickup === "number" ? t.pickup : null,
        printStatus: String(t.printStatus ?? ""),
        durationSec: typeof t.durationSec === "number" ? t.durationSec : null,
        description: String(t.description ?? ""),
        notes: String(t.notes ?? ""),
        camera: String(t.camera ?? "A"),
        sortOrder: typeof t.sortOrder === "number" ? t.sortOrder : tIdx,
      })),
    })),
  };
}

const field =
  "h-10 w-full rounded-xl border border-white/12 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400/50";
const area =
  "w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50";

type Props = { projectId?: string; title: string };

export function ContSheetStudio({ projectId, title }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dpr" | "sheets">("dpr");
  const [shootDayId, setShootDayId] = useState("");
  const [day, setDay] = useState<DayState | null>(null);
  const [activeSceneKey, setActiveSceneKey] = useState<string | null>(null);
  const [selectedTakeKey, setSelectedTakeKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["project-cont-sheet", projectId],
    queryFn: projectToolQueryFn(`/api/creator/projects/${projectId}/cont-sheet`),
    enabled: Boolean(projectId),
  });

  const shootDays = listData?.shootDays ?? [];

  const { data: dayData, isFetching: dayLoading } = useQuery({
    queryKey: ["project-cont-sheet-day", projectId, shootDayId],
    queryFn: projectToolQueryFn(
      `/api/creator/projects/${projectId}/cont-sheet?shootDayId=${encodeURIComponent(shootDayId)}`,
    ),
    enabled: Boolean(projectId && shootDayId),
  });

  useEffect(() => {
    if (!shootDayId && shootDays[0]?.id) {
      setShootDayId(shootDays[0].id);
    }
  }, [shootDays, shootDayId]);

  useEffect(() => {
    if (!dayData) return;
    if (dayData.day) {
      const mapped = mapApiDay(dayData.day);
      setDay(mapped);
      setActiveSceneKey(mapped.scenes[0]?.clientKey ?? null);
      setSelectedTakeKey(mapped.scenes[0]?.takes[0]?.clientKey ?? null);
    } else {
      setDay(null);
    }
  }, [dayData]);

  const prefill = useMutation({
    mutationFn: async (forcePrefill: boolean) => {
      const res = await fetch(`/api/creator/projects/${projectId}/cont-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shootDayId, forcePrefill }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Prefill failed");
      return json;
    },
    onSuccess: (json) => {
      const mapped = mapApiDay(json.day);
      setDay(mapped);
      setActiveSceneKey(mapped.scenes[0]?.clientKey ?? null);
      setMessage(json.reset ? "Reset from schedule." : json.created ? "Cont sheet created." : "Loaded existing cont sheet.");
      setError("");
      qc.invalidateQueries({ queryKey: ["project-cont-sheet", projectId] });
      qc.invalidateQueries({ queryKey: ["project-cont-sheet-day", projectId, shootDayId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!day) throw new Error("Nothing to save");
      const res = await fetch(`/api/creator/projects/${projectId}/cont-sheet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: day.id,
          shootDayId: day.shootDayId || shootDayId,
          showTitle: day.showTitle,
          productionCompany: day.productionCompany,
          callSheetNumber: day.callSheetNumber,
          reportDate: day.reportDate,
          cameraUnit: day.cameraUnit,
          crew: day.crew,
          dayClock: day.dayClock,
          scenesSummary: day.scenesSummary,
          totals: day.totals,
          notes: day.notes,
          scenes: day.scenes.map((s, idx) => ({
            id: s.id,
            projectSceneId: s.projectSceneId,
            episode: s.episode || null,
            sceneCode: s.sceneCode,
            dayNight: s.dayNight || null,
            intExt: s.intExt || null,
            location: s.location || null,
            weather: s.weather || null,
            turnoverTime: s.turnoverTime || null,
            estimatedTiming: s.estimatedTiming || null,
            actualTiming: s.actualTiming || null,
            completionStatus: s.completionStatus,
            sortOrder: idx,
            takes: s.takes.map((t, tIdx) => ({
              id: t.id,
              slate: t.slate || null,
              takeNumber: t.takeNumber,
              pickup: t.pickup,
              printStatus: normalizePrintStatus(t.printStatus) || null,
              durationSec: t.durationSec,
              description: t.description || null,
              notes: t.notes || null,
              camera: t.camera || null,
              sortOrder: tIdx,
            })),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      return json;
    },
    onSuccess: (json) => {
      if (json.day) {
        const mapped = mapApiDay(json.day);
        setDay(mapped);
        setActiveSceneKey((prev) => prev ?? mapped.scenes[0]?.clientKey ?? null);
      }
      setMessage("Saved.");
      setError("");
      qc.invalidateQueries({ queryKey: ["project-cont-sheet", projectId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const activeScene = useMemo(
    () => day?.scenes.find((s) => s.clientKey === activeSceneKey) ?? day?.scenes[0] ?? null,
    [day, activeSceneKey],
  );

  const selectedTake = useMemo(() => {
    if (!activeScene || !selectedTakeKey) return null;
    return activeScene.takes.find((t) => t.clientKey === selectedTakeKey) ?? null;
  }, [activeScene, selectedTakeKey]);

  const updateDay = (patch: Partial<DayState>) => setDay((d) => (d ? { ...d, ...patch } : d));

  const updateCrew = (key: keyof ContSheetCrew, value: string) =>
    setDay((d) => (d ? { ...d, crew: { ...d.crew, [key]: value } } : d));

  const updateClock = (key: keyof ContSheetDayClock, value: string) =>
    setDay((d) => (d ? { ...d, dayClock: { ...d.dayClock, [key]: value } } : d));

  const updateScene = (clientKey: string, patch: Partial<SceneRow>) =>
    setDay((d) => {
      if (!d) return d;
      return {
        ...d,
        scenes: d.scenes.map((s) => (s.clientKey === clientKey ? { ...s, ...patch } : s)),
      };
    });

  const updateTake = (sceneKey: string, takeKey: string, patch: Partial<TakeRow>) =>
    setDay((d) => {
      if (!d) return d;
      return {
        ...d,
        scenes: d.scenes.map((s) =>
          s.clientKey !== sceneKey
            ? s
            : {
                ...s,
                takes: s.takes.map((t) => (t.clientKey === takeKey ? { ...t, ...patch } : t)),
              },
        ),
      };
    });

  const commitDuration = useCallback(
    (durationSec: number) => {
      if (!day || !activeScene || !selectedTakeKey) return;
      updateTake(activeScene.clientKey, selectedTakeKey, { durationSec });
      setMessage(`Filled ${formatDurationMss(durationSec)} into selected take.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, activeScene, selectedTakeKey],
  );

  async function handleExport(mode: "print" | "pdf") {
    if (!day || !projectId) return;
    const exportDay = {
      showTitle: day.showTitle,
      productionCompany: day.productionCompany,
      callSheetNumber: day.callSheetNumber,
      reportDate: day.reportDate,
      cameraUnit: day.cameraUnit,
      crew: day.crew,
      dayClock: day.dayClock,
      scenesSummary: day.scenesSummary,
      totals: day.totals,
      notes: day.notes,
      scenes: day.scenes.map((s) => ({
        episode: s.episode,
        sceneCode: s.sceneCode,
        dayNight: s.dayNight,
        intExt: s.intExt,
        location: s.location,
        weather: s.weather,
        turnoverTime: s.turnoverTime,
        estimatedTiming: s.estimatedTiming,
        actualTiming: s.actualTiming,
        completionStatus: s.completionStatus,
        takes: s.takes,
      })),
    };
    const bodyHtml = buildContSheetBodyHtml(exportDay);
    const docTitle = `Cont Sheet DPR ${day.callSheetNumber || ""} ${day.reportDate || ""}`.trim();
    if (mode === "print") {
      printHtmlDocument({ title: docTitle, bodyHtml, extraCss: CONT_SHEET_PRINT_CSS });
      return;
    }
    await downloadPdfFromHtmlDocument({
      title: docTitle,
      bodyHtml,
      extraCss: CONT_SHEET_PRINT_CSS,
      filename: `cont-sheet-DPR-${day.callSheetNumber || "draft"}-${(day.reportDate || "day").replace(/\//g, "-")}.pdf`,
    });
  }

  if (!projectId) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-slate-400">
          Link a project to save Cont Sheets, or use the form below after selecting a project in the bar above.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[70vh] space-y-5">
      {day ? (
        <ContSheetStopwatch
          selectedTakeLabel={
            selectedTake
              ? `${activeScene?.sceneCode || "Scene"} · ${selectedTake.slate || "slate"} T${selectedTake.takeNumber ?? "—"}`
              : null
          }
          canCommit={Boolean(selectedTake)}
          onCommitDuration={commitDuration}
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Script supervisor Cont Sheet + Daily Progress Report. Manual entry with schedule prefill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={shootDayId}
            onChange={(e) => setShootDayId(e.target.value)}
            className={`${field} min-w-[12rem]`}
            disabled={listLoading}
          >
            <option value="">Select shoot day</option>
            {shootDays.map((d: { id: string; date: string; unit?: string | null }) => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString()} {d.unit ? `· Unit ${d.unit}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!shootDayId || prefill.isPending}
            onClick={() => prefill.mutate(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-400/35 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-500/20 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {day ? "Reload" : "Prefill from schedule"}
          </button>
          {day ? (
            <button
              type="button"
              disabled={prefill.isPending}
              onClick={() => {
                if (window.confirm("Reset this day from schedule? Your take logs will be replaced.")) {
                  prefill.mutate(true);
                }
              }}
              className="rounded-xl border border-white/12 px-3 py-2 text-xs text-slate-300"
            >
              Reset from schedule
            </button>
          ) : null}
          <button
            type="button"
            disabled={!day || save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={!day}
            onClick={() => void handleExport("pdf")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white hover:border-orange-400/40 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            disabled={!day}
            onClick={() => void handleExport("print")}
            className="rounded-xl border border-white/12 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"
          >
            Print
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      {!shootDayId ? (
        <p className="text-sm text-slate-500">Pick a shoot day to start.</p>
      ) : dayLoading && !day ? (
        <div className="h-48 animate-pulse rounded-2xl border border-white/8 bg-white/[0.03]" />
      ) : !day ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-300">No Cont Sheet for this day yet.</p>
          <button
            type="button"
            onClick={() => prefill.mutate(false)}
            className="mt-3 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Prefill from call sheet &amp; schedule
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab("dpr")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                tab === "dpr" ? "bg-orange-500 text-slate-950" : "border border-white/12 text-slate-300"
              }`}
            >
              DPR
            </button>
            <button
              type="button"
              onClick={() => setTab("sheets")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                tab === "sheets" ? "bg-orange-500 text-slate-950" : "border border-white/12 text-slate-300"
              }`}
            >
              Cont sheets
            </button>
          </div>

          {tab === "dpr" ? (
            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.02] p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-slate-400">
                  Show / title
                  <input className={field} value={day.showTitle} onChange={(e) => updateDay({ showTitle: e.target.value })} />
                </label>
                <label className="text-xs text-slate-400">
                  Production company
                  <input
                    className={field}
                    value={day.productionCompany}
                    onChange={(e) => updateDay({ productionCompany: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Call sheet #
                  <input
                    className={field}
                    value={day.callSheetNumber}
                    onChange={(e) => updateDay({ callSheetNumber: e.target.value })}
                  />
                </label>
                <label className="text-xs text-slate-400">
                  Date
                  <input className={field} value={day.reportDate} onChange={(e) => updateDay({ reportDate: e.target.value })} />
                </label>
                <label className="text-xs text-slate-400">
                  Camera unit
                  <input className={field} value={day.cameraUnit} onChange={(e) => updateDay({ cameraUnit: e.target.value })} />
                </label>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-orange-200">Crew</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      ["lineProducer", "Line producer"],
                      ["producer", "Producer"],
                      ["productionManager", "Production manager"],
                      ["directors", "Director(s)"],
                      ["scriptSupervisor", "Script supervisor"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs text-slate-400">
                      {label}
                      <input
                        className={field}
                        value={day.crew[key] ?? ""}
                        onChange={(e) => updateCrew(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-orange-200">Day clock</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {(
                    [
                      ["callTime", "Call"],
                      ["firstTurnover", "First turnover"],
                      ["lunch", "Lunch"],
                      ["firstShotAfterLunch", "AF / Lunch"],
                      ["wrapTime", "Wrap"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="text-xs text-slate-400">
                      {label}
                      <input
                        className={field}
                        value={day.dayClock[key] ?? ""}
                        onChange={(e) => updateClock(key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-orange-200">Scene strip</h3>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Scene</th>
                        <th className="px-3 py-2">Est</th>
                        <th className="px-3 py-2">Actual</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.scenes.map((s) => (
                        <tr key={s.clientKey} className="border-t border-white/8">
                          <td className="px-3 py-2">
                            <input
                              className={field}
                              value={s.sceneCode}
                              onChange={(e) => updateScene(s.clientKey, { sceneCode: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={field}
                              value={s.estimatedTiming}
                              onChange={(e) => updateScene(s.clientKey, { estimatedTiming: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className={field}
                              value={s.actualTiming}
                              onChange={(e) => updateScene(s.clientKey, { actualTiming: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className={field}
                              value={s.completionStatus}
                              onChange={(e) => updateScene(s.clientKey, { completionStatus: e.target.value })}
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="completed">Completed</option>
                              <option value="dropped">Dropped</option>
                              <option value="added">Added</option>
                              <option value="partlyShot">Partly shot</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDay((d) =>
                      d
                        ? { ...d, scenes: [...d.scenes, emptyScene(d.scenes.length)] }
                        : d,
                    )
                  }
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orange-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Add scene
                </button>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-orange-200">Totals</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs text-slate-400">
                    Total est time
                    <input
                      className={field}
                      value={day.totals.totalEstTime ?? ""}
                      onChange={(e) =>
                        updateDay({ totals: { ...day.totals, totalEstTime: e.target.value } })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Total act time
                    <input
                      className={field}
                      value={day.totals.totalActTime ?? ""}
                      onChange={(e) =>
                        updateDay({ totals: { ...day.totals, totalActTime: e.target.value } })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    Total pages
                    <input
                      className={field}
                      value={day.totals.totalPages ?? ""}
                      onChange={(e) =>
                        updateDay({ totals: { ...day.totals, totalPages: e.target.value } })
                      }
                    />
                  </label>
                </div>
              </div>

              <label className="block text-xs text-slate-400">
                Notes
                <textarea
                  className={area}
                  rows={3}
                  value={day.notes}
                  onChange={(e) => updateDay({ notes: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Scenes
                </p>
                {day.scenes.map((s) => (
                  <button
                    key={s.clientKey}
                    type="button"
                    onClick={() => {
                      setActiveSceneKey(s.clientKey);
                      setSelectedTakeKey(s.takes[0]?.clientKey ?? null);
                    }}
                    className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                      activeScene?.clientKey === s.clientKey
                        ? "bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/30"
                        : "text-slate-300 hover:bg-white/[0.04]"
                    }`}
                  >
                    {s.sceneCode || "Untitled"}
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {s.takes.length} take{s.takes.length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const scene = emptyScene(day.scenes.length);
                    setDay((d) => (d ? { ...d, scenes: [...d.scenes, scene] } : d));
                    setActiveSceneKey(scene.clientKey);
                    setSelectedTakeKey(scene.takes[0].clientKey);
                  }}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 py-2 text-xs text-orange-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Scene
                </button>
              </div>

              {activeScene ? (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs text-slate-400">
                      Episode
                      <input
                        className={field}
                        value={activeScene.episode}
                        onChange={(e) => updateScene(activeScene.clientKey, { episode: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Scene
                      <input
                        className={field}
                        value={activeScene.sceneCode}
                        onChange={(e) => updateScene(activeScene.clientKey, { sceneCode: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Turn over
                      <input
                        className={field}
                        value={activeScene.turnoverTime}
                        onChange={(e) => updateScene(activeScene.clientKey, { turnoverTime: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Day / Night
                      <input
                        className={field}
                        value={activeScene.dayNight}
                        onChange={(e) => updateScene(activeScene.clientKey, { dayNight: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Int / Ext
                      <input
                        className={field}
                        value={activeScene.intExt}
                        onChange={(e) => updateScene(activeScene.clientKey, { intExt: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Location
                      <input
                        className={field}
                        value={activeScene.location}
                        onChange={(e) => updateScene(activeScene.clientKey, { location: e.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Weather
                      <input
                        className={field}
                        value={activeScene.weather}
                        onChange={(e) => updateScene(activeScene.clientKey, { weather: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Slate</th>
                          <th className="px-2 py-2">Take</th>
                          <th className="px-2 py-2">P/U</th>
                          <th className="px-2 py-2">Print/NG</th>
                          <th className="px-2 py-2">Time</th>
                          <th className="px-2 py-2">Cam</th>
                          <th className="px-2 py-2">Description</th>
                          <th className="px-2 py-2">Notes</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {activeScene.takes.map((t) => {
                          const selected = selectedTakeKey === t.clientKey;
                          return (
                            <tr
                              key={t.clientKey}
                              onClick={() => setSelectedTakeKey(t.clientKey)}
                              className={`border-t border-white/8 cursor-pointer ${
                                selected ? "bg-orange-500/10" : "hover:bg-white/[0.03]"
                              }`}
                            >
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={t.slate}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, { slate: e.target.value })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={t.takeNumber ?? ""}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, {
                                      takeNumber: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={t.pickup ?? ""}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, {
                                      pickup: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <select
                                  className={field}
                                  value={normalizePrintStatus(t.printStatus) || ""}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, {
                                      printStatus: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">—</option>
                                  <option value="PRINT">PRINT</option>
                                  <option value="NG">NG</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={formatDurationMss(t.durationSec)}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, {
                                      durationSec: parseDurationToSec(e.target.value),
                                    })
                                  }
                                  placeholder="0:00"
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <select
                                  className={field}
                                  value={t.camera}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, { camera: e.target.value })
                                  }
                                >
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={t.description}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, {
                                      description: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <input
                                  className={field}
                                  value={t.notes}
                                  onChange={(e) =>
                                    updateTake(activeScene.clientKey, t.clientKey, { notes: e.target.value })
                                  }
                                />
                              </td>
                              <td className="px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateScene(activeScene.clientKey, {
                                      takes: activeScene.takes.filter((x) => x.clientKey !== t.clientKey),
                                    });
                                  }}
                                  className="rounded-lg p-1.5 text-slate-500 hover:text-red-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const take = emptyTake(activeScene.takes.length);
                      updateScene(activeScene.clientKey, {
                        takes: [...activeScene.takes, take],
                      });
                      setSelectedTakeKey(take.clientKey);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-orange-200"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add take
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Add a scene to log takes.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
